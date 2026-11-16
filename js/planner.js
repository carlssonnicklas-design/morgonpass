// Regelmotor som bygger pass och veckoplaner. Används direkt, eller för att
// bygga färdiga pass utifrån Claudes val av övningar.
import { EXERCISES, byId, AREAS } from './exercises.js';
import { addDays, weekday, DAY_NAMES } from './store.js';

// Dagens tema per veckodag (0 = söndag). Vikter per kroppsområde.
export const THEMES = {
  1: { title: 'Helkropp', w: { ben: 1, rumpa: 1, bal: 1, brost: 1, rygg: 1, axlar: 1, armar: .7, kondition: .8 } },
  2: { title: 'Ben, rumpa & bål', w: { ben: 2, rumpa: 2, bal: 1.4, kondition: .5 } },
  3: { title: 'Överkropp', w: { brost: 2, axlar: 1.6, armar: 1.6, rygg: 1.6, bal: .6 } },
  4: { title: 'Kondition & bål', w: { kondition: 2.2, bal: 1.6, ben: .6 } },
  5: { title: 'Helkropp, styrka', w: { ben: 1.2, rumpa: 1, brost: 1.2, rygg: 1.2, axlar: 1, armar: 1, bal: 1 } },
  6: { title: 'Kondition & ben', w: { kondition: 2, ben: 1.6, rumpa: 1.2, bal: .6 } },
  0: { title: 'Rörlighet & bål (lätt)', w: { bal: 1.6, rygg: 1.2, rumpa: 1, rorlighet: 2 }, light: true },
};

// Arbete/vila (sekunder) per nivå
export const INTERVALS = { 1: [30, 30], 2: [40, 20], 3: [45, 15] };
const WARM_SEC = 30, COOL_SEC = 30, COOL_SIDED = 40, SWITCH = 5, ROUND_REST = 45, PREP = 10;

function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const areaScore = (ex, w) => ex.areas.reduce((s, a, i) => s + (w[a] || 0) * (i === 0 ? 1 : 0.5), 0);

function pickMain(weights, n, level, recent, rand) {
  const w = { ...weights };
  const pool = EXERCISES.filter((e) => e.phase === 'main' && e.level <= Math.min(3, level + 1));
  const chosen = [];
  const usedAnims = new Set();
  while (chosen.length < n) {
    let best = null, bestS = -1;
    for (const e of pool) {
      if (chosen.includes(e) || usedAnims.has(e.anim)) continue;
      let s = areaScore(e, w);
      if (recent.has(e.id)) s *= 0.35;
      if (e.level > level) s *= 0.4;
      if (e.level < level - 1) s *= 0.6;
      s *= 0.6 + rand() * 0.8;
      if (s > bestS) { bestS = s; best = e; }
    }
    if (!best) break;
    chosen.push(best); usedAnims.add(best.anim);
    w[best.areas[0]] = (w[best.areas[0]] || 0) * 0.55; // sprid över fler områden
  }
  return chosen;
}

function pickWarmup(weights, rand, count = 9) {
  const pool = EXERCISES.filter((e) => e.phase === 'warmup');
  const pulse = ['march', 'jumping-jacks', 'shadow-box-wu'];
  const first = byId[pulse[Math.floor(rand() * pulse.length)]];
  const rest = pool.filter((e) => !pulse.includes(e.id))
    .map((e) => ({ e, s: (areaScore(e, weights) + 1) * (0.5 + rand()) + (e.source?.startsWith('PRT') ? 0.8 : 0) }))
    .sort((a, b) => b.s - a.s).slice(0, count - 1).map((x) => x.e)
    .sort((a, b) => pool.indexOf(a) - pool.indexOf(b)); // behåll PRT-ordningen
  return [first, ...rest];
}

function pickCooldown(weights, rand, count = 8) {
  const pool = EXERCISES.filter((e) => e.phase === 'cooldown' && e.id !== 'deep-breathing');
  const picked = pool.map((e) => ({ e, s: (areaScore(e, weights) + 1) * (0.6 + rand() * 0.8) }))
    .sort((a, b) => b.s - a.s).slice(0, count - 1).map((x) => x.e)
    .sort((a, b) => pool.indexOf(a) - pool.indexOf(b));
  return [...picked, byId['deep-breathing']];
}

const blockSec = (items) => items.reduce((s, it) => s + it.sec, 0) + Math.max(0, items.length - 1) * SWITCH;

