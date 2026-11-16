// Animerad tränarfigur (SVG, sidovy, figuren tittar åt höger).
//
// Vinklar i grader: riktning (sin a, cos a) i skärmkoordinater (y nedåt).
//   0 = rakt ner, 90 = framåt (höger), 180 = rakt upp, -90 = bakåt (vänster).
// Fält i en pose:
//   t  = bål (från höft till axel), a1/a2 = närmsta arm (överarm/underarm),
//   b1/b2 = bortre arm, l1/l2 = närmsta ben (lår/underben), m1/m2 = bortre ben,
//   x = höftens x-förskjutning, lift = höjd över golvet (hopp),
//   ft = fotens vinkel relativt underbenet (90 = vanlig fot, mindre = tåhävning)
// Figuren placeras automatiskt så att lägsta punkten vilar på golvet.

const L = { torso: 48, neck: 5, head: 10, upper: 27, fore: 25, thigh: 36, shin: 36, foot: 9 };
const GROUND = 186;
const R = 4.5; // halva linjetjockleken

const STAND = { x: 0, lift: 0, t: 180, a1: 0, a2: 0, b1: 4, b2: 4, l1: 0, l2: 0, m1: 0, m2: 0, ft: 90, fft: 90 };
const P = (o = {}) => ({ ...STAND, ...o });
const swap = (p) => ({ ...p, a1: p.b1, a2: p.b2, b1: p.a1, b2: p.a2, l1: p.m1, l2: p.m2, m1: p.l1, m2: p.l2, ft: p.fft, fft: p.ft });

// ───── återanvända grundpositioner ─────
const ARMS_UP = { a1: 180, a2: 180, b1: 176, b2: 176 };
const SQUAT = { x: -24, t: 148, a1: 90, a2: 90, b1: 86, b2: 86, l1: 85, l2: -20, m1: 82, m2: -22 };
const PLANK_HI = { t: 112, a1: 0, a2: 0, b1: 0, b2: 0, l1: -68, l2: -68, m1: -68, m2: -68 };
const PLANK_LO = { x: 15, t: 92, a1: -120, a2: 10, b1: -120, b2: 10, l1: -88, l2: -88, m1: -88, m2: -88 };
const PLANK_FA = { t: 99, a1: 0, a2: 90, b1: 0, b2: 90, l1: -81, l2: -81, m1: -81, m2: -81 };
const SUPINE = { t: -97, a1: 90, a2: 90, b1: 88, b2: 88, l1: 90, l2: 90, m1: 92, m2: 92 };
const SUPINE_KNEES = { ...SUPINE, l1: 140, l2: 20, m1: 138, m2: 18 };
const PRONE = { t: 97, a1: 95, a2: 95, b1: 93, b2: 93, l1: -90, l2: -90, m1: -91, m2: -91 };
const FOURS = { t: 110, a1: 0, a2: 0, b1: 0, b2: 0, l1: 0, l2: -90, m1: 0, m2: -90 };
const LUNGE = { t: 180, l1: 85, l2: -4, m1: -22, m2: -100, a1: -10, b1: 10 };
const SEATED = { t: 175, l1: 90, l2: 90, m1: 91, m2: 91, a1: 20, a2: 20, b1: 18, b2: 18 };
const GUARD = { l1: 12, l2: -8, m1: -10, m2: -14, t: 175, a1: 30, a2: 160, b1: 25, b2: 155 };

