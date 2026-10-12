/* CAGE KINGS - career.js : career state, training, offers, rankings, rivals. Saved to localStorage. */
(function () {
  const C = CK.CONFIG, KEY = 'cagekings.career.v1';
  const ACTIVITIES = {
    sparring:     { stats: ['striking', 'defense'], disc: 'BOX', fatigue: 1.1 },
    wrestling:    { stats: ['grappling', 'strength'], disc: 'WR', fatigue: 1.2 },
    bjj:          { stats: ['grappling', 'defense'], disc: 'BJJ', fatigue: 1.0 },
    muayThaiPads: { stats: ['striking', 'power'], disc: 'MT', fatigue: 1.1 },
    roadwork:     { stats: ['cardio', 'chin'], disc: null, fatigue: 0.9 },
    rest:         { stats: [], disc: null, fatigue: 0 }
  };
  // cross-training a second discipline unlocks one of its signature moves
  const UNLOCKS = { BOX: 'chain', MT: 'teep', WR: 'reshot', BJJ: 'pull' };
  const MOVE_NAMES = { chain: 'Hook > uppercut chain', teep: 'Teep', reshot: 'Chain re-shot', pull: 'Guard pull' };

  const Career = {
    s: null, ACTIVITIES, UNLOCKS, MOVE_NAMES,
    load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) Career.s = s; } catch (e) { Career.s = null; } return Career.s; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(Career.s)); } catch (e) {} },
    clear() { localStorage.removeItem(KEY); Career.s = null; },
    exists() { return !!Career.load(); },
    rng() { const s = Career.s; s.seed = (s.seed * 1103515245 + 12345) & 0x7fffffff; return CK.makeRng(s.seed); },

    create(opt) {
      const seed = (opt.seed || Date.now()) & 0x7fffffff;
      const stats = CK.Fighters.baseStats(opt.disc, opt.appr, 44);
      const s = Career.s = {
        v: 1, seed, created: Date.now(), difficulty: opt.difficulty || 'normal', event: 1,
        player: { id: 'player', first: opt.first, last: opt.last, nick: opt.nick || '', wc: opt.wc, disc: opt.disc, appr: opt.appr, lookId: opt.lookId, stats, fatigue: 0, unlocks: [], cross: {}, rating: 1000 },
        record: { w: 0, l: 0, d: 0 }, finishStreak: 0, money: 0, champion: false, defenses: 0, titleShotTaken: false,
        week: 0, campWeeks: C.CAREER.campWeeks, plan: [], booked: null, offers: [], history: [], faced: {}, rivals: {}, news: [],
        div: null
      };
      Career.seedDivision();
      Career.makeOffers();
      Career.save();
      return s;
    },
    // division: signature fighters of the class + generated contenders; a champion is seeded (generated if needed)
    seedDivision() {
      const s = Career.s, wc = s.player.wc, rng = Career.rng(); const npcs = {};
      CK.Fighters.takenNames = new Set(CK.DATA.ROSTER.map(r => r.first + ' ' + r.last));
      for (const r of CK.DATA.ROSTER.filter(r => r.wc === wc)) {
        const d = CK.Fighters.fromRoster(r.id); const ov = CK.Fighters.overall(d.stats);
        // records come from fighters.json when given; otherwise seeded, never fewer losses than the lore lists (e.g. Aslanov's early loss)
        const rec = d.record || { w: 10 + Math.floor(rng() * 8), l: Math.max(d.minLosses || 0, Math.floor(rng() * 4)), d: 0 };
        npcs[r.id] = { def: d, rating: 1000 + (ov - 60) * 14 + rng.range(-20, 20), w: rec.w, l: Math.max(rec.l, d.minLosses || 0), d: rec.d || 0 };
      }
      const want = 14;
      let i = 0;
      while (Object.keys(npcs).length < want) {
        const rating = 930 + rng() * 340 - i * 4;
        const d = CK.Fighters.generate(rng, wc, rating); d.id = 'gen' + (i++);
        npcs[d.id] = { def: d, rating, w: 4 + Math.floor(rng() * 10), l: Math.floor(rng() * 6), d: rng.chance(0.15) ? 1 : 0 };
      }
      // champion: from fighters.json (champions map / isChampion); if none, a generated champion is seeded
      let champ = Object.keys(npcs).find(k => npcs[k].def.champion);
      if (!champ) { const d = CK.Fighters.generate(rng, wc, 1320); d.id = 'genChamp'; npcs[d.id] = { def: d, rating: 1320, w: 18, l: 1, d: 0 }; champ = d.id; }
      npcs[champ].rating = Math.max(npcs[champ].rating, 1290);
      s.div = { npcs, champion: champ };
    },
    // contenders sorted by rating (champion excluded). Player included.
    ladder() {
      const s = Career.s, list = Object.keys(s.div.npcs).filter(id => id !== s.div.champion).map(id => ({ id, rating: s.div.npcs[id].rating }));
      if (!s.champion) list.push({ id: 'player', rating: s.player.rating });
      list.sort((a, b) => b.rating - a.rating);
      return list;
    },
    rankOf(id) { const s = Career.s; if (id === 'player' && s.champion) return 0; if (id === 'player' && s.record.w === 0) return null; /* debutants are unranked until they win */ if (id === s.div.champion) return 0; const i = Career.ladder().findIndex(x => x.id === id); return i >= 0 && i < 10 ? i + 1 : null; },
    rankLabel(id) { const r = Career.rankOf(id); return r === 0 ? CK.Text.ui('career.hub.champion', null, 'Champion') : r ? '#' + r : CK.Text.ui('career.hub.unranked', null, 'Unranked'); },
    npc(id) { return Career.s.div.npcs[id]; },
    playerDef() {
      const p = Career.s.player, look = (CK.DATA.CAREER_LOOKS.find(l => l.id === p.lookId) || CK.DATA.CAREER_LOOKS[0]).look;
      return { id: 'player', name: p.first + ' ' + p.last, first: p.first, last: p.last, nick: p.nick, wc: p.wc, disc: p.disc, appr: p.appr, stats: Object.assign({}, p.stats), look, skin: 'career_' + p.lookId, fatigue: p.fatigue, unlocks: p.unlocks.slice() };
    },
    titleEligible() {
      const s = Career.s; if (s.champion) return false; const r = Career.rankOf('player');
      return r === C.CAREER.titleShotRank || (r && r <= C.CAREER.finishStreakRank && s.finishStreak >= C.CAREER.finishStreakNeeded);
    },
    // ---- offers: 2-3 cards with trade-offs; no opponent more than twice before the title shot ----
    makeOffers() {
      const s = Career.s, rng = Career.rng(), lad = Career.ladder(), me = lad.findIndex(x => x.id === 'player');
      const offers = [];
      const ok = (id) => id !== 'player' && id !== s.div.champion && ((s.faced[id] || 0) < 2 || s.titleShotTaken);
      if (Career.titleEligible()) offers.push(Career.offerFor(s.div.champion, { title: true }, rng));
      if (s.champion) { // title defenses vs top contenders
        lad.slice(0, 4).filter(x => ok(x.id)).slice(0, 2).forEach(x => offers.push(Career.offerFor(x.id, { title: true, defense: true }, rng)));
      }
      // rival rematch (lost close / draw)
      for (const id in s.rivals) { const r = s.rivals[id]; if ((r.outcome === 'lostClose' || r.outcome === 'draw') && !r.rematchOffered && ok(id) && offers.length < 3) { offers.push(Career.offerFor(id, { rematch: true }, rng)); r.rematchOffered = true; } }
      const cands = lad.map((x, i) => ({ id: x.id, i })).filter(x => ok(x.id));
      const near = cands.filter(x => Math.abs(x.i - me) <= 4).sort(() => rng() - 0.5);
      const pool = near.length >= 3 ? near : cands.sort(() => rng() - 0.5);
      for (const c of pool) { if (offers.length >= 3) break; if (offers.some(o => o.opp === c.id)) continue; offers.push(Career.offerFor(c.id, { shortNotice: offers.length === 1 && rng.chance(0.6) }, rng)); }
      s.offers = offers.slice(0, Math.max(2, Math.min(3, offers.length)));
      Career.save();
    },
    offerFor(id, o, rng) {
      const s = Career.s, n = Career.npc(id), rank = Career.rankOf(id), myRank = Career.rankOf('player');
      const short = !!o.shortNotice && !o.title;
      const base = C.CAREER.basePurse * (1 + (rank ? (11 - rank) * 0.35 : 0)) * (o.title ? 4 : 1);
      const purse = Math.round(base * (short ? 1.5 : 1) / 100) * 100;
      // rank jump estimate if you win
      const gain = C.CAREER.winRating + Math.max(0, n.rating - s.player.rating) * C.CAREER.upsetFactor;
      const lad = Career.ladder().map(x => x.id === 'player' ? { id: x.id, rating: x.rating + gain } : x).sort((a, b) => b.rating - a.rating);
      const newRank = lad.findIndex(x => x.id === 'player') + 1;
      const jump = o.title ? 'Title' : (myRank ? Math.max(0, myRank - Math.min(newRank, 11)) : (newRank <= 10 ? 11 - newRank : 0));
      const hype = Math.min(4, (rank ? (rank <= 3 ? 3 : rank <= 6 ? 2 : 1) : 0) + (short ? 1 : 0) + (o.title ? 1 : 0) + (o.rematch ? 1 : 0));
      return { opp: id, rank, purse, shortNotice: short, camp: short ? Math.ceil(C.CAREER.campWeeks / 2) : C.CAREER.campWeeks, hype, jump, title: !!o.title, defense: !!o.defense, rematch: !!o.rematch,
        rounds: o.title ? C.TITLE_ROUNDS : C.ROUNDS, event: 'AFL ' + (40 + s.event), faced: s.faced[id] || 0 };
    },
    accept(i) {
      const s = Career.s, o = s.offers[i]; if (!o) return;
      s.booked = o; s.offers = []; s.week = 0; s.campWeeks = o.camp; s.plan = []; Career.save();
    },
    // ---- training ----
    train(act) {
      const s = Career.s, p = s.player, A = ACTIVITIES[act]; if (!A || !s.booked || s.week >= s.campWeeks) return null;
      const gains = {};
      for (const st of A.stats) {
        const cur = p.stats[st], g = Math.max(1, Math.round(C.CAREER.gainBase * (1 - (cur - 40) * C.CAREER.gainDiminish) * (p.fatigue > 70 ? 0.5 : 1)));
        p.stats[st] = Math.min(C.CAREER.statCap, cur + g); gains[st] = g;
      }
      if (act === 'rest') p.fatigue = Math.max(0, p.fatigue - C.CAREER.restRecovery);
      else p.fatigue = Math.min(100, p.fatigue + C.CAREER.fatiguePerWeek * A.fatigue);
      let unlocked = null;
      if (A.disc && A.disc !== p.disc) {
        p.cross[A.disc] = (p.cross[A.disc] || 0) + 1;
        const mv = UNLOCKS[A.disc];
        if (p.cross[A.disc] >= C.CAREER.crossTrainUnlockWeeks && !p.unlocks.includes(mv)) { p.unlocks.push(mv); unlocked = mv; }
      }
      s.week++; s.plan.push(act); Career.save();
      return { gains, unlocked };
    },
    autoPlan() {
      const s = Career.s, p = s.player, out = [];
      while (s.booked && s.week < s.campWeeks) {
        let act;
        if (p.fatigue > 55 || s.week === s.campWeeks - 1 && p.fatigue > 25) act = 'rest';
        else {
          const score = (a) => ACTIVITIES[a].stats.reduce((t, st) => t + (100 - p.stats[st]), 0) + (ACTIVITIES[a].disc === p.disc ? 12 : 0);
          act = ['sparring', 'wrestling', 'bjj', 'muayThaiPads', 'roadwork'].sort((a, b) => score(b) - score(a))[0];
        }
        out.push({ act, res: Career.train(act) });
      }
      return out;
    },
    // ---- fight result ----
    applyResult(result) {
      const s = Career.s, o = s.booked, n = Career.npc(o.opp); const won = result.winner === 0, draw = result.winner === -1;
      const oldRank = Career.rankOf('player'); const finish = ['KO', 'TKO', 'SUB'].includes(result.method);
      const C2 = C.CAREER; let dr;
      if (won) { dr = C2.winRating + Math.max(0, n.rating - s.player.rating) * C2.upsetFactor + (finish ? C2.finishBonus : 0); s.record.w++; n.l++; s.finishStreak = finish ? s.finishStreak + 1 : 0; }
      else if (draw) { dr = 4; s.record.d++; n.d++; }
      else { dr = -C2.lossRating - (finish ? 6 : 0); s.record.l++; n.w++; s.finishStreak = 0; }
      s.player.rating += dr; n.rating -= dr * 0.7;
      const purse = won ? o.purse * 2 : o.purse; const bonus = won && finish ? Math.round(o.purse * 0.5) : 0;
      s.money += purse + bonus;
      s.faced[o.opp] = (s.faced[o.opp] || 0) + 1;
      let titleNote = null;
      if (o.title) {
        s.titleShotTaken = true;
        if (o.defense) { if (won) { s.defenses++; titleNote = 'defense'; } else if (!draw) { s.champion = false; s.div.champion = o.opp; titleNote = 'loss'; } }
        else if (won) { s.champion = true; const old = s.div.champion; s.div.champion = 'player'; n.rating = Math.max(n.rating, 1150); s.div.npcs[old] && (s.div.npcs[old].rating -= 20); titleNote = 'win'; }
        else titleNote = 'challengerLoss';
      }
      // rivals remember (signature fighters only)
      if (n.def.signature) {
        const kind = result.detail || '';
        const outcome = won ? (result.method === 'SUB' ? 'lostBySubmission' : finish ? 'lostByFinish' : /Split|Majority/.test(kind) ? 'lostClose' : 'lostByDecision') : draw ? 'draw' : 'beatPlayer';
        s.rivals[o.opp] = { outcome, method: result.method, detail: result.detail, event: o.event, rematchOffered: false };
      }
      s.player.fatigue = Math.round(s.player.fatigue * 0.3);
      // the rest of the division keeps fighting
      const rng = Career.rng(); const ids = Object.keys(s.div.npcs).filter(id => id !== o.opp);
      for (let i = 0; i < 4; i++) { const a = rng.pick(ids), b = rng.pick(ids); if (a === b) continue; const A = s.div.npcs[a], B = s.div.npcs[b]; const aw = rng.chance(0.5 + (A.rating - B.rating) / 800); (aw ? A : B).rating += 18; (aw ? B : A).rating -= 18; (aw ? A : B).w++; (aw ? B : A).l++; }
      const entry = { event: o.event, opp: o.opp, oppName: n.def.name, result: won ? 'W' : draw ? 'D' : 'L', method: result.method, detail: result.detail, round: result.round, clock: result.clock, title: o.title, purse: purse + bonus };
      s.history.unshift(entry);
      s.booked = null; s.event++; s.week = 0;
      const newRank = Career.rankOf('player');
      Career.makeOffers(); Career.save();
      return { entry, oldRank, newRank, purse, bonus, titleNote, dr };
    },
    // text helpers
    rivalLine(id) {
      const r = Career.s.rivals[id]; if (!r) return null;
      const T = CK.Text, byF = T.get('rivals', 'preFight.byFighter.' + id + '.' + r.outcome), gen = T.get('rivals', 'preFight.generic.' + r.outcome);
      const v = T.pick(byF && byF.length ? byF : gen, 'rival.' + id, { fighter: Career.s.player.first + ' ' + Career.s.player.last, fighterLast: Career.s.player.last, rival: Career.npc(id).def.name });
      return v ? v.text : null;
    },
    recordStr(rec) { return `${rec.w}-${rec.l}-${rec.d}`; }
  };
  CK.Career = Career;
})();
