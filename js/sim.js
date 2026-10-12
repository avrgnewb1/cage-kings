/* CAGE KINGS - sim.js : headless AI-vs-AI fights (used by tests and balance tuning) */
(function () {
  const Sim = {
    run(opts) {
      const a = CK.Fighters.fromRoster(opts.a), b = CK.Fighters.fromRoster(opts.b);
      const fight = new CK.Fight({ a, b, ctrlA: CK.AI.make(opts.levelA || opts.level || 'normal', a), ctrlB: CK.AI.make(opts.levelB || opts.level || 'normal', b),
        seed: opts.seed, headless: true, title: !!opts.title });
      const dt = 1000 / CK.CONFIG.TICK_HZ; let steps = 0; const cap = 60 * 60 * 12;
      while (fight.phase !== 'over' && steps < cap) { fight.step(dt); steps++; }
      const r = fight.result || { method: 'TIMEOUT' };
      const bad = fight.f.some(f => [f.head, f.body, f.leg, f.stam, f.ref, f.x].some(v => typeof v !== 'number' || isNaN(v)));
      if (bad) throw new Error('NaN in fighter state: ' + opts.a + ' vs ' + opts.b);
      const W = r.winner === 0 ? a : r.winner === 1 ? b : null;
      return { a: a.name, b: b.name, winner: W ? W.name : 'Draw', method: r.method, detail: r.detail, round: r.round, clock: r.clock, steps,
        stats: fight.f.map(f => ({ head: Math.round(f.head), body: Math.round(f.body), leg: Math.round(f.leg), stam: Math.round(f.stam), kd: f.kdTotal })),
        line: `${a.name} vs ${b.name}: ${W ? W.name : 'Draw'} by ${r.method} (${r.detail}) R${r.round} ${r.clock}${r.readout ? ' [' + r.readout + ']' : ''}` };
    },
    batch(n, opts) {
      const ids = CK.DATA.ROSTER.map(r => r.id); const rng = CK.makeRng(opts.seed || 99); const fights = []; const summary = { n, KO: 0, TKO: 0, SUB: 0, DEC: 0, DRAW: 0, TIMEOUT: 0, details: {} };
      for (let i = 0; i < n; i++) {
        let a = ids[i % ids.length];
        // same-division opponent unless opts.crossDivision (every class has 2+ signature fighters)
        const wcA = CK.DATA.ROSTER.find(r => r.id === a).wc, pool = opts.crossDivision ? ids : CK.DATA.ROSTER.filter(r => r.wc === wcA).map(r => r.id);
        let b = rng.pick(pool); while (b === a) b = rng.pick(pool.length > 1 ? pool : ids);
        const r = Sim.run({ a, b, level: opts.level, seed: (opts.seed || 1) * 1000 + i, title: opts.title });
        fights.push(r); summary[r.method] = (summary[r.method] || 0) + 1; summary.details[r.detail] = (summary.details[r.detail] || 0) + 1;
      }
      return { summary, fights };
    }
  };
  CK.Sim = Sim;
})();