// anim: { dur (ms per varv), frames, weights? (relativ tid per övergång), noWrap?, props? }
export const ANIMS = {
  stand: { dur: 4000, frames: [P(), P({ t: 179, a1: 3 })] },

  bendReach: { dur: 3200, frames: [P(ARMS_UP), P({ x: -6, t: 30, a1: -25, a2: -35, b1: -22, b2: -30, l1: 35, l2: -12, m1: 33, m2: -12 })] },
  rearLunge: { dur: 3200, frames: [P(), P(LUNGE), P(), swap(P(LUNGE))] },
  forwardLunge: { dur: 3200, frames: [P(), P({ ...LUNGE, x: 14 }), P(), swap(P({ ...LUNGE, x: 14 }))] },
  highJumper: { dur: 1500, frames: [
    P({ t: 165, a1: -50, b1: -48, a2: -50, b2: -48, l1: 25, l2: -18, m1: 23, m2: -18 }),
    P({ a1: 60, b1: 58, a2: 60, b2: 58, lift: 6, ft: 50, fft: 50 }),
    P({ t: 165, a1: -50, b1: -48, a2: -50, b2: -48, l1: 25, l2: -18, m1: 23, m2: -18 }),
    P({ ...ARMS_UP, lift: 18, ft: 40, fft: 40 }),
  ] },
  rower: { dur: 3000, frames: [
    P({ ...SUPINE, a1: -95, a2: -95, b1: -93, b2: -93 }),
    P({ t: 168, a1: 90, a2: 90, b1: 88, b2: 88, l1: 145, l2: 15, m1: 143, m2: 13 }),
  ] },
  squatBender: { dur: 4400, frames: [P(), P(SQUAT), P(), P({ t: 12, a1: 0, a2: 0, b1: 2, b2: 2 })] },
  windmill: { dur: 3600, frames: [
    P({ a1: 90, a2: 90, b1: -90, b2: -90 }),
    P({ t: 35, a1: 5, a2: 5, b1: 175, b2: 175, l1: 8, m1: -4 }),
    P({ a1: 90, a2: 90, b1: -90, b2: -90 }),
    P({ t: 35, a1: 175, a2: 175, b1: 5, b2: 5, l1: 8, m1: -4 }),
  ] },
  proneRow: { dur: 2600, frames: [P(PRONE), P({ ...PRONE, t: 104, a1: -100, a2: 70, b1: -98, b2: 72 })] },
  legRaise: { dur: 3000, frames: [P(SUPINE), P({ ...SUPINE, l1: 180, l2: 92, m1: 178, m2: 90 })] },

  pushup: { dur: 2400, frames: [P(PLANK_HI), P(PLANK_LO)] },
  kneePushup: { dur: 2400, frames: [
    P({ t: 118, a1: 0, a2: 0, b1: 0, b2: 0, l1: -40, l2: -95, m1: -40, m2: -95 }),
    P({ x: 14, t: 100, a1: -120, a2: 10, b1: -120, b2: 10, l1: -85, l2: -100, m1: -85, m2: -100 }),
  ] },
  pikePushup: { dur: 2600, frames: [
    P({ t: 50, a1: 35, a2: 35, b1: 35, b2: 35, l1: -28, l2: -28, m1: -28, m2: -28 }),
    P({ t: 30, a1: 60, a2: -10, b1: 60, b2: -10, l1: -20, l2: -20, m1: -20, m2: -20 }),
  ] },
  dips: { dur: 2600, props: ['bench'], frames: [
    P({ t: 178, a1: -20, a2: -10, b1: -20, b2: -10, l1: 75, l2: 5, m1: 75, m2: 5 }),
    P({ t: 172, a1: -95, a2: 0, b1: -95, b2: 0, l1: 98, l2: 22, m1: 98, m2: 22 }),
  ] },
  shoulderTap: { dur: 2000, frames: [P(PLANK_HI), P({ ...PLANK_HI, a1: 70, a2: -50 }), P(PLANK_HI), P({ ...PLANK_HI, b1: 70, b2: -50 })] },
  burpee: { dur: 3600, frames: [
    P(),
    P({ x: -18, t: 70, a1: 0, a2: 0, b1: 0, b2: 0, l1: 110, l2: -30, m1: 108, m2: -30 }),
    P({ ...PLANK_HI, x: -10 }),
    P({ x: -18, t: 70, a1: 0, a2: 0, b1: 0, b2: 0, l1: 110, l2: -30, m1: 108, m2: -30 }),
    P({ ...ARMS_UP, lift: 20, ft: 40, fft: 40 }),
  ] },
  bearCrawl: { dur: 1600, frames: [
    P({ t: 95, a1: 10, a2: 10, b1: -10, b2: -10, l1: 20, l2: -75, m1: -5, m2: -85 }),
    P({ t: 95, a1: -10, a2: -10, b1: 10, b2: 10, l1: -5, l2: -85, m1: 20, m2: -75 }),
  ] },
  superman: { dur: 2800, frames: [P(PRONE), P({ ...PRONE, t: 104, a1: 110, a2: 110, b1: 108, b2: 108, l1: -100, l2: -100, m1: -99, m2: -99 })] },
  swimmer: { dur: 1200, frames: [
    P({ ...PRONE, t: 103, a1: 112, a2: 112, b1: 92, b2: 92, l1: -88, l2: -88, m1: -102, m2: -102 }),
    P({ ...PRONE, t: 103, a1: 92, a2: 92, b1: 112, b2: 112, l1: -102, l2: -102, m1: -88, m2: -88 }),
  ] },
  plank: { dur: 4000, frames: [P(PLANK_FA), P({ ...PLANK_FA, t: 98.5 })] },
  sidePlank: { dur: 4000, frames: [P({ ...PLANK_FA, b1: 180, b2: 180 }), P({ ...PLANK_FA, t: 98.5, b1: 178, b2: 178 })] },
  birdDog: { dur: 4000, frames: [
    P(FOURS), P({ ...FOURS, b1: 112, b2: 112, l1: -92, l2: -92 }),
    P(FOURS), P({ ...FOURS, a1: 112, a2: 112, m1: -92, m2: -92 }),
  ] },
  vUp: { dur: 2600, frames: [
    P({ ...SUPINE, a1: -95, a2: -95, b1: -93, b2: -93, l1: 95, l2: 95, m1: 95, m2: 95 }),
    P({ t: -140, a1: 140, a2: 140, b1: 138, b2: 138, l1: 140, l2: 140, m1: 139, m2: 139 }),
  ] },
  mountainClimber: { dur: 900, frames: [P({ ...PLANK_HI, l1: 75, l2: -15 }), P({ ...PLANK_HI, m1: 75, m2: -15 })] },
  bicycle: { dur: 1800, frames: [
    P({ ...SUPINE, t: -112, a1: -160, a2: 40, b1: -160, b2: 40, l1: 200, l2: 105, m1: 100, m2: 100 }),
    P({ ...SUPINE, t: -112, a1: -160, a2: 40, b1: -160, b2: 40, l1: 100, l2: 100, m1: 200, m2: 105 }),
  ] },
  flutter: { dur: 700, frames: [
    P({ ...SUPINE, a1: 92, b1: 92, l1: 100, l2: 100, m1: 112, m2: 112 }),
    P({ ...SUPINE, a1: 92, b1: 92, l1: 112, l2: 112, m1: 100, m2: 100 }),
  ] },
  hollow: { dur: 4000, frames: [
    P({ t: -108, a1: -100, a2: -100, b1: -100, b2: -100, l1: 104, l2: 104, m1: 104, m2: 104 }),
    P({ t: -107, a1: -101, a2: -101, b1: -101, b2: -101, l1: 103, l2: 103, m1: 103, m2: 103 }),
  ] },
  russianTwist: { dur: 1800, frames: [
    P({ t: -160, a1: 100, a2: 70, b1: 120, b2: 80, l1: 130, l2: 70, m1: 128, m2: 68 }),
    P({ t: -160, a1: 150, a2: 175, b1: 60, b2: 40, l1: 130, l2: 70, m1: 128, m2: 68 }),
  ] },
  situp: { dur: 2800, frames: [
    P({ ...SUPINE_KNEES, a1: -170, a2: 30, b1: -170, b2: 30 }),
    P({ ...SUPINE_KNEES, t: 162, a1: 160, a2: 220, b1: 160, b2: 220 }),
  ] },
  deadBug: { dur: 3600, frames: [
    P({ t: -97, a1: 180, a2: 180, b1: 180, b2: 180, l1: 180, l2: 90, m1: 180, m2: 90 }),
    P({ t: -97, a1: -100, a2: -100, b1: 180, b2: 180, l1: 180, l2: 90, m1: 100, m2: 100 }),
    P({ t: -97, a1: 180, a2: 180, b1: 180, b2: 180, l1: 180, l2: 90, m1: 180, m2: 90 }),
    P({ t: -97, a1: 180, a2: 180, b1: -100, b2: -100, l1: 100, l2: 100, m1: 180, m2: 90 }),
  ] },
  highKnees: { dur: 700, frames: [
    P({ t: 175, l1: 95, l2: 5, a1: -40, a2: 60, b1: 50, b2: 140, lift: 4, fft: 60 }),
    P({ t: 175, m1: 95, m2: 5, b1: -40, b2: 60, a1: 50, a2: 140, lift: 4, ft: 60 }),
  ] },
  march: { dur: 1400, frames: [
    P({ l1: 75, l2: 0, a1: -30, a2: -10, b1: 35, b2: 60 }),
    P({ m1: 75, m2: 0, b1: -30, b2: -10, a1: 35, a2: 60 }),
  ] },
  run: { dur: 800, frames: [
    P({ t: 170, l1: 45, l2: -20, m1: -30, m2: -90, a1: -40, a2: 50, b1: 45, b2: 130, lift: 6 }),
    P({ t: 170, m1: 45, m2: -20, l1: -30, l2: -90, b1: -40, b2: 50, a1: 45, a2: 130, lift: 6 }),
  ] },
  tuckJump: { dur: 1500, frames: [
    P({ t: 158, a1: -40, a2: -40, b1: -38, b2: -38, l1: 55, l2: -35, m1: 53, m2: -35 }),
    P({ t: 175, a1: 80, a2: 80, b1: 78, b2: 78, l1: 150, l2: 30, m1: 148, m2: 28, lift: 42 }),
  ] },
  skater: { dur: 1600, frames: [
    P({ t: 145, l1: 45, l2: -25, m1: -45, m2: -60, a1: 60, a2: 60, b1: -50, b2: -50 }),
    P({ t: 160, l1: 20, l2: -10, m1: 20, m2: -10, a1: 10, b1: 10, lift: 14 }),
    P({ t: 145, m1: 45, m2: -25, l1: -45, l2: -60, b1: 60, b2: 60, a1: -50, a2: -50 }),
    P({ t: 160, l1: 20, l2: -10, m1: 20, m2: -10, a1: 10, b1: 10, lift: 14 }),
  ] },
  frontKick: { dur: 2200, frames: [
    P(), P({ l1: 115, l2: 115, b1: 110, b2: 110, a1: -30 }),
    P(), P({ m1: 115, m2: 115, a1: 110, a2: 110, b1: -30 }),
  ] },
  jacks: { dur: 1000, frames: [P({ a1: 8, a2: 8, b1: -8, b2: -8 }), P({ ...ARMS_UP, a1: 172, b1: 188, b2: 188, l1: 10, m1: -10, lift: 4, ft: 60, fft: 60 })] },
  armCircles: { dur: 2400, noWrap: true, frames: [
    P({ a1: 0, a2: 0, b1: 180, b2: 180 }), P({ a1: 90, a2: 90, b1: 270, b2: 270 }), P({ a1: 180, a2: 180, b1: 360, b2: 360 }),
    P({ a1: 270, a2: 270, b1: 450, b2: 450 }), P({ a1: 360, a2: 360, b1: 540, b2: 540 }),
  ] },
  hipCircles: { dur: 2400, frames: [
    P({ x: 5, t: 175, a1: 25, a2: 120, b1: 25, b2: 120 }), P({ x: 0, t: 180, a1: 25, a2: 120, b1: 25, b2: 120 }),
    P({ x: -5, t: 185, a1: 25, a2: 120, b1: 25, b2: 120 }), P({ x: 0, t: 180, a1: 25, a2: 120, b1: 25, b2: 120 }),
  ] },
  inchworm: { dur: 5000, frames: [P(), P({ t: 10, a1: 0, a2: 0, b1: 2, b2: 2 }), P({ ...PLANK_HI, x: -30 }), P({ t: 10, a1: 0, a2: 0, b1: 2, b2: 2 })] },
  boxing: { dur: 1100, frames: [
    P(GUARD), P({ ...GUARD, a1: 92, a2: 92 }), P(GUARD), P({ ...GUARD, b1: 92, b2: 92, t: 170 }),
  ] },
  squat: { dur: 2600, frames: [P({ a1: 60, a2: 60, b1: 58, b2: 58 }), P(SQUAT)] },
  squatJump: { dur: 1800, frames: [P(SQUAT), P({ ...ARMS_UP, lift: 26, ft: 40, fft: 40 })] },
  lungeJump: { dur: 1800, frames: [P(LUNGE), P({ lift: 24, l1: 30, l2: -10, m1: 10, m2: -40, a1: 40, b1: -30 }), swap(P(LUNGE)), P({ lift: 24, m1: 30, m2: -10, l1: 10, l2: -40, b1: 40, a1: -30 })] },
  wallSit: { dur: 4000, props: ['wallBack'], frames: [
    P({ t: 180, a1: 90, a2: 90, b1: 88, b2: 88, l1: 90, l2: 0, m1: 90, m2: 0 }),
    P({ t: 180, a1: 88, a2: 88, b1: 86, b2: 86, l1: 90, l2: 0, m1: 90, m2: 0 }),
  ] },
  bridge: { dur: 2800, frames: [P(SUPINE_KNEES), P({ ...SUPINE_KNEES, t: -60, l1: 112, l2: 2, m1: 110, m2: 0 })] },
  calfRaise: { dur: 2200, frames: [P(), P({ ft: 35, fft: 35 })] },
  singleLegDeadlift: { dur: 3600, frames: [
    P({ m1: 4 }), P({ t: 95, a1: 0, a2: 0, b1: 2, b2: 2, l1: 12, l2: -6, m1: -92, m2: -92 }),
  ] },

  // ───── stretch ─────
  stretchOverhead: { dur: 5000, frames: [P({ a1: 175, a2: -15, b1: 150, b2: 205 }), P({ t: 176, a1: 172, a2: -18, b1: 148, b2: 205 })] },
  lungeStretch: { dur: 5000, frames: [
    P({ t: 183, l1: 80, l2: 0, m1: -48, m2: -95, a1: 60, a2: 30, b1: 58, b2: 28 }),
    P({ t: 186, x: 3, l1: 76, l2: -3, m1: -52, m2: -95, a1: 60, a2: 30, b1: 58, b2: 28 }),
  ] },
  cobra: { dur: 6000, frames: [
    P({ ...PRONE, t: 125, a1: -8, a2: -8, b1: -8, b2: -8, l1: -92, l2: -92, m1: -92, m2: -92 }),
    P({ x: -10, t: 60, a1: 100, a2: 100, b1: 98, b2: 98, l1: 48, l2: -90, m1: 46, m2: -90 }),
  ] },
  childsPose: { dur: 6000, frames: [
    P({ t: 72, a1: 72, a2: 72, b1: 70, b2: 70, l1: 45, l2: -90, m1: 44, m2: -90 }),
    P({ t: 75, a1: 74, a2: 74, b1: 72, b2: 72, l1: 45, l2: -90, m1: 44, m2: -90 }),
  ] },
  quadStretch: { dur: 5000, frames: [P({ l1: -5, l2: -168, a1: -25, a2: -55 }), P({ l1: -8, l2: -170, a1: -27, a2: -57, t: 178 })] },
  legOver: { dur: 6000, frames: [
    P({ ...SUPINE, a1: -175, a2: -175, l1: 125, l2: 70 }),
    P({ ...SUPINE, a1: -175, a2: -175, l1: 118, l2: 62 }),
  ] },
  groinStretch: { dur: 5000, frames: [
    P({ t: 175, l1: 72, l2: -60, m1: 70, m2: -62, a1: 30, a2: 50, b1: 28, b2: 48 }),
    P({ t: 148, l1: 72, l2: -60, m1: 70, m2: -62, a1: 15, a2: 30, b1: 14, b2: 28 }),
  ] },
  calfStretch: { dur: 5000, props: ['wallFront'], frames: [
    P({ t: 145, a1: 95, a2: 105, b1: 93, b2: 103, l1: 30, l2: 0, m1: -32, m2: -32 }),
    P({ t: 142, a1: 97, a2: 107, b1: 95, b2: 105, l1: 33, l2: 2, m1: -34, m2: -34 }),
  ] },
  hamstringStretch: { dur: 6000, frames: [P({ ...SEATED, a1: 60, a2: 70 }), P({ ...SEATED, t: 112, a1: 85, a2: 88, b1: 84, b2: 86 })] },
  chestStretch: { dur: 5000, frames: [P({ a1: -35, a2: -35, b1: -33, b2: -33 }), P({ t: 186, a1: -45, a2: -45, b1: -43, b2: -43 })] },
  pigeon: { dur: 6000, frames: [
    P({ t: 172, l1: 82, l2: -100, m1: -96, m2: -96, a1: 8, a2: 8, b1: 6, b2: 6 }),
    P({ t: 112, l1: 82, l2: -100, m1: -96, m2: -96, a1: 90, a2: 90, b1: 88, b2: 88 }),
  ] },
  crossArm: { dur: 5000, frames: [P({ a1: 85, a2: 85, b1: 40, b2: 120 }), P({ a1: 82, a2: 82, b1: 38, b2: 118, t: 179 })] },
  breathe: { dur: 10000, weights: [0.4, 0.6], frames: [P({ a1: 10, a2: 10, b1: 12, b2: 12 }), P({ t: 183, a1: 120, a2: 140, b1: 118, b2: 138, ft: 80, fft: 80 })] },
};

