/* CAGE KINGS - fighters.js : build fighter definitions (signature roster + career / generated) */
(function () {
  const D = () => CK.DATA;
  const F = {
    // A "def" is everything the fight needs to spawn a fighter.
    fromRoster(id) {
      const r = D().ROSTER.find(x => x.id === id); if (!r) throw new Error('No fighter ' + id);
      return { id: r.id, name: r.first + ' ' + r.last, first: r.first, last: r.last, nick: r.nick, wc: r.wc, disc: r.disc, appr: r.appr,
        stats: Object.assign({}, r.stats), look: r.look, skin: r.id, signature: true, hook: r.hook, champion: !!r.champion, southpaw: !!r.southpaw, record: r.record, notable: r.notable, minLosses: r.minLosses || 0 };
    },
    // base stats for a created / generated fighter: 45 + discipline mods + approach mods + extra
    baseStats(disc, appr, base, extra) {
      const s = {}; const dm = D().DISCIPLINES[disc].mods, am = D().APPROACHES[appr].mods;
      for (const k of D().STAT_KEYS) s[k] = CK.clamp(Math.round((base || 45) + (dm[k] || 0) + (am[k] || 0) + ((extra && extra[k]) || 0)), 10, 99);
      return s;
    },
    generate(rng, wc, rating) {
      const disc = rng.pick(Object.keys(D().DISCIPLINES)), appr = rng.pick(Object.keys(D().APPROACHES));
      const nm = CK.Text.generateName(rng, disc, appr, F.takenNames); const first = nm.first, last = nm.last;
      const base = CK.clamp(38 + (rating - 1000) / 12, 34, 74);
      const extra = {}; for (const k of D().STAT_KEYS) extra[k] = Math.round(rng.range(-5, 5));
      const look = D().makeLook({ skin: rng.pick(D().SKINS), hair: rng.pick(D().HAIRS), hairColor: rng.pick(['#1a120c', '#3b2414', '#6b4423', '#c9a24a', '#222']),
        beard: rng.pick(['none', 'none', 'full', 'thick']), shorts: rng.pick(D().SHORTS), tape: rng.chance(0.3) });
      look.gloves = look.shorts[0];
      return { id: 'gen_' + Math.floor(rng() * 1e9).toString(36), name: first + ' ' + last, first, last, nick: nm.nick, wc, disc, appr,
        stats: F.baseStats(disc, appr, base, extra), look, skin: 'default' };
    },
    takenNames: new Set(),
    label(def) { return def.nick ? `${def.first} "${def.nick}" ${def.last}` : `${def.first} ${def.last}`; },
    styleLabel(def) { return `${D().DISCIPLINES[def.disc].short} / ${D().APPROACHES[def.appr].name}`; },
    overall(stats) { const ks = D().STAT_KEYS; return Math.round(ks.reduce((a, k) => a + stats[k], 0) / ks.length); }
  };
  CK.Fighters = F;
})();
