import { EXERCISES, byId, AREAS } from './exercises.js';
import { store, save, today, mondayOf, addDays, weekday, DAY_NAMES, DAY_SHORT, exportData, importData } from './store.js';
import { ruleWeek, ruleWorkout, timeline, workoutAreas } from './planner.js';
import { planWeekWithClaude, analyzeProgress, testKey, friendlyError } from './claude.js';
import { Player } from './player.js';
import { Coach } from './animations.js';
import { swedishVoices, say, unlockAudio } from './voice.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = store();
let pendingFocus = [];

// ───────── navigation ─────────
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.s === id));
  window.scrollTo(0, 0);
  ({ 's-today': renderToday, 's-week': renderWeek, 's-lib': renderLib, 's-hist': renderHist, 's-set': renderSettings })[id]?.();
}
$('tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.s); };

// ───────── veckoplan ─────────
const currentWeekStart = () => mondayOf(new Date());
const hasCurrentWeek = () => S.week && S.week.weekStart === currentWeekStart();

function focusChips(container, selected, onChange) {
  container.replaceChildren();
  for (const [k, v] of Object.entries(AREAS)) {
    const b = document.createElement('button');
    b.className = 'chip' + (selected.includes(k) ? ' on' : '');
    b.textContent = v;
    b.onclick = () => {
      const i = selected.indexOf(k);
      if (i >= 0) selected.splice(i, 1);
      else { if (selected.length >= 3) selected.shift(); selected.push(k); }
      focusChips(container, selected, onChange); onChange?.();
    };
    container.appendChild(b);
  }
}

async function makeWeek(useClaude, statusEl, focus) {
  const weekStart = currentWeekStart();
  statusEl.innerHTML = useClaude ? '<span class="spinner"></span> Claude planerar din vecka… (kan ta en halv minut)' : '';
  try {
    let wk;
    if (useClaude) {
      wk = await planWeekWithClaude({ weekStart, focus: [...focus], settings: S.settings, history: S.history });
      // fyll eventuella luckor med regelmotorn
      const fallback = ruleWeek(weekStart, focus, S.settings, S.history);
      for (const d of wk.missing || []) if (fallback.days[d]) wk.days[d] = fallback.days[d];
    } else {
      wk = ruleWeek(weekStart, [...focus], S.settings, S.history);
    }
    // behåll redan genomförda dagar
    if (S.week?.weekStart === weekStart) for (const [d, w] of Object.entries(S.week.days)) if (w.done) wk.days[d] = w;
    S.week = wk; save();
    statusEl.textContent = useClaude ? 'Klart! Veckan är planerad av Claude.' : 'Klart!';
    return true;
  } catch (err) {
    console.error(err);
    statusEl.textContent = `${friendlyError(err)} Veckan planerades med den inbyggda regelmotorn i stället.`;
    S.week = ruleWeek(weekStart, [...focus], S.settings, S.history); save();
    return false;
  }
}

function todaysWorkout() {
  const d = today();
  if (hasCurrentWeek() && S.week.days[d]) return S.week.days[d];
  // Vilodag eller ingen plan: skapa ett pass ändå om användaren vill
  return null;
}

// ───────── IDAG ─────────
function renderToday() {
  const d = today();
  const wd = weekday(d);
  $('today-date').textContent = `${DAY_NAMES[wd]} ${new Date().toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}`;
  const h = new Date().getHours();
  $('greeting').textContent = h < 10 ? 'God morgon' : h < 18 ? 'Hej' : 'God kväll';

  const needPlan = !hasCurrentWeek();
  $('focus-prompt').hidden = !needPlan;
  if (needPlan) {
    pendingFocus = [...(S.week?.focus || [])];
    focusChips($('focus-chips'), pendingFocus);
    $('btn-plan-claude').disabled = !S.settings.apiKey;
    if (!S.settings.apiKey) $('plan-status').textContent = 'Lägg in en API-nyckel under Inställningar för att låta Claude planera.';
  }

  const card = $('today-card');
  const w = todaysWorkout();
  if (needPlan) card.innerHTML = '';
  else if (!w) {
    card.innerHTML = `<div class="card"><h2>Vilodag</h2><p class="muted">Idag är ingen träningsdag enligt din plan. Vill du ändå köra?</p>
      <button class="primary big" id="btn-extra">Skapa ett pass för idag</button></div>`;
    $('btn-extra').onclick = () => { S.week.days[d] = ruleWorkout(d, { focus: S.week.focus, settings: S.settings }); save(); renderToday(); };
  } else card.replaceChildren(workoutCard(w, true));

  renderStrip();
}

function workoutCard(w, isToday) {
  const div = document.createElement('div');
  div.className = 'card';
  const { total } = timeline(w);
  const list = (title, items, extra = '') => `<div class="phase-h">${title}${extra}</div><ul class="plan-list">${items.map((it) =>
    `<li><a href="#" data-ex="${it.id}">${esc(byId[it.id].name)}</a><span class="muted small">${it.sec} s</span></li>`).join('')}</ul>`;
  div.innerHTML = `
    <div class="row between"><h2 style="margin:0">${esc(w.title)}</h2>${w.done ? '<span class="tag">✓ Klart</span>' : ''}</div>
    <p class="muted small">${Math.round(total / 60)} min · ${w.main.length} övningar × ${w.rounds} varv · ${w.work}/${w.rest} s${w.source === 'claude' ? ' · planerat av Claude' : ''}</p>
    ${w.note ? `<div class="coach-note small">${esc(w.note)}</div>` : ''}
    <div style="margin:8px 0">${workoutAreas(w).map((a) => `<span class="tag">${AREAS[a]}</span>`).join('')}</div>
    ${isToday ? '<button class="primary big" data-start>▶ Starta passet</button>' : ''}
    <details style="margin-top:10px"><summary class="small">Visa alla moment</summary>
      ${list('Uppvärmning', w.warmup)}${list('Huvudpass', w.main, ` · ${w.rounds} varv, ${w.rest} s vila`)}${list('Stretchning', w.cooldown)}
    </details>
    ${isToday && !w.done ? '<button class="ghost" data-shuffle style="margin-top:8px;width:100%">Byt ut dagens huvudövningar</button>' : ''}`;
  div.querySelector('[data-start]')?.addEventListener('click', () => { unlockAudio(); player.start(w); });
  div.querySelector('[data-shuffle]')?.addEventListener('click', () => {
    const fresh = ruleWorkout(w.date, { focus: S.week.focus, settings: S.settings, recentIds: new Set(w.main.map((m) => m.id)) });
    S.week.days[w.date] = { ...fresh, title: w.title, note: w.note }; save(); renderToday();
  });
  div.querySelectorAll('[data-ex]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openExercise(a.dataset.ex); }));
  return div;
}

function renderStrip() {
  const strip = $('week-strip');
  strip.replaceChildren();
  const ws = currentWeekStart();
  $('week-focus').textContent = hasCurrentWeek() && S.week.focus.length ? 'Fokus: ' + S.week.focus.map((f) => AREAS[f]).join(', ') : '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    const w = hasCurrentWeek() ? S.week.days[d] : null;
    const el = document.createElement('div');
    el.className = 'day' + (d === today() ? ' today' : '') + (w?.done ? ' done' : '') + (!w ? ' rest' : '');
    el.innerHTML = `<b>${DAY_SHORT[weekday(d)]}</b>${w ? (w.done ? '✓' : esc(w.title.split(/[ ,&]/)[0])) : 'Vila'}`;
    el.onclick = () => show('s-week');
    strip.appendChild(el);
  }
}

// ───────── VECKA ─────────
let replanFocus = [];
function renderWeek() {
  const list = $('week-list');
  list.replaceChildren();
  if (!hasCurrentWeek()) { list.innerHTML = '<p class="muted">Ingen plan för veckan ännu. Välj fokus nedan.</p>'; }
  else {
    $('week-note').innerHTML = S.week.note ? `<div class="coach-note small" style="margin-bottom:12px">${esc(S.week.note)}</div>` : '';
    const ws = currentWeekStart();
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const w = S.week.days[d];
      const h = document.createElement('h3');
      h.textContent = `${DAY_NAMES[weekday(d)]}${d === today() ? ' (idag)' : ''}`;
      h.style.margin = '14px 0 6px';
      list.appendChild(h);
      if (w) list.appendChild(workoutCard(w, d === today()));
      else { const p = document.createElement('p'); p.className = 'muted small'; p.textContent = 'Vila'; list.appendChild(p); }
    }
  }
  replanFocus = [...(S.week?.focus || [])];
  focusChips($('focus-chips-2'), replanFocus);
  $('btn-replan-claude').disabled = !S.settings.apiKey;
}