// ───── geometri ─────
const rad = (d) => (d * Math.PI) / 180;
const dir = (a, len) => [Math.sin(rad(a)) * len, Math.cos(rad(a)) * len];
const add = (p, v) => [p[0] + v[0], p[1] + v[1]];

function skeleton(p) {
  const hip = [p.x, 0];
  const sh = add(hip, dir(p.t, L.torso));
  const head = add(sh, dir(p.t, L.neck + L.head));
  const limb = (root, a, b, l1, l2) => { const j = add(root, dir(a, l1)); return [root, j, add(j, dir(b, l2))]; };
  const armN = limb(sh, p.a1, p.a2, L.upper, L.fore);
  const armF = limb(sh, p.b1, p.b2, L.upper, L.fore);
  const legN = limb(hip, p.l1, p.l2, L.thigh, L.shin);
  const legF = limb(hip, p.m1, p.m2, L.thigh, L.shin);
  const footN = add(legN[2], dir(p.l2 + p.ft, L.foot));
  const footF = add(legF[2], dir(p.m2 + p.fft, L.foot));
  const pts = [hip, sh, ...armN, ...armF, ...legN, ...legF, footN, footF];
  let low = Math.max(...pts.map((q) => q[1] + R), head[1] + L.head);
  const dy = GROUND - low - p.lift;
  const sh2 = (q) => [q[0], q[1] + dy];
  return {
    hip: sh2(hip), sh: sh2(sh), head: sh2(head),
    armN: armN.map(sh2), armF: armF.map(sh2), legN: [...legN.map(sh2), sh2(footN)], legF: [...legF.map(sh2), sh2(footF)],
  };
}

