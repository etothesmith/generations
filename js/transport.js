// ============================================================
// Transport layer — one interface, two backends:
//   FirebaseTransport : real multi-device play (phones anywhere)
//   DemoTransport     : BroadcastChannel, same browser only (testing)
//
// Model: the HOST is authoritative. It owns the full game state and
// publishes it; players only send small "input" messages
// (join, buzz, answer, vote, wager...) that the host processes.
// ============================================================
import { firebaseConfig, USE_FIREBASE } from './config.js';

export async function createTransport() {
  if (USE_FIREBASE) {
    const t = new FirebaseTransport();
    await t.init();
    return t;
  }
  return new DemoTransport();
}

// Firebase silently drops empty arrays, empty objects and nulls. The demo
// transport does the same so local testing catches the same edge cases.
export function stripEmpty(v) {
  if (Array.isArray(v)) { const a = v.map(stripEmpty); return a.length ? a.map((x) => (x === undefined ? null : x)) : undefined; }
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) { const y = stripEmpty(x); if (y !== undefined && y !== null) o[k] = y; }
    return Object.keys(o).length ? o : undefined;
  }
  return v === null ? undefined : v;
}

// ---------------- Demo (BroadcastChannel) ----------------
class DemoTransport {
  constructor() {
    this.mode = 'demo';
    this.offset = 0;
    this.chan = null;
    this.code = null;
    this.handlers = { state: null, input: null, presence: null };
    this.presence = {};       // pid -> lastSeen (host side)
    this.heartbeat = null;
  }
  serverNow() { return Date.now(); }
  _open(code) {
    this.code = code;
    this.chan = new BroadcastChannel('generations-' + code);
    this.chan.onmessage = (e) => this._onMsg(e.data);
  }
  _onMsg(m) {
    if (m.kind === 'state' && this.handlers.state) this.handlers.state(m.state);
    if (m.kind === 'input' && this.handlers.input) this.handlers.input(m.msg);
    if (m.kind === 'hb' && this.handlers.presence) {
      this.presence[m.pid] = Date.now();
    }
    if (m.kind === 'chat' && this.handlers.chat) this.handlers.chat(m.m);
    if (m.kind === 'callhb') { this._peers = this._peers || {}; this._peers[m.pid] = { info: m.info, seen: Date.now() }; }
    if (m.kind === 'callbye' && this._peers) delete this._peers[m.pid];
    if (m.kind === 'sig' && this.handlers.sig && m.to === this.handlers.sig.pid) this.handlers.sig.cb(m.msg);
    if (m.kind === 'hello' && this.isHost && this._last) {
      this.chan.postMessage({ kind: 'state', state: this._last });
    }
  }
  async createRoom(code) {
    this.isHost = true;
    this._open(code);
    localStorage.setItem('gen-demo-room-' + code, String(Date.now()));
    return true;
  }
  async roomExists(code) {
    return !!localStorage.getItem('gen-demo-room-' + code);
  }
  async joinRoom(code, pid) {
    this._open(code);
    this.pid = pid;
    const beat = () => this.chan && this.chan.postMessage({ kind: 'hb', pid });
    beat();
    this.heartbeat = setInterval(beat, 2000);
    this.chan.postMessage({ kind: 'hello' });
  }
  async watchRoom(code) { this._open(code); this.chan.postMessage({ kind: 'hello' }); }
  publishState(state) {
    state = stripEmpty(JSON.parse(JSON.stringify(state))) || {}; // behave like Firebase (drops empty arrays/objects/nulls)
    this._last = state;
    if (this.chan) this.chan.postMessage({ kind: 'state', state });
  }
  onState(cb) { this.handlers.state = cb; }
  onInput(cb) { this.handlers.input = cb; }
  sendInput(msg) {
    if (this.chan) this.chan.postMessage({ kind: 'input', msg: { ...msg, at: Date.now() } });
  }
  onPresence(cb) {
    this.handlers.presence = cb;
    setInterval(() => {
      const now = Date.now(), map = {};
      for (const [pid, t] of Object.entries(this.presence)) map[pid] = now - t < 7000;
      cb(map);
    }, 1500);
  }
  async closeRoom() {
    localStorage.removeItem('gen-demo-room-' + this.code);
  }

  // ---------- family chat + voice notes ----------
  _chatKey() { return 'gen-demo-chat-' + this.code; }
  sendChat(msg) {
    const m = { ...msg, at: Date.now(), id: Math.random().toString(36).slice(2) };
    try { const list = JSON.parse(localStorage.getItem(this._chatKey()) || '[]'); list.push(m); localStorage.setItem(this._chatKey(), JSON.stringify(list.slice(-60))); } catch (e) { /* storage full */ }
    if (this.chan) this.chan.postMessage({ kind: 'chat', m });
    if (this.handlers.chat) this.handlers.chat(m);
  }
  onChat(cb) {
    this.handlers.chat = cb;
    try { for (const m of JSON.parse(localStorage.getItem(this._chatKey()) || '[]')) cb(m, true); } catch (e) { /* none */ }
  }
  // ---------- video call signaling ----------
  callJoin(pid, info) {
    this._callMe = { pid, info };
    const beat = () => this.chan && this._callMe && this.chan.postMessage({ kind: 'callhb', pid, info });
    beat(); clearInterval(this._callBeat); this._callBeat = setInterval(beat, 1500);
  }
  callLeave(pid) { this._callMe = null; clearInterval(this._callBeat); if (this.chan) this.chan.postMessage({ kind: 'callbye', pid }); }
  onCallPeers(cb) {
    this.handlers.callPeers = cb;
    this._peers = this._peers || {};
    clearInterval(this._peerTick);
    this._peerTick = setInterval(() => {
      const now = Date.now(), map = {};
      for (const [k, v] of Object.entries(this._peers)) if (now - v.seen < 5000) map[k] = v.info;
      if (this._callMe) map[this._callMe.pid] = this._callMe.info;
      cb(map);
    }, 700);
  }
  sendSignal(to, msg) { if (this.chan) this.chan.postMessage({ kind: 'sig', to, msg }); }
  onSignal(pid, cb) { this.handlers.sig = { pid, cb }; }
  // private host data (answer key for the host remote) — keyed by a secret
  publishPrivate(key, data) {
    this._priv = this._priv || new BroadcastChannel('generations-priv');
    this._privLast = { key, data };
    this._priv.postMessage({ key, data });
    if (!this._privHello) {
      this._privHello = true;
      this._priv.onmessage = (e) => { if (e.data && e.data.hello === key && this._privLast) this._priv.postMessage(this._privLast); };
    }
  }
  onPrivate(key, cb) {
    this._priv = this._priv || new BroadcastChannel('generations-priv');
    this._priv.onmessage = (e) => { if (e.data && e.data.key === key) cb(e.data.data); };
    this._priv.postMessage({ hello: key });
  }
}

