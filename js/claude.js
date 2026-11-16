// Koppling mot Claude: planerar veckans pass och analyserar framstegen.
// API-nyckeln sparas bara lokalt i telefonen och skickas direkt till Anthropic.
import Anthropic from '../vendor/anthropic.js';
import { EXERCISES, byId, AREAS } from './exercises.js';
import { buildWorkout, THEMES } from './planner.js';
import { addDays, weekday, DAY_NAMES } from './store.js';

function client(settings) {
  if (!settings.apiKey) throw new Error('Ingen API-nyckel. Lägg in den under Inställningar.');
  return new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

const ids = (phase) => EXERCISES.filter((e) => e.phase === phase).map((e) => e.id);

const catalog = () => EXERCISES.map((e) =>
  `${e.id} | ${e.name} | ${e.phase} | ${e.areas.join(',')} | nivå ${e.level}${e.sides ? ' | båda sidor' : ''}${e.source ? ' | ' + e.source : ''}`).join('\n');

function historySummary(history, n = 21) {
  if (!history.length) return 'Ingen historik ännu – detta är första veckan.';
  return history.slice(-n).map((h) => {
    const exs = (h.exercises || []).map((id) => byId[id]?.name || id).join(', ');
    return `${h.date}: ${h.workoutTitle} · ${Math.round((h.seconds || 0) / 60)} min · ${h.completed ? 'genomfört' : 'avbrutet'} · upplevelse: ${h.rating || 'ej angivet'}${h.note ? ` · kommentar: "${h.note}"` : ''} · huvudövningar: ${exs}`;
  }).join('\n');
}

const SYSTEM = `You are a personal trainer who plans short morning bodyweight sessions in the style of military calisthenics (US Army PRT: Preparation Drill, conditioning drills, 4 for the Core, Recovery Drill) for a single user who trains alone at home without equipment.

Each session has three parts: warm-up (≈5 min, 8–10 exercises from the warmup list, start with a pulse raiser), a main circuit (4–6 exercises done for several rounds with fixed work/rest intervals), and a cool-down stretch (≈5 min, 7–9 exercises from the cooldown list, end with deep-breathing). The app computes the number of rounds from the user's preferred session length, so you choose the exercises and the work/rest seconds.

Plan the week so the whole body is trained across the days: alternate emphasis (legs/glutes, upper body push and pull, core, conditioning) so the same muscle group is not hit hard two days in a row, and make one day lighter if the user trains 6–7 days. Weight the user's focus areas clearly more than the rest of the week, without dropping full-body balance. Use the history to progress or regress: if sessions were rated "för tungt" or were aborted, ease off (fewer level 3 exercises, longer rest); if rated "för lätt", step up (harder variants, 45/15 intervals). Vary exercises from last week where possible.

Only use exercise ids from the catalog, in their own phase. Write all user-facing text (titles, notes) in Swedish, short and encouraging, like a coach talking to the user. Each day's coach_note is 1–2 sentences about the purpose of the session.`;

function planSchema() {
  const arr = (enumIds) => ({ type: 'array', items: { type: 'string', enum: enumIds } });
  return {
    type: 'object',
    additionalProperties: false,
    required: ['week_note', 'days'],
    properties: {
      week_note: { type: 'string' },
      days: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['date', 'title', 'coach_note', 'warmup', 'main', 'cooldown', 'work_seconds', 'rest_seconds'],
          properties: {
            date: { type: 'string' },
            title: { type: 'string' },
            coach_note: { type: 'string' },
            warmup: arr(ids('warmup')),
            main: arr(ids('main')),
            cooldown: arr(ids('cooldown')),
            work_seconds: { type: 'integer', enum: [30, 40, 45] },
            rest_seconds: { type: 'integer', enum: [15, 20, 30] },
          },
        },
      },
    },
  };
}

