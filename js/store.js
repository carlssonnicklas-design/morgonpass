// Lokal lagring (localStorage) med skydd om lagringen inte är tillgänglig.
const KEY = 'morgonpass.v1';

const DEFAULTS = {
  settings: {
    apiKey: '',
    model: 'claude-opus-5-5',
    minutes: 25,          // önskad passlängd (20–30)
    level: 2,             // 1 nybörjare, 2 medel, 3 van
    trainDays: [1, 2, 3, 4, 5, 6, 0], // 0 = söndag
    voiceURI: '',
    rate: 1.0,
    voiceOn: true,
    beepOn: true,
    name: '',
  },
  week: null,       // { weekStart: 'YYYY-MM-DD', focus: [...], days: { 'YYYY-MM-DD': workout }, note, source }
  history: [],      // [{ date, workoutTitle, minutes, exercises: [ids], areas, rating, note, completed }]
  analysis: null,   // { date, text }
};

let state;
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : {};
    state = { ...structuredClone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...(s.settings || {}) } };
  } catch {
    state = structuredClone(DEFAULTS);
  }
}
load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* privat läge e.d. */ }
}
export const store = () => state;

export function exportData() { return JSON.stringify({ ...state, settings: { ...state.settings, apiKey: '' } }, null, 2); }
export function importData(json) {
  const s = JSON.parse(json);
  const key = state.settings.apiKey;
  state = { ...structuredClone(DEFAULTS), ...s, settings: { ...DEFAULTS.settings, ...(s.settings || {}), apiKey: s.settings?.apiKey || key } };
  save();
}

// ───── datumhjälp ─────
export const iso = (d) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
export const today = () => iso(new Date());
export function mondayOf(d = new Date()) {
  const x = new Date(d); x.setHours(12, 0, 0, 0);
  const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd);
  return iso(x);
}
export function addDays(isoDate, n) { const x = new Date(isoDate + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x); }
export const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
export const DAY_SHORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
export const weekday = (isoDate) => new Date(isoDate + 'T12:00:00').getDay();
