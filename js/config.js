/* CAGE KINGS - config.js
 * Every balance / tuning number lives here. Times are in milliseconds unless noted,
 * distances in virtual pixels (the game renders to a 1280x720 virtual stage).
 */
window.CK = window.CK || {};
CK.CONFIG = {
  VIEW: { W: 1280, H: 720 },
  TICK_HZ: 60,                       // fixed simulation rate
  MAX_STEPS_PER_FRAME: 6,
  ARENA: { left: 120, right: 1160, floorY: 612, startGap: 300 },

  // ---- Rounds ----
  ROUND_SECONDS: 60,
  ROUNDS: 3,
  TITLE_ROUNDS: 5,
  ROUND_BREAK_MS: 2600,
  INTRO_MS: 1400,
  FINISH_FREEZE_MS: 2200,

  // ---- Stamina (one bar) ----
  STAMINA: {
    max: 100,
    regenIdle: 13,          // per second while idle
    regenWalk: 8,           // per second while moving
    regenBlock: 2,          // per second while holding block
    regenGround: 3.5,       // per second in clinch / ground
    lowThreshold: 25,       // below this you are "gassed"
    lowSpeedMult: 1.35,     // gassed strikes are this much slower
    lowDmgMult: 0.75,       // and hit this much softer
    lowBlockMult: 1.6,      // and blocks cost this much more
    betweenRounds: 0.6,     // fraction of missing stamina refilled between rounds
    bodyDmgToMax: 0.45,     // max stamina lost per point of body damage
    minMax: 45,             // max stamina never drops below this
    cardioCostMult: [1.25, 0.8], // cost mult at cardio 0 .. 100 (lerp)
    cardioRegenMult: [0.7, 1.3]
  },

  DAMAGE_SCALE: 0.65,        // global multiplier on every landed strike (quick balance knob)
  HEALTH: { head: 100, body: 100, leg: 100, headHealBetweenRounds: 10 },

  // ---- Movement ----
  MOVE: {
    speed: 215, backMult: 0.85, legSlowMax: 0.55, minSeparation: 48,
    pushback: 34, blockPushback: 18
  },

  // ---- Blocking ----
  BLOCK: {
    dmgMult: 0.12,          // damage that leaks through a block
    staminaPerDmg: 0.5,     // defender stamina lost per point of blocked damage
    perfectWindowMs: 150,   // block pressed this close before impact = perfect block
    perfectStaggerMs: 520,  // attacker staggered this long after a perfect block
    boxingBonusMs: 40,      // Boxing gets a wider window
    counterBonusMs: 50,     // Counter-Strikers too
    catchKickStaggerMs: 850,  // perfect-blocking a body kick catches it: free takedown attempt
    checkDmg: 0.8,            // low-blocking a leg kick checks it: kicker takes this x dmg to the leg
    lowBlockStops: ['leg', 'body'],
    highBlockStops: ['head', 'body']
  },

  HITSTUN: { light: 230, heavy: 400 },
  COUNTER_HIT_MULT: 1.25,
  COUNTER_STRIKER_MULT: 1.35,
  SLIP: { perDefense: 0.0022, boxingBonus: 0.06, creativePenalty: 0.04 },
  BUFFER_MS: 160,             // input buffer for strikes

  // ---- Knockdowns & finishes ----
  KNOCKDOWN: {
    base: 0.0042,           // chance per point of head damage (scaled below)
    lowHeadMult: 2.4,       // extra multiplier as head health approaches zero
    downMs: 2100, getUpMs: 500,
    flashKoBelowHead: 18, flashKoChance: 0.4
  },
  // Referee stoppage meter (design v3; replaces the old "3 knockdowns" rule and the separate leg TKO).
  // Each CLEAN hit taken (not blocked, not answered) adds perHit + dmg*perDmg, multiplied when the
  // fighter is hurt (head below hurtHead or staggered) or downed. Roughly 8 unanswered hits in ~4s fills it.
  // It drains over time and drops when the fighter answers (blocks, lands a strike, escapes, sweeps, stands).
  REF: {
    perHit: 10, perDmg: 0.6,
    hurtHead: 40, hurtMult: 1.5, downedMult: 2.0,
    groundMult: { guard: 0.45, mount: 0.9, back: 0.8 },  // on the ground the meter is driven by position (guard is safest)
    knockdownAdd: 25,
    decayPerSec: 6, answerDrop: 24,
    tkoAt: 100,
    legGoneAdd: 45,            // a leg at 0 health drops the fighter and adds this much
    legGoneHitMult: 1.6,       // further hits while the leg is gone fill faster
    bellHeadBelow: 12, bellChance: 0.5  // TKO "did not answer the bell": AI corner checks at the break
  },
  CHIN_HEAD_DMG: [1.18, 0.86],  // head damage taken mult at chin 0 .. 100

  // ---- Strike table ----
  // startup/active/recovery ms, dmg, stamina cost, reach px (at scale 1),
  // target head|body|leg, kd = knockdown weight, heavy = longer hitstun
  MOVES: {
    jab:        { anim: 'jab',        startup: 85,  active: 60, recovery: 150, dmg: 4,   stam: 4.5, reach: 120, target: 'head', kd: 0.25, kind: 'punch' },
    jab_body:   { anim: 'jab_body',   startup: 95,  active: 60, recovery: 170, dmg: 4,   stam: 4.5, reach: 116, target: 'body', kd: 0,    kind: 'punch' },
    power:      { anim: 'power',      startup: 210, active: 80, recovery: 330, dmg: 11,  stam: 11,  reach: 124, target: 'head', kd: 1.0,  kind: 'punch', heavy: true },
    power_body: { anim: 'power_body', startup: 220, active: 80, recovery: 340, dmg: 10,  stam: 10,  reach: 118, target: 'body', kd: 0,    kind: 'punch', heavy: true },
    hook:       { anim: 'hook',       startup: 180, active: 70, recovery: 300, dmg: 10,  stam: 10,  reach: 104, target: 'head', kd: 1.1,  kind: 'punch', heavy: true, chain: 'uppercut' },
    uppercut:   { anim: 'uppercut',   startup: 140, active: 70, recovery: 340, dmg: 11,  stam: 9,   reach: 92,  target: 'head', kd: 1.3,  kind: 'punch', heavy: true },
    elbow:      { anim: 'elbow',      startup: 160, active: 60, recovery: 280, dmg: 10,  stam: 9,   reach: 86,  target: 'head', kd: 0.9,  kind: 'elbow', heavy: true, closeOnly: 105 },
    kick_body:  { anim: 'kick_body',  startup: 260, active: 90, recovery: 380, dmg: 10,  stam: 11,  reach: 168, target: 'body', kd: 0,    kind: 'kick', heavy: true, catchable: true },
    kick_head:  { anim: 'kick_head',  startup: 330, active: 90, recovery: 430, dmg: 15,  stam: 14,  reach: 172, target: 'head', kd: 1.5,  kind: 'kick', heavy: true },
    leg_kick:   { anim: 'leg_kick',   startup: 220, active: 80, recovery: 320, dmg: 8,   stam: 8,   reach: 150, target: 'leg',  kd: 0,    kind: 'kick' },
    teep:       { anim: 'teep',       startup: 200, active: 100, recovery: 300, dmg: 5,  stam: 7,   reach: 168, target: 'body', kd: 0,    kind: 'kick', push: 150, drain: 10 },
    spin_fist:  { anim: 'spin_fist',  startup: 300, active: 80, recovery: 380, dmg: 12,  stam: 12,  reach: 128, target: 'head', kd: 1.4,  kind: 'punch', heavy: true, spin: true },
    spin_kick:  { anim: 'spin_kick',  startup: 340, active: 90, recovery: 440, dmg: 14,  stam: 14,  reach: 160, target: 'body', kd: 0,    kind: 'kick', heavy: true, spin: true },
    knee:       { anim: 'knee',       startup: 150, active: 80, recovery: 280, dmg: 9,   stam: 8,   reach: 80,  target: 'body', kd: 0,    kind: 'knee', heavy: true }
  },
  CHAIN_WINDOW_MS: 260,

  // Discipline multipliers per strike kind
  DISCIPLINE_MULT: {
    BOX: { punch: 1.15, elbow: 1.0, kick: 0.7, knee: 0.8, speed: 0.9 },
    MT:  { punch: 0.95, elbow: 1.2, kick: 1.2, knee: 1.25, speed: 1.0, legKick: 1.5 },
    WR:  { punch: 0.95, elbow: 0.9, kick: 0.85, knee: 0.9, speed: 1.0 },
    BJJ: { punch: 0.85, elbow: 0.85, kick: 0.85, knee: 0.85, speed: 1.05 }
  },

  // ---- Clinch ----
  CLINCH: {
    grabStartup: 150, grabRange: 112, grabStam: 6, gap: 54,
    punch: { dmg: 3.5, stam: 3, cd: 380 },
    elbow: { dmg: 7, stam: 6, cd: 520 },
    knee: { dmg: 7, stam: 6, cd: 560, thaiHeadDmg: 7, thaiKd: 0.6 },
    breakBase: 0.32, breakPerStr: 0.008, thaiBreakPenalty: 0.15, breakStam: 8, breakCd: 450, breakGap: 150,
    tdBase: 0.32, tdStam: 12, tdCd: 900,
    refBreakMs: 9000, blockMult: 0.4
  },

  // ---- Takedowns ----
  TAKEDOWN: {
    // windup = visible level change before the dash (the sprawl window)
    minRange: 0, maxRange: 230, windup: 200, startup: 260, dashSpeed: 560, contact: 72, stam: 13,
    base: 0.42, perGrapple: 0.006, perDefense: 0.005, wrestlingBonus: 0.15,
    sprawlMult: 0.25, wrestlingSprawlBonus: 0.15, gassedDefBonus: 0.15,
    missRecovery: 480, sprawledMs: 650, reShotStamMult: 0.5,
    kneeCounterDmg: 14, guardPullRange: 125, guardPullStam: 6
  },

  // ---- Ground ----
  GROUND: {
    gnp: { dmg: 2.6, stam: 4.5, cd: 400 },
    gnpHeavy: { dmg: 5.3, stam: 9, cd: 680 },   // 12-6 / downward elbows are legal (2024 rules)
    // damage multiplier for ground strikes by position (guard GnP is weaker, mount strongest)
    posDmg: { guard: 0.55, mount: 1.1, back: 0.85, guardBottom: 1.0 },
    backStrike: { dmg: 4, stam: 3, cd: 380 },
    upStrike: { dmg: 2.5, stam: 3, cd: 420 },   // strikes from the bottom of guard
    blockMult: 0.25,
    advanceBase: 0.24, advanceStam: 9, advanceCd: 900, bjjBackBonus: 0.15, wrestlingMountBonus: 0.15,
    sweepBase: 0.2, sweepStam: 10, sweepCd: 1000, bjjSweepBonus: 0.18,
    scrambleBase: 0.32, scrambleStam: 10, scrambleCd: 900,
    handFightPerPress: 9, handFightStam: 3,
    turnBase: 0.18, turnStam: 8,
    stallWorkMs: 10000, standupMs: 13000,   // design: ~10s with no strikes/advance = "Work!", then stand-up
    subStam: 8, subCd: 1200,
    bridgeBase: 0.22, bridgeStam: 12, bridgeCd: 1000
  },

  // ---- Submission tug-of-war ----
  SUB: {
    startBar: 34, beatMs: 440, beatWindowMs: 95, minPressGapMs: 110,
    press: 6.2, onBeatMult: 1.55, offBeatMult: 0.6,
    bjjMult: 1.25, pressStam: 2.6, drift: -5, timeoutMs: 5500,
    gassedMult: 0.65,
    entryBonus: { guillotine: 6, armbar: 4, triangle: 2, rnc: 8 },
    names: { guillotine: 'Guillotine', armbar: 'Armbar', triangle: 'Triangle', rnc: 'Rear-Naked Choke' }
  },

  // ---- Judging ----
  // Damage decides the round first; aggression, then control only break ties.
  JUDGE: {
    kdDmg: 18,               // a knockdown counts as this much damage
    nearSubDmg: 8,           // a sub that got past 75% counts as this much damage
    tieMargin: 0.12,         // damage within 12% is "close": aggression decides, then control
    noise: 0.10,             // each judge reads each fighter's work +/-10% (per judge, per fighter, per criterion)
    tenEightRatio: 2.6, tenEightMin: 40
  },
  CLOCK: { displaySeconds: 300 },   // 60s rounds show a 5:00 clock running at 5x
  CORNER: { minMs: 3000, maxMs: 5000 },

  // ---- AI ----
  AI: {
    easy:   { react: 460, think: 420, block: 0.30, perfect: 0.05, sprawl: 0.25, counter: 0.20, floor: 8,  subRate: 160, subAcc: 0.35, pressGap: 200, mistake: 0.25 },
    normal: { react: 300, think: 300, block: 0.55, perfect: 0.18, sprawl: 0.5,  counter: 0.45, floor: 22, subRate: 130, subAcc: 0.6,  pressGap: 160, mistake: 0.1 },
    hard:   { react: 170, think: 210, block: 0.75, perfect: 0.38, sprawl: 0.72, counter: 0.7,  floor: 32, subRate: 115, subAcc: 0.82, pressGap: 130, mistake: 0.03 }
  },

  // ---- Weight classes ----
  WEIGHT: {
    FLY: { name: 'Flyweight',   lbs: 125, scale: 0.88, speed: 1.14, power: 0.8,  cardio: 1.1,  width: 0.9 },
    LW:  { name: 'Lightweight', lbs: 155, scale: 0.95, speed: 1.05, power: 0.92, cardio: 1.0,  width: 0.97 },
    MW:  { name: 'Middleweight',lbs: 185, scale: 1.0,  speed: 1.0,  power: 1.0,  cardio: 0.95, width: 1.05 },
    HW:  { name: 'Heavyweight', lbs: 265, scale: 1.1,  speed: 0.86, power: 1.28, cardio: 0.8,  width: 1.25 }
  },

  // ---- Career ----
  CAREER: {
    campWeeks: 6, statCap: 99, gainBase: 3, gainDiminish: 0.025,
    fatiguePerWeek: 12, restRecovery: 30, fatigueStamPenalty: 0.35,
    crossTrainUnlockWeeks: 3,
    winRating: 30, lossRating: 26, finishBonus: 14, upsetFactor: 0.4,
    titleShotRank: 1, finishStreakRank: 3, finishStreakNeeded: 2,
    basePurse: 4000
  }
};