function bbox(s) {
  const pts = [s.hip, s.sh, ...s.armN, ...s.armF, ...s.legN, ...s.legF];
  const xs = pts.map((q) => q[0]).concat([s.head[0] - L.head, s.head[0] + L.head]);
  return [Math.min(...xs), Math.max(...xs)];
}

const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);
function lerpPose(a, b, u) {
  const o = {};
  for (const k in a) o[k] = a[k] + (b[k] - a[k]) * u;
  return o;
}

function poseAt(anim, ms) {
  const fr = anim.frames;
  const n = anim.noWrap ? fr.length - 1 : fr.length;
  const w = anim.weights || Array(n).fill(1 / n);
  const tot = w.reduce((s, v) => s + v, 0);
  let u = ((ms % anim.dur) / anim.dur) * tot;
  let i = 0;
  while (i < n - 1 && u > w[i]) { u -= w[i]; i++; }
  const local = ease(Math.min(1, u / w[i]));
  return lerpPose(fr[i], fr[(i + 1) % fr.length], local);
}

// Beräkna centrering/skalning per animation en gång
const fit = {};
function fitFor(key) {
  if (fit[key]) return fit[key];
  const anim = ANIMS[key];
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < 24; k++) {
    const [a, b] = bbox(skeleton(poseAt(anim, (anim.dur * k) / 24)));
    lo = Math.min(lo, a); hi = Math.max(hi, b);
  }
  const w = hi - lo;
  const scale = Math.min(0.82, 176 / w);
  fit[key] = { cx: (lo + hi) / 2, scale };
  return fit[key];
}

