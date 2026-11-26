// ============================================================
// GENERATIONS — "Play from anywhere" social layer
//   • Family chat (text + voice notes) stored per room
//   • Live video/voice calls: WebRTC mesh, signaled through the same
//     transport (Firebase in real games, BroadcastChannel in demo mode)
// Works on phones, the host TV, and the remote "watch" screen.
// ============================================================
import { iceServers } from './config.js';
import { esc } from './util.js';

export const VOICE_MAX_SEC = 30;
export const CHAT_MAX = 200;

// ---------- helpers ----------
export function timeAgo(at) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 45) return 'now';
  if (s < 3600) return Math.round(s / 60) + 'm';
  return Math.round(s / 3600) + 'h';
}
export function chatItemHTML(m, mePid) {
  const mine = m.pid === mePid;
  const who = `<span class="ch-name" style="color:${m.color || '#F2B632'}">${esc(m.name || 'Someone')}${m.where ? ` <small>${esc(m.where)}</small>` : ''}</span>`;
  let body;
  if (m.kind === 'voice') body = `<button class="ch-voice" data-act="playvoice" data-id="${esc(m.id || '')}" aria-label="Play voice note">▶ <span class="ch-wave"></span> ${Math.round(m.dur || 0)}s</button>`;
  else body = `<span class="ch-text">${esc(m.text || '')}</span>`;
  return `<div class="ch-msg ${mine ? 'mine' : ''}" data-mid="${esc(m.id || '')}">${who}${body}</div>`;
}

// ---------- voice notes ----------
export function canRecord() { return !!(navigator.mediaDevices && window.MediaRecorder); }
function pickMime() {
  const opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];
  for (const o of opts) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(o)) return o;
  return '';
}
// Starts recording right away; returns { stop(): Promise<{dataUrl, dur}>, cancel() }
export async function startVoiceNote(onTick) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const t0 = Date.now();
  let done, cancelled = false;
  const finished = new Promise((r) => { done = r; });
  rec.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    if (cancelled) return done(null);
    const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
    const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    done({ dataUrl, dur: Math.min(VOICE_MAX_SEC, (Date.now() - t0) / 1000) });
  };
  rec.start(250);
  const tick = setInterval(() => {
    const sec = (Date.now() - t0) / 1000;
    if (onTick) onTick(sec);
    if (sec >= VOICE_MAX_SEC && rec.state === 'recording') rec.stop();
  }, 200);
  return {
    stop() { clearInterval(tick); if (rec.state === 'recording') rec.stop(); return finished; },
    cancel() { cancelled = true; clearInterval(tick); if (rec.state === 'recording') rec.stop(); },
  };
}
let playing = null;
export function playVoice(dataUrl, onEnd) {
  try { if (playing) { playing.pause(); playing = null; } } catch (e) { /* */ }
  const a = new Audio(dataUrl);
  playing = a;
  a.onended = () => { if (playing === a) playing = null; if (onEnd) onEnd(); };
  return a.play().catch(() => { if (onEnd) onEnd(); });
}

