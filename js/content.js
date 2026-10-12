/* CAGE KINGS - content.js : loads Larry's game text from ../content/*.json, with built-in fallbacks.
 * CK.Text.ui('pause.title', vars, 'Paused')        -> string from ui.json (placeholders filled)
 * CK.Text.callout('takedown', vars, 'TAKEDOWN!')    -> random no-repeat line from callouts.json
 * CK.Text.pick(list, bagKey, vars)                  -> shuffle-bag pick from any variant list
 */
(function () {
  const FILES = ['fighters', 'names', 'career-events', 'callouts', 'scorecards', 'corner-tips', 'rivals', 'ui'];
  const T = {
    data: {}, loaded: false, bags: {}, rng: Math.random, device: 'keyboard',
    load() {
      const base = CK.ASSET_PATHS.content;
      return Promise.all(FILES.map(f => fetch(base + f + '.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null)
        .then(j => { T.data[f] = j; }))).then(() => { T.loaded = true; });
    },
    get(file, path) {
      let o = T.data[file]; if (!o) return undefined;
      for (const k of path.split('.')) { if (o == null) return undefined; o = o[k]; }
      return o;
    },
    fill(text, vars) {
      if (typeof text !== 'string') return text;
      vars = vars || {};
      return text.replace(/\{(\w+)\}/g, (m, k) => {
        if (k in vars) return vars[k];
        const tok = T.get('ui', 'controls.tokens.' + k); if (tok) return tok[T.device] || tok.keyboard;
        if (k === 'promotionShort') return 'AFL'; if (k === 'promotion') return 'Apex Fighting League';
        return m;
      });
    },
    ui(path, vars, fallback) { const v = T.get('ui', path); return T.fill(typeof v === 'string' ? v : fallback, vars); },
    // uniform random, never repeating the last pick of this list (shuffle bag)
    pick(list, bagKey, vars, filter) {
      if (!Array.isArray(list) || !list.length) return null;
      let pool = list; if (filter) { pool = list.filter(filter); if (!pool.length) pool = list; }
      // skip variants needing placeholders we don't have
      if (vars) { const ok = pool.filter(v => !/\{(\w+)\}/.test(v.text || '') || [...(v.text || '').matchAll(/\{(\w+)\}/g)].every(m => m[1] in vars || T.get('ui', 'controls.tokens.' + m[1]) || /promotion/.test(m[1]))); if (ok.length) pool = ok; }
      bagKey = bagKey || JSON.stringify(pool.map(v => v.id || v.text || v)).slice(0, 80);
      let bag = T.bags[bagKey];
      if (!bag || !bag.items.length) {
        const ids = pool.map((_, i) => i);
        for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(T.rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
        if (bag && ids.length > 1 && pool[ids[ids.length - 1]] === bag.last) ids.unshift(ids.pop());
        bag = T.bags[bagKey] = { items: ids, last: bag && bag.last };
      }
      const v = pool[bag.items.pop()] || pool[0]; bag.last = v;
      return Object.assign({}, v, { text: T.fill(v.text, vars), title: v.title ? T.fill(v.title, vars) : undefined });
    },
    callout(cat, vars, fallback) {
      const list = T.get('callouts', 'callouts.' + cat);
      const v = T.pick(list, 'callout.' + cat, vars);
      return v ? v.text : T.fill(fallback, vars);
    },
    event(cat, sub, vars, fallback) {
      const v = T.pick(T.get('career-events', 'events.' + cat + '.' + sub), 'ev.' + cat + '.' + sub, vars);
      return v || (fallback ? { text: T.fill(fallback, vars), title: '' } : null);
    },
    label(group, key, fallback) { const v = T.get('ui', 'labels.' + group + '.' + key); return (v && (v.label || (typeof v === 'string' ? v : null))) || fallback || key; },
    fighter(id) { const fs = T.get('fighters', 'fighters'); return fs ? fs.find(f => f.id === id) : null; },
    // context button label for the HUD / touch buttons, from ui.json hud.contextButtons
    contextLabel(state, key, fallback) { const v = T.get('ui', 'hud.contextButtons.' + state + '.' + key); return v != null ? v : fallback; },
    position(key, fallback) { return T.get('ui', 'hud.positions.' + key) || fallback; },
    // ----- names for generated fighters (names.json); fallback is a tiny original-only pool -----
    generateName(rng, disc, appr, taken) {
      const N = T.data.names; taken = taken || new Set();
      const FB = { first: ['Rook', 'Tavin', 'Bram', 'Colt', 'Eamon', 'Jory', 'Lasse', 'Marek', 'Orrin', 'Pell'], last: ['Ashgrove', 'Kettleby', 'Marlowe', 'Penhallow', 'Quarry', 'Stoneham', 'Thistle', 'Warrick', 'Yarrow', 'Bexley'],
        nick: ['Night Shift', 'Paper Route', 'Long Division', 'Tow Truck', 'Undertow'] };
      for (let tries = 0; tries < 40; tries++) {
        let first, last, nick = '';
        if (N && N.firstNames) {
          const region = rng.weighted(N.regionWeights);
          const lastRegion = rng.chance(0.85) ? region : rng.weighted(N.regionWeights);
          first = rng.pick(N.firstNames[region]); last = rng.pick(N.lastNames[lastRegion]);
          const W = N.nicknameTagWeights;
          if (!rng.chance(W.noNicknameChance)) {
            let tag = rng.chance(W.generalChance) ? 'general' : rng.pick(rng.chance(0.5) ? W.byApproach[appr] : W.byDiscipline[disc]);
            nick = rng.pick(N.nicknames[tag] || N.nicknames.general);
          }
          const res = N.reserved || { lastNames: [], nicknames: [] };
          if (res.lastNames.includes(last) || res.nicknames.includes(nick)) continue;
        } else { first = rng.pick(FB.first); last = rng.pick(FB.last); nick = rng.chance(0.75) ? rng.pick(FB.nick) : ''; }
        if (taken.has(first + ' ' + last)) continue;
        taken.add(first + ' ' + last);
        return { first, last, nick };
      }
      return { first: 'Sam', last: 'Doe' + Math.floor(rng() * 100), nick: '' };
    },
    reservedNames() { const r = T.get('names', 'reserved'); return r ? r.lastNames.map(s => s.toLowerCase()) : []; }
  };
  CK.Text = T;
})();
