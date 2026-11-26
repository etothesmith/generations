// Family Question Editor — custom questions saved in this browser (localStorage),
// with JSON/CSV import & export so they can be backed up or shared.
import { esc } from './util.js';
import { DEFAULT_CATS } from './engine.js';

const KEY = 'gen-custom-questions';

export function loadCustom() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function saveCustom(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

function normalize(q, i) {
  const choices = (q.choices || [q.choiceA, q.choiceB, q.choiceC, q.choiceD]).filter((x) => x !== undefined && x !== null && String(x).trim() !== '').map(String);
  let ans = String(q.answer || '').trim();
  if (choices.length && !'ABCD'.includes(ans.toUpperCase())) {
    const idx = choices.findIndex((c) => c.toLowerCase() === ans.toLowerCase());
    ans = idx >= 0 ? 'ABCD'[idx] : 'A';
  }
  if (choices.length) ans = ans.toUpperCase();
  return {
    id: q.id && String(q.id).startsWith('custom-') ? q.id : `custom-${Date.now().toString(36)}-${i}`,
    round: +q.round || 1, category: String(q.category || 'Family History').trim(), value: +q.value || 200,
    questionType: q.questionType || 'trivia', generationEra: q.generationEra || 'all', difficulty: +q.difficulty || Math.max(1, Math.round((+q.value || 200) / 100)),
    prompt: String(q.prompt || '').trim(), choices, answer: ans, acceptAlso: q.acceptAlso || [],
    culturalContext: String(q.culturalContext || ''), needsReview: false, custom: true,
  };
}

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
function toCSV(list) {
  const cols = ['category', 'value', 'generationEra', 'prompt', 'choiceA', 'choiceB', 'choiceC', 'choiceD', 'answer', 'culturalContext'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(',')].concat(list.map((x) => [x.category, x.value, x.generationEra, x.prompt, ...(x.choices || []).concat(['', '', '', '']).slice(0, 4), x.answer, x.culturalContext].map(q).join(','))).join('\n');
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function openEditor(engine, onSaved) {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  document.body.appendChild(wrap);
  let editing = null;

  const draw = () => {
    const list = loadCustom();
    const cats = [...new Set(DEFAULT_CATS.concat(['Family History']).concat(list.map((q) => q.category)))];
    const e = editing || { category: 'Family History', value: 200, generationEra: 'all', prompt: '', choices: ['', '', '', ''], answer: 'A', culturalContext: '' };
    wrap.innerHTML = `<div class="box">
      <h2>Family Questions</h2>
      <p class="note">Add your own inside jokes and family history. They're saved in this browser and mixed into the board. Make a <b>new category</b> (like “Family History”) with at least 5 questions ($100–$500) and you can turn it on in the lobby's Board picker.</p>
      <div class="row2">
        <div><label>Category</label><input id="f-cat" list="catlist" value="${esc(e.category)}"><datalist id="catlist">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="row" style="grid-template-columns:1fr 1fr">
          <div><label>Value</label><select id="f-val">${[100, 200, 300, 400, 500].map((v) => `<option ${+e.value === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div><label>Generation</label><select id="f-era">${['all', 'elders', 'genx', 'millennial', 'genz'].map((v) => `<option ${e.generationEra === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
      </div>
      <label>Question</label><textarea id="f-q" placeholder="What year did Grandma Ruth open her shop?">${esc(e.prompt)}</textarea>
      <div class="row">${[0, 1, 2, 3].map((i) => `<div><label>Choice ${'ABCD'[i]}</label><input id="f-c${i}" value="${esc((e.choices || [])[i] || '')}"></div>`).join('')}</div>
      <div class="row2">
        <div><label>Correct choice</label><select id="f-ans">${'ABCD'.split('').map((L) => `<option ${e.answer === L ? 'selected' : ''}>${L}</option>`).join('')}</select></div>
        <div><label>Fun fact (shown after the answer)</label><input id="f-ctx" value="${esc(e.culturalContext)}"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn green" id="f-save">${editing ? 'Save Changes' : 'Add Question'}</button>
        ${editing ? '<button class="btn ghost" style="color:#2B2B2B;border-color:#2B2B2B" id="f-cancel">Cancel edit</button>' : ''}
        <span style="flex:1"></span>
        <label class="btn navy" style="margin:0">Import JSON/CSV<input type="file" id="f-imp" accept=".json,.csv" hidden></label>
        <button class="btn navy" id="f-expj">Export JSON</button>
        <button class="btn navy" id="f-expc">Export CSV</button>
        <button class="btn red" id="f-close">Done</button>
      </div>
      <p class="note">CSV columns: <code>category, value, generationEra, prompt, choiceA, choiceB, choiceC, choiceD, answer, culturalContext</code> (answer = A/B/C/D or the exact choice text).</p>
      <div class="list"><b>${list.length} custom question${list.length === 1 ? '' : 's'}</b>
        ${list.map((q, i) => `<div class="item"><span>${esc(q.category)} · $${q.value}</span><span class="grow">${esc(q.prompt)}</span><button data-edit="${i}">Edit</button><button data-del="${i}">Delete</button></div>`).join('')}
      </div>
    </div>`;

    wrap.querySelector('#f-save').onclick = () => {
      const q = normalize({
        id: editing && editing.id, category: wrap.querySelector('#f-cat').value, value: wrap.querySelector('#f-val').value,
        generationEra: wrap.querySelector('#f-era').value, prompt: wrap.querySelector('#f-q').value,
        choices: [0, 1, 2, 3].map((i) => wrap.querySelector('#f-c' + i).value), answer: wrap.querySelector('#f-ans').value,
        culturalContext: wrap.querySelector('#f-ctx').value,
      }, list.length);
      if (!q.prompt || q.choices.length < 2) { alert('Add a question and at least 2 choices.'); return; }
      const all = loadCustom();
      const at = all.findIndex((x) => x.id === q.id);
      if (at >= 0) all[at] = q; else all.push(q);
      saveCustom(all); editing = null; draw(); onSaved();
    };
    const c = wrap.querySelector('#f-cancel'); if (c) c.onclick = () => { editing = null; draw(); };
    wrap.querySelector('#f-close').onclick = () => wrap.remove();
    wrap.querySelector('#f-expj').onclick = () => download('generations-family-questions.json', JSON.stringify(loadCustom(), null, 1), 'application/json');
    wrap.querySelector('#f-expc').onclick = () => download('generations-family-questions.csv', toCSV(loadCustom()), 'text/csv');
    wrap.querySelector('#f-imp').onchange = async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      const text = await f.text();
      let rows;
      try { rows = f.name.endsWith('.csv') ? parseCSV(text) : JSON.parse(text); } catch (err) { alert('Could not read that file: ' + err.message); return; }
      if (!Array.isArray(rows)) rows = [rows];
      const added = rows.map(normalize).filter((q) => q.prompt);
      saveCustom(loadCustom().concat(added));
      alert(`Imported ${added.length} question(s).`);
      draw(); onSaved();
    };
    wrap.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => { editing = loadCustom()[+b.dataset.edit]; draw(); }; });
    wrap.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => { const all = loadCustom(); all.splice(+b.dataset.del, 1); saveCustom(all); draw(); onSaved(); }; });
  };
  draw();
}