// ---------- live video / voice (WebRTC mesh) ----------
// Perfect-negotiation pattern; only people who share a camera/mic add tracks,
// so a "watch-only" TV simply answers the offers it receives.
export class CallManager {
  constructor(T, me, { onChange } = {}) {
    this.T = T; this.me = me; this.onChange = onChange || (() => {});
    this.peers = new Map();   // pid -> { pc, stream, polite, makingOffer, ignoreOffer, state }
    this.info = {};           // pid -> { name, sending, where }
    this.local = null; this.joined = false; this.muted = false; this.camOff = false;
    this._wired = false;
  }
  get inCall() { return this.joined; }
  async join({ video = true, audio = true, send = true } = {}) {
    if (this.joined) return;
    if (send) {
      try {
        this.local = await navigator.mediaDevices.getUserMedia({
          audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
          video: video ? { width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 24 }, facingMode: 'user' } : false,
        });
      } catch (e) {
        this.local = null;
        throw e;
      }
    }
    this.joined = true;
    if (!this._wired) {
      this._wired = true;
      this.T.onSignal(this.me.pid, (m) => this._onSignal(m).catch((e) => console.warn('signal', e)));
      this.T.onCallPeers((map) => this._onPeers(map));
    }
    this.T.callJoin(this.me.pid, { name: this.me.name, sending: !!this.local, where: this.me.where || '' });
    this.onChange();
  }
  leave() {
    if (!this.joined) return;
    this.joined = false;
    this.T.callLeave(this.me.pid);
    for (const pid of [...this.peers.keys()]) this._close(pid);
    if (this.local) this.local.getTracks().forEach((t) => t.stop());
    this.local = null;
    this.onChange();
  }
  toggleMute() { this.muted = !this.muted; if (this.local) this.local.getAudioTracks().forEach((t) => { t.enabled = !this.muted; }); this.onChange(); }
  toggleCam() { this.camOff = !this.camOff; if (this.local) this.local.getVideoTracks().forEach((t) => { t.enabled = !this.camOff; }); this.onChange(); }
  _onPeers(map) {
    this.info = map || {};
    if (!this.joined) return this.onChange();
    for (const pid of Object.keys(this.info)) if (pid !== this.me.pid) this._ensure(pid);
    for (const pid of [...this.peers.keys()]) if (!this.info[pid]) this._close(pid);
    this.onChange();
  }
  _ensure(pid) {
    if (this.peers.has(pid)) return this.peers.get(pid);
    const pc = new RTCPeerConnection({ iceServers });
    const p = { pc, stream: null, polite: this.me.pid < pid, makingOffer: false, ignoreOffer: false, state: 'new' };
    this.peers.set(pid, p);
    pc.ontrack = (e) => { p.stream = e.streams[0] || new MediaStream([e.track]); this.onChange(); };
    pc.onicecandidate = (e) => { if (e.candidate) this.T.sendSignal(pid, { from: this.me.pid, cand: e.candidate.toJSON() }); };
    pc.onnegotiationneeded = async () => {
      try {
        p.makingOffer = true;
        await pc.setLocalDescription();
        this.T.sendSignal(pid, { from: this.me.pid, desc: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      } catch (e) { console.warn('offer', e); } finally { p.makingOffer = false; }
    };
    pc.onconnectionstatechange = () => {
      p.state = pc.connectionState;
      if (pc.connectionState === 'failed' && pc.restartIce) pc.restartIce();
      this.onChange();
    };
    if (this.local) this.local.getTracks().forEach((t) => pc.addTrack(t, this.local));
    return p;
  }
  _close(pid) {
    const p = this.peers.get(pid);
    if (p) { try { p.pc.close(); } catch (e) { /* */ } }
    this.peers.delete(pid);
  }
  async _onSignal(m) {
    if (!this.joined || !m || !m.from || m.from === this.me.pid) return;
    const p = this._ensure(m.from);
    const pc = p.pc;
    if (m.desc) {
      const collision = m.desc.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
      p.ignoreOffer = !p.polite && collision;
      if (p.ignoreOffer) return;
      await pc.setRemoteDescription(m.desc);
      if (m.desc.type === 'offer') {
        await pc.setLocalDescription();
        this.T.sendSignal(m.from, { from: this.me.pid, desc: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      }
    } else if (m.cand) {
      try { await pc.addIceCandidate(m.cand); } catch (e) { if (!p.ignoreOffer) console.warn('ice', e); }
    }
  }
  // everyone to show: [{pid, name, stream, me, state}]
  tiles() {
    const out = [];
    if (this.joined && this.local) out.push({ pid: this.me.pid, name: 'You', stream: this.local, me: true, state: 'connected' });
    for (const [pid, p] of this.peers) {
      const inf = this.info[pid] || {};
      if (!inf.sending && !p.stream) continue;
      out.push({ pid, name: inf.name || 'Family', where: inf.where, stream: p.stream, me: false, state: p.state });
    }
    return out;
  }
  count() { return Object.keys(this.info).length; }
}

// Keeps <video> elements alive across re-renders (the game redraws its HTML often).
export class VideoWall {
  constructor(el) { this.el = el; this.tiles = new Map(); }
  update(list) {
    const seen = new Set();
    for (const t of list) {
      seen.add(t.pid);
      let box = this.tiles.get(t.pid);
      if (!box) {
        box = document.createElement('div'); box.className = 'vw-tile' + (t.me ? ' me' : '');
        const v = document.createElement('video'); v.autoplay = true; v.playsInline = true; v.muted = !!t.me;
        const n = document.createElement('div'); n.className = 'vw-name';
        box.append(v, n); this.el.appendChild(box); this.tiles.set(t.pid, box);
      }
      const v = box.querySelector('video');
      if (t.stream && v.srcObject !== t.stream) { v.srcObject = t.stream; v.play().catch(() => {}); }
      box.querySelector('.vw-name').textContent = t.name + (t.where ? ' · ' + t.where : '');
      box.classList.toggle('waiting', !t.stream || (t.state && !['connected', 'completed'].includes(t.state) && !t.me));
    }
    for (const [pid, box] of this.tiles) if (!seen.has(pid)) { box.remove(); this.tiles.delete(pid); }
    this.el.classList.toggle('has-tiles', this.tiles.size > 0);
  }
}
