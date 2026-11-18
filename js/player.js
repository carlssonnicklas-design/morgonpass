// Kör ett pass: timer, röstinstruktioner, progress och tränarfigur.
import { byId, videoFor } from './exercises.js';
import { timeline } from './planner.js';
import { say, beep, stopSpeech, keepAwake, secText, unlockAudio } from './voice.js';
import { Coach } from './animations.js';

const PHASE_TXT = { warmup: 'Uppvärmning', main: 'Huvudpass', cooldown: 'Stretchning' };
const $ = (id) => document.getElementById(id);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

export class Player {
  constructor(onFinish) {
    this.onFinish = onFinish;
    this.coach = new Coach($('p-coach'));
    $('p-pause').onclick = () => this.togglePause();
    $('p-next').onclick = () => this.jump(1);
    $('p-prev').onclick = () => this.jump(-1);
    $('p-close').onclick = () => { if (confirm('Avsluta passet?')) this.finish(false); };
  }

  start(workout) {
    unlockAudio();
    this.w = workout;
    const { steps, total } = timeline(workout);
    this.steps = steps; this.total = total;
    this.i = -1; this.paused = false; this.done = false;
    this.startedAt = Date.now(); this.pausedMs = 0;
    $('player').classList.add('active');
    document.body.style.overflow = 'hidden';
    keepAwake(true);
    this.enter(0);
    clearInterval(this.iv);
    this.iv = setInterval(() => this.tick(), 200);
  }

  enter(i) {
    this.i = i;
    const s = this.steps[i];
    this.stepEnd = performance.now() + s.sec * 1000;
    this.spoken = new Set();
    this.render(s);
    this.announce(s);
  }

  jump(d) {
    const n = Math.min(this.steps.length - 1, Math.max(0, this.i + d));
    stopSpeech();
    this.enter(n);
    if (this.paused) { this.remaining = this.steps[n].sec * 1000; }
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) { this.remaining = this.stepEnd - performance.now(); this.pauseStart = Date.now(); stopSpeech(); say('Paus'); }
    else { this.stepEnd = performance.now() + this.remaining; this.pausedMs += Date.now() - this.pauseStart; say('Kör igen'); }
    this.coach.pause(this.paused);
    $('p-pause').textContent = this.paused ? '▶ Fortsätt' : '❚❚ Paus';
  }

  tick() {
    if (this.paused || this.done) return;
    const s = this.steps[this.i];
    const left = (this.stepEnd - performance.now()) / 1000;
    const el = s.sec - left;
    this.cues(s, left, el);
    this.progress(s, Math.max(0, left), el);
    if (left <= 0) {
      if (this.i >= this.steps.length - 1) this.finish(true);
      else this.enter(this.i + 1);
    }
  }

  once(key, fn) { if (!this.spoken.has(key)) { this.spoken.add(key); fn(); } }

  announce(s) {
    const ex = byId[s.id] || byId[s.next];
    if (s.kind === 'prep') {
      say(`God morgon! Dagens pass: ${this.w.title}, cirka ${Math.round(this.total / 60)} minuter. Vi börjar med uppvärmning. Första övningen är ${ex.name}. Gör dig redo.`, { interrupt: true });
    } else if (s.kind === 'work') {
      let t = `${ex.name}. ${secText(s.sec)}.`;
      if (s.phase === 'main' && s.round && this.w.main[0].id === s.id) t = `Varv ${s.round} av ${s.rounds}. ` + t;
      if (ex.sides) t += ' Börja med höger sida.';
      if (s.phase === 'main' && ex.cues[0]) t += ` ${ex.cues[0]}.`;
      say(t, { interrupt: true });
      beep(990, 220);
    } else if (s.kind === 'switch') {
      say(`Nästa: ${ex.name}`, { interrupt: true });
    } else if (s.kind === 'rest') {
      say(`${s.label ? s.label + '. ' : ''}Vila ${secText(s.sec)}. Nästa övning: ${ex.name}.`, { interrupt: true });
    }
  }

  cues(s, left, el) {
    const ex = byId[s.id];
    const L = Math.ceil(left);
    if (s.kind === 'work') {
      if (ex.sides && s.sec >= 20 && el >= s.sec / 2) this.once('side', () => { say('Byt sida', { interrupt: true }); beep(660, 160); });
      else if (!ex.sides && s.sec >= 40 && el >= s.sec / 2) this.once('half', () => say(`Halvvägs. ${ex.cues[1] || 'Fortsätt så'}.`));
      if (s.sec >= 25 && L === 10) this.once('ten', () => say('Tio sekunder kvar'));
      if (L <= 3 && L >= 1) this.once('b' + L, () => beep(660, 90, 0.15));
    } else {
      if (s.sec >= 15 && L === 5 && s.kind !== 'switch') this.once('five', () => say('Fem sekunder. Gör dig redo.'));
      if (L <= 3 && L >= 1) this.once('b' + L, () => { beep(660, 110); });
    }
  }

  render(s) {
    const isWork = s.kind === 'work';
    const ex = byId[isWork ? s.id : s.next];
    const phaseEl = $('p-phase');
    let ptxt = PHASE_TXT[s.phase];
    if (s.phase === 'main' && s.round) ptxt += ` · varv ${s.round}/${s.rounds}`;
    if (!isWork) ptxt = s.kind === 'prep' ? 'Gör dig redo' : s.kind === 'switch' ? 'Byt övning' : 'Vila';
    phaseEl.textContent = ptxt;
    phaseEl.classList.toggle('rest', !isWork);
    $('p-stepbar').classList.toggle('rest', !isWork);
    $('p-name').textContent = isWork ? ex.name : `Nästa: ${ex?.name || ''}`;
    $('p-cue').textContent = isWork ? ex.cues.join(' · ') : (s.label || ex?.desc || '');
    $('p-side').hidden = !(isWork && ex.sides);
    this.coach.set(ex?.anim || 'stand', videoFor(ex?.id));
    // nästa-rad
    const nxt = this.steps.slice(this.i + 1).find((x) => x.kind === 'work');
    $('p-next-txt').textContent = isWork && nxt ? `Sedan: ${byId[nxt.id].name}` : '';
  }

  progress(s, left, el) {
    const done = s.start + Math.min(s.sec, el);
    $('p-total').style.width = `${(100 * done) / this.total}%`;
    $('p-step').style.width = `${(100 * Math.min(s.sec, el)) / s.sec}%`;
    $('p-timer').textContent = fmt(Math.ceil(left));
    $('p-elapsed').textContent = `${fmt(done)} / ${fmt(this.total)}`;
    $('p-left').textContent = `${fmt(this.total - done)} kvar`;
  }

  finish(completed) {
    this.done = true;
    clearInterval(this.iv);
    keepAwake(false);
    if (completed) { beep(880, 200); setTimeout(() => beep(1175, 300), 220); say('Passet är klart. Snyggt jobbat! Glöm inte att dricka vatten.', { interrupt: true }); }
    else stopSpeech();
    $('player').classList.remove('active');
    document.body.style.overflow = '';
    // faktisk träningstid (väggklocka minus pauser), max passets längd
    const seconds = Math.min(this.total, Math.round((Date.now() - this.startedAt - this.pausedMs) / 1000));
    this.onFinish({ completed, seconds, workout: this.w });
  }
}
