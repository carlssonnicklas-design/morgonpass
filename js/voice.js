// Röstcoach (Web Speech API), pip-ljud (Web Audio) och skärmlås (Wake Lock).
import { store } from './store.js';

const synth = window.speechSynthesis;
let voices = [];
function loadVoices() { voices = synth ? synth.getVoices() : []; }
if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }

export function swedishVoices() {
  loadVoices();
  const sv = voices.filter((v) => v.lang?.toLowerCase().startsWith('sv'));
  return sv.length ? sv : voices;
}

function pickVoice() {
  const s = store().settings;
  const list = swedishVoices();
  return list.find((v) => v.voiceURI === s.voiceURI) || list.find((v) => /sv/i.test(v.lang)) || null;
}

export function say(text, { interrupt = false } = {}) {
  const s = store().settings;
  if (!s.voiceOn || !synth || !text) return;
  if (interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'sv-SE';
  u.rate = s.rate || 1;
  synth.speak(u);
}
export const stopSpeech = () => synth && synth.cancel();

// iOS kräver att tal och ljud startas från en användarhandling första gången
let ctx;
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    if (synth) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); }
  } catch { /* ignore */ }
}

export function beep(freq = 880, ms = 140, vol = 0.25) {
  if (!store().settings.beepOn) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + ms / 1000 + 0.02);
  } catch { /* ignore */ }
}

let lock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) { lock = await navigator.wakeLock.request('screen'); }
    else if (!on && lock) { await lock.release(); lock = null; }
  } catch { /* ignore */ }
}
document.addEventListener('visibilitychange', () => { if (lock && document.visibilityState === 'visible') keepAwake(true); });

// Svenska tal-hjälpare
export function secText(s) {
  if (s >= 60) {
    const m = Math.floor(s / 60), r = s % 60;
    const mt = m === 1 ? 'en minut' : `${m} minuter`;
    return r ? `${mt} och ${r} sekunder` : mt;
  }
  return `${s} sekunder`;
}