// Bygg ett pass från valda övningar och anpassa varv efter önskad längd.
export function buildWorkout({ date, title, theme, focus = [], warmup, main, cooldown, work, rest, minutes, note = '', source = 'regler' }) {
  const wItems = warmup.map((e) => ({ id: e.id, sec: WARM_SEC }));
  const cItems = cooldown.map((e) => ({ id: e.id, sec: e.sides ? COOL_SIDED : COOL_SEC }));
  const budget = minutes * 60 - PREP - blockSec(wItems) - blockSec(cItems);

  // Välj antal övningar och varv som ligger närmast tidsbudgeten
  let best = null;
  for (let k = Math.min(main.length, 6); k >= Math.min(3, main.length); k--) {
    for (let r = 2; r <= 4; r++) {
      const t = r * k * work + r * (k - 1) * rest + (r - 1) * ROUND_REST;
      // fler olika övningar är bättre än många varv; undvik att dra över tiden
      const d = Math.abs(t - budget) + (t > budget + 60 ? 200 : 0) + (6 - k) * 40 + (r === 4 ? 30 : 0);
      if (!best || d < best.d) best = { k, r, d };
    }
  }
  const mainSel = main.slice(0, best.k);
  return {
    date, title, theme, focus, minutes, note, source,
    work, rest, rounds: best.r, roundRest: ROUND_REST,
    warmup: wItems,
    main: mainSel.map((e) => ({ id: e.id, sec: work })),
    cooldown: cItems,
  };
}

export function ruleWorkout(date, { focus = [], settings, recentIds = new Set() }) {
  const wd = weekday(date);
  const th = THEMES[wd];
  const rand = rng(date + focus.join(','));
  const weights = { ...th.w };
  for (const f of focus) weights[f] = (weights[f] || 0) + (th.light ? 0.8 : 1.6);
  const level = th.light ? Math.max(1, settings.level - 1) : settings.level;
  const main = pickMain(weights, 6, level, recentIds, rand);
  const [work, rest] = INTERVALS[level];
  const focusTxt = focus.length ? ` · fokus ${focus.map((f) => AREAS[f].toLowerCase()).join(', ')}` : '';
  return buildWorkout({
    date, title: th.title, theme: `${DAY_NAMES[wd]}: ${th.title}${focusTxt}`, focus,
    warmup: pickWarmup(weights, rand), main, cooldown: pickCooldown(weights, rand),
    work, rest, minutes: settings.minutes,
  });
}

export function ruleWeek(weekStart, focus, settings, history) {
  const recent = new Set(history.slice(-3).flatMap((h) => h.exercises || []));
  const days = {};
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (!settings.trainDays.includes(weekday(d))) continue;
    const w = ruleWorkout(d, { focus, settings, recentIds: recent });
    w.main.forEach((m) => recent.add(m.id));
    days[d] = w;
  }
  return { weekStart, focus, days, note: '', source: 'regler' };
}

// Platta ut passet till en tidslinje av steg för spelaren.
export function timeline(w) {
  const steps = [];
  const first = w.warmup[0]?.id;
  steps.push({ kind: 'prep', sec: PREP, phase: 'warmup', next: first });
  const addBlock = (items, phase) => items.forEach((it, i) => {
    steps.push({ kind: 'work', id: it.id, sec: it.sec, phase });
    if (i < items.length - 1) steps.push({ kind: 'switch', sec: SWITCH, phase, next: items[i + 1].id });
  });
  addBlock(w.warmup, 'warmup');
  steps.push({ kind: 'rest', sec: 20, phase: 'main', next: w.main[0]?.id, label: 'Uppvärmningen klar' });
  for (let r = 1; r <= w.rounds; r++) {
    w.main.forEach((it, i) => {
      steps.push({ kind: 'work', id: it.id, sec: it.sec, phase: 'main', round: r, rounds: w.rounds });
      const last = i === w.main.length - 1;
      if (!last) steps.push({ kind: 'rest', sec: w.rest, phase: 'main', next: w.main[i + 1].id, round: r, rounds: w.rounds });
      else if (r < w.rounds) steps.push({ kind: 'rest', sec: w.roundRest, phase: 'main', next: w.main[0].id, label: `Varv ${r} klart`, round: r, rounds: w.rounds });
    });
  }
  steps.push({ kind: 'rest', sec: 15, phase: 'cooldown', next: w.cooldown[0]?.id, label: 'Bra jobbat! Dags att stretcha' });
  addBlock(w.cooldown, 'cooldown');
  let t = 0;
  for (const s of steps) { s.start = t; t += s.sec; }
  return { steps, total: t };
}

export const workoutAreas = (w) => [...new Set(w.main.flatMap((m) => byId[m.id]?.areas || []))];