// Översätt API-fel till begripliga meddelanden
export function friendlyError(err) {
  const s = err?.status;
  if (s === 401) return 'Ogiltig API-nyckel – kontrollera den under Inställningar.';
  if (s === 403) return 'API-nyckeln saknar behörighet.';
  if (s === 429) return 'För många anrop just nu – vänta en stund och försök igen.';
  if (s === 400) return 'Claude kunde inte tolka förfrågan (' + (err.error?.error?.message || err.message) + ').';
  if (s >= 500) return 'Claude är tillfälligt överbelastat – försök igen om en stund.';
  if (err instanceof Anthropic.APIConnectionError) return 'Ingen kontakt med Claude – är du uppkopplad?';
  return err?.message || String(err);
}

function check(resp) {
  if (resp.stop_reason === 'refusal') throw new Error('Claude avböjde förfrågan. Försök igen eller använd regelmotorn.');
  if (resp.stop_reason === 'max_tokens') throw new Error('Svaret blev för långt och kapades. Försök igen.');
  return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

export async function planWeekWithClaude({ weekStart, focus, settings, history }) {
  const dates = [];
  for (let i = 0; i < 7; i++) { const d = addDays(weekStart, i); if (settings.trainDays.includes(weekday(d))) dates.push(d); }
  const user = `Plan this week's sessions.

Training dates (plan exactly one session per date): ${dates.map((d) => `${d} (${DAY_NAMES[weekday(d)]})`).join(', ')}
Preferred session length: ${settings.minutes} minutes
User level (1 beginner – 3 experienced): ${settings.level}
Focus areas chosen this Monday: ${focus.length ? focus.map((f) => AREAS[f]).join(', ') : 'inga särskilda – jämn helkropp'}
Default weekday themes the app would use without you (you may improve on them): ${dates.map((d) => `${DAY_NAMES[weekday(d)]}: ${THEMES[weekday(d)].title}`).join('; ')}

History (most recent last):
${historySummary(history)}

Exercise catalog (id | name | phase | areas | level | notes):
${catalog()}`;

  const resp = await client(settings).beta.messages.create({
    model: settings.model || 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: planSchema() } },
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  });
  const plan = JSON.parse(check(resp));

  const days = {};
  for (const d of plan.days || []) {
    if (!dates.includes(d.date)) continue;
    const pick = (list, phase) => [...new Set(list)].map((id) => byId[id]).filter((e) => e && e.phase === phase);
    const warmup = pick(d.warmup, 'warmup'), main = pick(d.main, 'main'), cooldown = pick(d.cooldown, 'cooldown');
    if (warmup.length < 4 || main.length < 3 || cooldown.length < 4) continue;
    days[d.date] = buildWorkout({
      date: d.date, title: d.title, theme: `${DAY_NAMES[weekday(d.date)]}: ${d.title}`, focus,
      warmup, main, cooldown, work: d.work_seconds, rest: d.rest_seconds, minutes: settings.minutes,
      note: d.coach_note, source: 'claude',
    });
  }
  return { weekStart, focus, days, note: plan.week_note || '', source: 'claude', missing: dates.filter((d) => !days[d]) };
}

export async function analyzeProgress({ settings, history, week }) {
  const user = `Here is my training history from the app (most recent last):
${historySummary(history, 40)}

${week ? `This week's focus areas: ${week.focus.map((f) => AREAS[f]).join(', ') || 'none'}.` : ''}
My level setting: ${settings.level} (1–3). Preferred length: ${settings.minutes} min.

Give me a short analysis in Swedish: how consistent I have been, which body areas I have trained most and least, how the perceived effort has developed, and 2–3 concrete recommendations for next week (for example what to focus on Monday, or whether to change level). Write it like a coach talking to me, max ~180 words, plain text with short paragraphs or simple dashes, no markdown headings.`;
  const resp = await client(settings).beta.messages.create({
    model: settings.model || 'claude-opus-5-5',
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: user }],
  });
  return check(resp).trim();
}

export async function testKey(settings) {
  const resp = await client(settings).messages.create({
    model: settings.model || 'claude-opus-5-5',
    max_tokens: 200,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: 'Svara bara: OK' }],
  });
  return check(resp);
}
