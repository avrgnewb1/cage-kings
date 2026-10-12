/* CAGE KINGS - data.js : disciplines, approaches, signature roster, looks, name pools */
(function () {
  const STAT_KEYS = ['striking', 'power', 'grappling', 'defense', 'strength', 'cardio', 'chin'];
  const STAT_LABELS = { striking: 'Striking', power: 'Power', grappling: 'Grappling', defense: 'Defense', strength: 'Strength', cardio: 'Cardio', chin: 'Chin' };

  const DISCIPLINES = {
    BOX: { id: 'BOX', name: 'Boxing', short: 'Boxing', mods: { striking: 12, defense: 6, grappling: -10 },
      moves: ['Hook > uppercut chain', 'Wider perfect block', 'Best head movement'] },
    MT:  { id: 'MT', name: 'Muay Thai', short: 'Muay Thai', mods: { striking: 6, power: 4, strength: 4 },
      moves: ['Teep (fwd + Kick)', 'Leg kick (low + Kick)', 'Elbow (Power up close)', 'Thai clinch knees'] },
    WR:  { id: 'WR', name: 'Wrestling', short: 'Wrestling', mods: { grappling: 12, strength: 8, striking: -4 },
      moves: ['Faster, harder takedowns', 'Chain re-shots', 'Best sprawl', 'Heavy top control'] },
    BJJ: { id: 'BJJ', name: 'Brazilian Jiu-Jitsu', short: 'BJJ', mods: { grappling: 16, striking: -8 },
      moves: ['Guard pull (Takedown up close)', 'Sweeps', 'Fast back takes', 'Submission edge'] }
  };

  const APPROACHES = {
    PRESSURE: { id: 'PRESSURE', name: 'Pressure Brawler', mods: { chin: 12, power: 10, cardio: -10, defense: -4 },
      ai: { range: 78, aggression: 0.85, forward: 1.0, floorMult: 0.6, power: 0.45, grapple: 0.12, counter: 0.1 } },
    COUNTER: { id: 'COUNTER', name: 'Counter-Striker', mods: { defense: 12, striking: 6, power: 2 },
      ai: { range: 150, aggression: 0.28, forward: 0.2, floorMult: 1.2, power: 0.3, grapple: 0.05, counter: 1.0 } },
    VOLUME: { id: 'VOLUME', name: 'Volume All-Rounder', mods: { cardio: 15, striking: 4, grappling: 2, defense: 2 },
      ai: { range: 112, aggression: 0.65, forward: 0.6, floorMult: 1.0, power: 0.22, grapple: 0.15, counter: 0.35 } },
    SMOTHER: { id: 'SMOTHER', name: 'Smother Grappler', mods: { strength: 12, grappling: 12, striking: -6 },
      ai: { range: 150, aggression: 0.6, forward: 0.8, floorMult: 0.9, power: 0.25, grapple: 0.6, counter: 0.2 } },
    CREATIVE: { id: 'CREATIVE', name: 'Creative / Unorthodox', mods: { striking: 6, power: 4, defense: -8 }, reach: 1.12,
      moves: ['Spinning back fist (back + Power)', 'Spinning back kick (back + Kick)', 'Switch head kick (up + Kick)'],
      ai: { range: 150, aggression: 0.55, forward: 0.5, floorMult: 1.0, power: 0.35, grapple: 0.15, counter: 0.3, kicks: 0.5 } }
  };

  const L = (o) => Object.assign({ skin: '#c68a5e', hair: 'shaved', hairColor: '#1c1410', beard: 'none', beardColor: null,
    shorts: ['#333', '#999'], gloves: '#222', tape: false, tattoo: null, build: { h: 1, w: 1, limb: 1 } }, o);

  // Signature roster. TEXT + identity (names, class, discipline, approach, champion flag, colors) come from
  // ../content/fighters.json (source of truth) via buildRoster(). This file only holds what the engine needs
  // that the JSON doesn't: stats and how each look maps onto the code-drawn rig. FALLBACK is used if the JSON is missing.
  const ENGINE = {
    okafor:    { stats: { striking: 80, power: 82, grappling: 55, defense: 58, strength: 72, cardio: 62, chin: 90 },
                 rig: { hair: 'shaved', beard: 'none', tape: true, build: { h: 0.98, w: 1.1, limb: 1 } } },
    hollander: { stats: { striking: 82, power: 72, grappling: 66, defense: 72, strength: 70, cardio: 90, chin: 80 },
                 rig: { hair: 'mullet', hairColor: '#4a2e18', beard: 'full', build: { h: 1, w: 1.05, limb: 1 } } },
    aslanov:   { stats: { striking: 64, power: 66, grappling: 95, defense: 76, strength: 90, cardio: 84, chin: 84 },
                 rig: { hair: 'topknot', hairColor: '#9C4A1E', beard: 'boxed', beardColor: '#9C4A1E', build: { h: 0.96, w: 1.15, limb: 0.95 } } },
    marchetti: { stats: { striking: 88, power: 76, grappling: 52, defense: 86, strength: 60, cardio: 72, chin: 72 },
                 rig: { hair: 'curls_tall', hairColor: '#120c08', beard: 'pencil', beardColor: '#120c08', checkerHem: true, build: { h: 1, w: 0.94, limb: 1 } } },
    lind:      { stats: { striking: 70, power: 86, grappling: 84, defense: 66, strength: 92, cardio: 66, chin: 88 },
                 rig: { hair: 'crew', hairColor: '#f1ecd2', beard: 'none', build: { h: 0.88, w: 1.32, limb: 0.9 } } },
    dorsey:    { stats: { striking: 80, power: 78, grappling: 52, defense: 82, strength: 70, cardio: 74, chin: 88 },
                 rig: { hair: 'buzz', hairColor: '#8a8178', beard: 'handlebar', beardColor: '#f2e6b0', camo: true, build: { h: 1, w: 1.1, limb: 1 } } },
    vale:      { stats: { striking: 86, power: 88, grappling: 58, defense: 68, strength: 78, cardio: 64, chin: 80 },
                 rig: { hair: 'zigzag', hairColor: '#0e0a08', stripe: '#e8e0c8', beard: 'goatee', beardColor: '#0e0a08', inkTrim: true, build: { h: 1.12, w: 1.02, limb: 1.1 } } },
    reyes:     { stats: { striking: 66, power: 56, grappling: 93, defense: 72, strength: 68, cardio: 88, chin: 74 },
                 rig: { hair: 'ponytail', hairColor: '#0f0b08', beard: 'none', build: { h: 1, w: 0.95, limb: 1 } } },
    torres:    { stats: { striking: 84, power: 64, grappling: 58, defense: 74, strength: 58, cardio: 86, chin: 74 },
                 rig: { hair: 'twists', hairColor: '#120c08', beard: 'none', build: { h: 1, w: 0.88, limb: 1 } } },
    salgado:   { stats: { striking: 64, power: 62, grappling: 88, defense: 68, strength: 80, cardio: 82, chin: 74 },
                 rig: { hair: 'bowl', hairColor: '#120c08', beard: 'none', babyface: true, build: { h: 0.9, w: 0.92, limb: 0.95 } } }
  };
  const FALLBACK = [
    ['reyes', 'Mateo', 'Reyes', 'Anaconda', 'FLY', 'BJJ', 'VOLUME', true, '#1F8F3A', '#F2D21B', '#b97f55', 'Pulls guard, scrambles to the back, finishes with the rear-naked choke.'],
    ['torres', 'Kai', 'Torres', 'Rapidfire', 'FLY', 'BOX', 'VOLUME', false, '#F07A12', '#A34A00', '#8a5634', 'Young, blazing hand speed, volume punching.'],
    ['salgado', 'Nico', 'Salgado', 'Whiz Kid', 'FLY', 'WR', 'SMOTHER', false, '#7B3FC4', '#B07AE0', '#c9926a', 'Teen phenom: explosive shots, chokes in transitions.'],
    ['aslanov', 'Timur', 'Aslanov', 'The Vise', 'LW', 'WR', 'SMOTHER', true, '#7D838E', '#4A4D52', '#d9a77f', 'Greco-Roman body locks, then crushing top pressure.'],
    ['okafor', 'Dante', 'Okafor', 'Sawblade', 'LW', 'MT', 'PRESSURE', false, '#D7263D', '#141114', '#7a4a2c', 'Relentless leg kicks; eats shots to land bombs.'],
    ['marchetti', 'Lucien', 'Marchetti', 'Snapback', 'LW', 'BOX', 'COUNTER', false, '#F2B124', '#141114', '#e6b994', 'Southpaw counter-puncher with a check hook.'],
    ['dorsey', 'Hank', 'Dorsey', 'Shell Game', 'MW', 'BOX', 'PRESSURE', true, '#5B6B3A', '#8A7A4A', '#e8b48e', 'High shoulder-roll guard, endless jab.'],
    ['hollander', 'Wes', 'Hollander', 'Lockjaw', 'MW', 'BOX', 'VOLUME', false, '#14A3A0', '#0B5E5C', '#e2b08c', 'Southpaw grinder, crisp combos, sneaky guillotine.'],
    ['vale', 'Marcus', 'Vale', 'Stilts', 'HW', 'MT', 'CREATIVE', true, '#F4F4F4', '#E0283C', '#5a3420', 'Spinning back fists, spinning back kicks, switch head kicks.'],
    ['lind', 'Oskar', 'Lind', 'Millstone', 'HW', 'WR', 'PRESSURE', false, '#1B2A5C', '#3F5AA8', '#f0c9a8', 'Squat wrestler-brawler: body locks and heavy hands.']
  ].map(a => ({ id: a[0], firstName: a[1], lastName: a[2], nickname: a[3], weightClass: a[4], discipline: a[5], approach: a[6], isChampion: a[7], styleHook: a[11],
    look: { primaryColor: a[8], secondaryColor: a[9], skinRef: a[10] } }));
  const ROSTER = [];
  const WC_ORDER = ['FLY', 'LW', 'MW', 'HW'];
  // record from fighters.json if present: "12-1-0", {w,l,d} or {wins,losses,draws}. null = engine seeds one (respecting lore losses).
  function parseRecord(r) {
    if (!r) return null;
    if (typeof r === 'string') { const m = r.match(/(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?/); return m ? { w: +m[1], l: +m[2], d: +(m[3] || 0) } : null; }
    const w = r.w != null ? r.w : r.wins, l = r.l != null ? r.l : r.losses, d = r.d != null ? r.d : r.draws;
    return w != null && l != null ? { w: +w, l: +l, d: +(d || 0) } : null;
  }
  function buildRoster(json) {
    const list = (json && Array.isArray(json.fighters) && json.fighters.length) ? json.fighters : FALLBACK;
    const champs = (json && json.champions) || {};
    ROSTER.length = 0;
    for (const j of list) {
      const e = ENGINE[j.id] || { stats: { striking: 60, power: 60, grappling: 60, defense: 60, strength: 60, cardio: 60, chin: 60 }, rig: {} };
      const lk = j.look || {};
      const look = L(Object.assign({ skin: lk.skinRef || '#c68a5e', shorts: [lk.primaryColor || '#444', lk.secondaryColor || '#999'], gloves: lk.secondaryColor && lk.primaryColor === '#F4F4F4' ? '#1a1a1a' : (lk.primaryColor || '#222') }, e.rig));
      ROSTER.push({ id: j.id, first: j.firstName, last: j.lastName, nick: j.nickname, wc: j.weightClass, disc: j.discipline, appr: j.approach,
        southpaw: !!j.southpaw, champion: champs[j.weightClass] ? champs[j.weightClass] === j.id : !!j.isChampion,
        hook: j.styleHook || '', stats: Object.assign({}, e.stats), look,
        record: parseRecord(j.record), notable: (j.lore && j.lore.notableResults) || [],
        minLosses: ((j.lore && j.lore.notableResults) || []).filter(n => /^l/i.test(n.result || '')).length });
    }
    ROSTER.sort((a, b) => WC_ORDER.indexOf(a.wc) - WC_ORDER.indexOf(b.wc) || (b.champion - a.champion));
    return ROSTER;
  }
  buildRoster(null);

  const CAREER_LOOKS = [
    { id: 'p1', name: 'Classic', look: L({ skin: '#d6a07a', hair: 'buzz', hairColor: '#2a1a10', shorts: ['#1d4ed8', '#93c5fd'], gloves: '#1d4ed8' }) },
    { id: 'p2', name: 'Bruiser', look: L({ skin: '#7a4a2c', hair: 'shaved', beard: 'full', shorts: ['#b91c1c', '#111'], gloves: '#b91c1c', tape: true }) },
    { id: 'p3', name: 'Showman', look: L({ skin: '#f0c9a8', hair: 'slick', hairColor: '#c08a2a', shorts: ['#111', '#d4a017'], gloves: '#d4a017' }) },
    { id: 'p4', name: 'Grinder', look: L({ skin: '#b97f55', hair: 'curly', beard: 'thick', shorts: ['#065f46', '#34d399'], gloves: '#065f46' }) },
    { id: 'p5', name: 'Rookie', look: L({ skin: '#8a5634', hair: 'twists', shorts: ['#7c3aed', '#c4b5fd'], gloves: '#7c3aed', babyface: true }) },
    { id: 'p6', name: 'Viking', look: L({ skin: '#f3d3b8', hair: 'ponytail', hairColor: '#d9b45a', beard: 'full', beardColor: '#d9b45a', shorts: ['#334155', '#e2e8f0'], gloves: '#334155' }) }
  ];

  // Generated-opponent names come from ../content/names.json via CK.Text.generateName (no name pool here).
  const SKINS = ['#f3d3b8', '#e8b48e', '#d6a07a', '#c68a5e', '#b97f55', '#8a5634', '#7a4a2c', '#5a3420'];
  const HAIRS = ['shaved', 'buzz', 'slick', 'mullet', 'ponytail', 'twists', 'bowl', 'braids', 'curly'];
  const SHORTS = [['#b91c1c', '#111'], ['#1d4ed8', '#fff'], ['#111', '#e5e5e5'], ['#065f46', '#d1fae5'], ['#9333ea', '#111'], ['#ea580c', '#fff7ed'], ['#0f766e', '#99f6e4'], ['#be185d', '#fbcfe8'], ['#334155', '#f59e0b']];

  CK.DATA = { STAT_KEYS, STAT_LABELS, DISCIPLINES, APPROACHES, ROSTER, buildRoster, WC_ORDER, CAREER_LOOKS, SKINS, HAIRS, SHORTS, makeLook: L };
})();