// ───── rendering ─────
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const pl = (pts) => pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');

export class Coach {
  constructor(container) {
    this.svg = el('svg', { viewBox: '0 0 200 200', class: 'coach-svg', role: 'img', 'aria-label': 'Tränare som visar övningen' });
    this.svg.appendChild(el('ellipse', { cx: 100, cy: GROUND + 4, rx: 80, ry: 5, class: 'coach-shadow' }));
    this.svg.appendChild(el('line', { x1: 8, y1: GROUND + 1, x2: 192, y2: GROUND + 1, class: 'coach-ground' }));
    this.propG = el('g', {});
    this.g = el('g', {});
    this.g.appendChild(this.propG);
    this.svg.append(this.g);
    this.parts = {
      armF: el('polyline', { class: 'limb far' }), legF: el('polyline', { class: 'limb far' }),
      torso: el('line', { class: 'limb torso' }), legN: el('polyline', { class: 'limb near' }),
      head: el('circle', { r: L.head, class: 'head' }), armN: el('polyline', { class: 'limb near' }),
    };
    for (const k of ['armF', 'legF', 'torso', 'legN', 'head', 'armN']) this.g.appendChild(this.parts[k]);
    container.appendChild(this.svg);
    this.key = 'stand'; this.t0 = performance.now(); this.paused = false; this.pauseAt = 0;
    this._loop = this._loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);
  }
  set(key) {
    if (!ANIMS[key]) key = 'stand';
    if (key === this.key) return;
    this.key = key; this.t0 = performance.now();
    this.propG.replaceChildren();
    const s0 = skeleton(ANIMS[key].frames[0]);
    for (const pr of ANIMS[key].props || []) {
      if (pr === 'wallBack') this.propG.appendChild(el('rect', { x: s0.hip[0] - 16, y: 30, width: 8, height: GROUND - 29, class: 'coach-prop' }));
      if (pr === 'wallFront') this.propG.appendChild(el('rect', { x: Math.max(s0.armN[2][0], s0.armF[2][0]) + R, y: 30, width: 8, height: GROUND - 29, class: 'coach-prop' }));
      if (pr === 'bench') { const h = s0.armN[2]; this.propG.appendChild(el('rect', { x: h[0] - 34, y: h[1] + R, width: 40, height: GROUND - h[1] - R, rx: 3, class: 'coach-prop' })); }
    }
  }
  pause(p) { this.paused = p; }
  destroy() { cancelAnimationFrame(this.raf); this.svg.remove(); }
  _loop(now) {
    this.raf = requestAnimationFrame(this._loop);
    if (this.paused) { this.t0 += now - (this._last || now); this._last = now; return; }
    this._last = now;
    const anim = ANIMS[this.key];
    const s = skeleton(poseAt(anim, now - this.t0));
    const f = fitFor(this.key);
    this.g.setAttribute('transform', `translate(100 ${GROUND}) scale(${f.scale}) translate(${-f.cx} ${-GROUND})`);
    this.parts.armF.setAttribute('points', pl(s.armF));
    this.parts.legF.setAttribute('points', pl(s.legF));
    this.parts.legN.setAttribute('points', pl(s.legN));
    this.parts.armN.setAttribute('points', pl(s.armN));
    this.parts.torso.setAttribute('x1', s.hip[0]); this.parts.torso.setAttribute('y1', s.hip[1]);
    this.parts.torso.setAttribute('x2', s.sh[0]); this.parts.torso.setAttribute('y2', s.sh[1]);
    this.parts.head.setAttribute('cx', s.head[0]); this.parts.head.setAttribute('cy', s.head[1]);
  }
}