// ---------------- Firebase ----------------
class FirebaseTransport {
  constructor() { this.mode = 'firebase'; this.offset = 0; }
  async init() {
    const fb = await import('../vendor/firebase.js');
    this.fb = fb;
    this.app = fb.initializeApp(firebaseConfig);
    this.auth = fb.getAuth(this.app);
    this.db = fb.getDatabase(this.app);
    const cred = await fb.signInAnonymously(this.auth);
    this.uid = cred.user.uid;
    fb.onValue(fb.ref(this.db, '.info/serverTimeOffset'), (s) => { this.offset = s.val() || 0; });
  }
  serverNow() { return Date.now() + this.offset; }
  r(path) { return this.fb.ref(this.db, `rooms/${this.code}/${path}`); }
  async roomExists(code) {
    const s = await this.fb.get(this.fb.ref(this.db, `rooms/${code}/meta`));
    return s.exists();
  }
  async createRoom(code) {
    this.code = code; this.isHost = true;
    await this.fb.set(this.r('meta'), { hostUid: this.uid, createdAt: this.fb.serverTimestamp() });
    return true;
  }
  async joinRoom(code, pid) {
    this.code = code; this.pid = pid;
    const { fb } = this;
    const pres = this.r('presence/' + pid);
    fb.onValue(fb.ref(this.db, '.info/connected'), (s) => {
      if (s.val() === true) {
        fb.onDisconnect(pres).remove();
        fb.set(pres, true);
      }
    });
  }
  publishState(state) {
    // JSON round-trip strips undefined (Firebase rejects it)
    this.fb.set(this.r('state'), JSON.parse(JSON.stringify(state)));
  }
  onState(cb) { this.fb.onValue(this.r('state'), (s) => { if (s.exists()) cb(s.val()); }); }
  onInput(cb) {
    this.fb.onChildAdded(this.r('inbox'), (s) => {
      cb(s.val());
      this.fb.remove(s.ref);
    });
  }
  sendInput(msg) {
    this.fb.push(this.r('inbox'), { ...msg, uid: this.uid, at: this.serverNow() });
  }
  onPresence(cb) {
    this.fb.onValue(this.r('presence'), (s) => {
      const v = s.val() || {}, map = {};
      for (const k of Object.keys(v)) map[k] = true;
      cb(map);
    });
  }
  async closeRoom() {
    try { await this.fb.remove(this.fb.ref(this.db, `rooms/${this.code}`)); } catch (e) { /* ignore */ }
  }

  async watchRoom(code) { this.code = code; }
  // ---------- family chat + voice notes ----------
  sendChat(msg) {
    return this.fb.push(this.r('chat'), { ...msg, uid: this.uid, at: this.serverNow() });
  }
  onChat(cb) {
    const q = this.fb.query(this.r('chat'), this.fb.limitToLast(40));
    this.fb.onChildAdded(q, (s) => cb({ ...s.val(), id: s.key }));
  }
  // ---------- video call signaling (WebRTC offers/answers/ICE over the database) ----------
  callJoin(pid, info) {
    const ref = this.r('call/peers/' + pid);
    this.fb.onDisconnect(ref).remove();
    this.fb.set(ref, { ...info, uid: this.uid, at: this.serverNow() });
    this.fb.onDisconnect(this.r('call/sig/' + pid)).remove();
  }
  callLeave(pid) { this.fb.remove(this.r('call/peers/' + pid)); this.fb.remove(this.r('call/sig/' + pid)); }
  onCallPeers(cb) { this.fb.onValue(this.r('call/peers'), (s) => cb(s.val() || {})); }
  sendSignal(to, msg) { this.fb.push(this.r('call/sig/' + to), { ...msg, uid: this.uid }); }
  onSignal(pid, cb) {
    this.fb.onChildAdded(this.r('call/sig/' + pid), (s) => { const v = s.val(); this.fb.remove(s.ref); cb(v); });
  }
  publishPrivate(key, data) {
    this.fb.set(this.fb.ref(this.db, `hostpriv/${key}`), JSON.parse(JSON.stringify({ ...data, uid: this.uid, at: this.serverNow() }))).catch(() => {});
  }
  onPrivate(key, cb) {
    this.fb.onValue(this.fb.ref(this.db, `hostpriv/${key}`), (s) => { if (s.exists()) cb(s.val()); });
  }
}