$('btn-plan-claude').onclick = async () => { const b = $('btn-plan-claude'); b.disabled = true; await makeWeek(true, $('plan-status'), pendingFocus); b.disabled = false; renderToday(); };
$('btn-plan-rules').onclick = async () => { await makeWeek(false, $('plan-status'), pendingFocus); renderToday(); };
$('btn-replan-claude').onclick = async () => { const b = $('btn-replan-claude'); b.disabled = true; await makeWeek(true, $('replan-status'), replanFocus); b.disabled = false; renderWeek(); };
$('btn-replan-rules').onclick = async () => { await makeWeek(false, $('replan-status'), replanFocus); renderWeek(); };

// ───────── BIBLIOTEK ─────────
let libFilter = 'alla';
let miniCoaches = [];
function renderLib() {
  const f = $('lib-filter');
  f.replaceChildren();
  const opts = { alla: 'Alla', warmup: 'Uppvärmning', main: 'Huvudpass', cooldown: 'Stretch', ...AREAS };
  for (const [k, v] of Object.entries(opts)) {
    const b = document.createElement('button');
    b.className = 'chip' + (libFilter === k ? ' on' : '');
    b.textContent = v;
    b.onclick = () => { libFilter = k; renderLib(); };
    f.appendChild(b);
  }
  const q = $('lib-search').value.trim().toLowerCase();
  const items = EXERCISES.filter((e) => (libFilter === 'alla' || e.phase === libFilter || e.areas.includes(libFilter)) &&
    (!q || e.name.toLowerCase().includes(q)));
  miniCoaches.forEach((c) => c.destroy()); miniCoaches = [];
  const list = $('lib-list');
  list.replaceChildren();
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting && !en.target.dataset.done) {
      en.target.dataset.done = 1;
      const c = new Coach(en.target); c.set(byId[en.target.dataset.id].anim); miniCoaches.push(c);
    }
  }));
  for (const e of items) {
    const card = document.createElement('div');
    card.className = 'card lib-item';
    card.innerHTML = `<div class="coach-mini" data-id="${e.id}"></div><div><b>${esc(e.name)}</b><div class="small muted">${'●'.repeat(e.level)}${'○'.repeat(3 - e.level)} · ${e.source || ''}</div>
      <div>${e.areas.map((a) => `<span class="tag">${AREAS[a]}</span>`).join('')}</div></div>`;
    card.onclick = () => openExercise(e.id);
    list.appendChild(card);
    io.observe(card.querySelector('.coach-mini'));
  }
  $('lib-list').insertAdjacentHTML('afterbegin', `<p class="small muted">${items.length} övningar</p>`);
}
$('lib-search').oninput = () => renderLib();

let dlgCoach;
function openExercise(id) {
  const e = byId[id];
  const d = $('dlg-ex');
  d.innerHTML = `<div style="width:min(70vw,260px);aspect-ratio:1;margin:0 auto" id="dlg-coach"></div>
    <h2>${esc(e.name)}</h2><p class="small muted">${{ warmup: 'Uppvärmning', main: 'Huvudpass', cooldown: 'Stretchning' }[e.phase]} · nivå ${e.level}${e.sides ? ' · båda sidor' : ''}${e.source ? ' · ' + esc(e.source) : ''}</p>
    <p>${esc(e.desc)}</p><ul>${e.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <div class="row"><button id="dlg-say">🔊 Läs upp</button><button class="primary" id="dlg-close" style="margin-left:auto">Stäng</button></div>`;
  dlgCoach?.destroy();
  dlgCoach = new Coach($('dlg-coach')); dlgCoach.set(e.anim);
  $('dlg-close').onclick = () => d.close();
  $('dlg-say').onclick = () => { unlockAudio(); say(`${e.name}. ${e.desc} ${e.cues.join('. ')}.`, { interrupt: true }); };
  d.onclose = () => { dlgCoach?.destroy(); dlgCoach = null; };
  d.showModal();
}

// ───────── HISTORIK ─────────
function renderHist() {
  const H = S.history;
  const done = H.filter((h) => h.completed);
  const minutes = Math.round(H.reduce((s, h) => s + (h.seconds || 0), 0) / 60);
  let streak = 0;
  const days = new Set(done.map((h) => h.date));
  for (let d = days.has(today()) ? today() : addDays(today(), -1); days.has(d); d = addDays(d, -1)) streak++;
  $('stats').innerHTML = `<div><b>${done.length}</b><span class="small muted">pass</span></div><div><b>${minutes}</b><span class="small muted">minuter</span></div><div><b>${streak}</b><span class="small muted">dagar i rad</span></div>`;

  const since = addDays(today(), -28);
  const counts = {};
  for (const h of H.filter((x) => x.date >= since)) for (const id of h.exercises || []) for (const a of byId[id]?.areas || []) counts[a] = (counts[a] || 0) + 1;
  const max = Math.max(1, ...Object.values(counts));
  $('area-bars').innerHTML = Object.entries(AREAS).map(([k, v]) => `<div class="small" style="margin:6px 0">${v}<div class="bar thin"><i style="width:${(100 * (counts[k] || 0)) / max}%"></i></div></div>`).join('');

  $('hist-list').innerHTML = H.length ? H.slice().reverse().slice(0, 60).map((h) =>
    `<li><span>${h.date} · ${esc(h.workoutTitle)}${h.completed ? '' : ' (avbrutet)'}</span><span class="muted small">${Math.round((h.seconds || 0) / 60)} min${h.rating ? ' · ' + esc(h.rating) : ''}</span></li>`).join('')
    : '<li class="muted">Inga pass ännu.</li>';
  if (S.analysis) $('analysis').innerHTML = `<div class="coach-note">${esc(S.analysis.text)}</div><div class="small muted" style="margin-top:4px">${S.analysis.date}</div>`;
  $('btn-analyze').disabled = !S.settings.apiKey || !H.length;
}
$('btn-analyze').onclick = async () => {
  const el = $('analysis');
  el.innerHTML = '<span class="spinner"></span> Claude analyserar…';
  try {
    const text = await analyzeProgress({ settings: S.settings, history: S.history, week: S.week });
    S.analysis = { date: today(), text }; save(); renderHist();
  } catch (err) { el.textContent = friendlyError(err); }
};

// ───────── INSTÄLLNINGAR ─────────
function renderSettings() {
  const s = S.settings;
  $('set-min').value = s.minutes; $('min-val').textContent = s.minutes;
  $('set-level').value = s.level;
  $('set-voice').checked = s.voiceOn; $('set-beep').checked = s.beepOn;
  $('set-rate').value = s.rate; $('rate-val').textContent = s.rate.toFixed(2);
  $('set-key').value = s.apiKey;
  $('set-model').value = s.model;
  const dd = $('set-days'); dd.replaceChildren();
  [1, 2, 3, 4, 5, 6, 0].forEach((wd) => {
    const b = document.createElement('button');
    b.className = 'chip' + (s.trainDays.includes(wd) ? ' on' : '');
    b.textContent = DAY_SHORT[wd];
    b.onclick = () => { const i = s.trainDays.indexOf(wd); i >= 0 ? s.trainDays.splice(i, 1) : s.trainDays.push(wd); save(); renderSettings(); };
    dd.appendChild(b);
  });
  const vs = swedishVoices();
  $('set-voiceuri').innerHTML = '<option value="">Standard (svenska)</option>' + vs.map((v) => `<option value="${esc(v.voiceURI)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
  $('set-voiceuri').value = s.voiceURI;
}
const bindSet = (id, key, conv = (v) => v, prop = 'value') => $(id).addEventListener('change', () => { S.settings[key] = conv($(id)[prop]); save(); renderSettings(); });
bindSet('set-min', 'minutes', Number); $('set-min').oninput = () => ($('min-val').textContent = $('set-min').value);
bindSet('set-level', 'level', Number);
bindSet('set-voice', 'voiceOn', Boolean, 'checked');
bindSet('set-beep', 'beepOn', Boolean, 'checked');
bindSet('set-rate', 'rate', Number); $('set-rate').oninput = () => ($('rate-val').textContent = Number($('set-rate').value).toFixed(2));
bindSet('set-key', 'apiKey', (v) => v.trim());
bindSet('set-model', 'model');
bindSet('set-voiceuri', 'voiceURI');
$('btn-test-voice').onclick = () => { unlockAudio(); say('Armhävningar. Fyrtio sekunder. Kroppen rak som en planka. Tio sekunder kvar!', { interrupt: true }); };
$('btn-test-key').onclick = async () => {
  S.settings.apiKey = $('set-key').value.trim(); save();
  $('key-status').innerHTML = '<span class="spinner"></span>';
  try { await testKey(S.settings); $('key-status').textContent = '✓ Nyckeln fungerar'; }
  catch (err) { $('key-status').textContent = '✗ ' + friendlyError(err); }
};
$('btn-export').onclick = () => {
  const blob = new Blob([exportData()], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `morgonpass-${today()}.json`; a.click();
};
$('imp').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { importData(await f.text()); alert('Importerat!'); location.reload(); } catch { alert('Kunde inte läsa filen.'); }
};

// ───────── efter passet ─────────
let lastResult = null, rating = '';
const player = new Player((res) => {
  lastResult = res; rating = '';
  document.querySelectorAll('#done-rating button').forEach((b) => b.classList.remove('on'));
  $('done-note').value = '';
  $('done-summary').textContent = res.completed
    ? `Du körde ${Math.round(res.seconds / 60)} minuter: ${res.workout.title}.`
    : `Passet avbröts efter ${Math.round(res.seconds / 60)} minuter.`;
  if (res.seconds < 60) { renderToday(); return; }
  $('dlg-done').showModal();
});
$('done-rating').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  rating = b.dataset.r;
  document.querySelectorAll('#done-rating button').forEach((x) => x.classList.toggle('on', x === b));
};
$('done-save').onclick = () => {
  const r = lastResult, w = r.workout;
  S.history.push({
    date: today(), workoutTitle: w.title, seconds: r.seconds, completed: r.completed,
    exercises: w.main.map((m) => m.id), areas: workoutAreas(w), rating, note: $('done-note').value.trim(),
  });
  if (r.completed && S.week?.days[w.date]) S.week.days[w.date].done = true;
  save();
  $('dlg-done').close();
  renderToday();
};

// ───────── start ─────────
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
show('s-today');
