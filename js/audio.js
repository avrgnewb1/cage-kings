/* CAGE KINGS - audio.js : small Web Audio manager.
 * - No AudioContext and no audio fetches until the first user gesture (autoplay rules).
 * - Files are only requested if listed in <audio>/manifest.json, so a missing pack is silent with no 404s.
 * - Loops (crowd, music, sub bed) use AudioBufferSourceNode.loop = true on decoded OGG (gapless).
 * - One-shots use OGG when supported, MP3 otherwise (Safari).
 */
(function () {
  const A = {
    ctx: null, buffers: {}, available: new Set(), loops: {}, wantLoops: {}, muted: false, ready: false, unlocked: false,
    vol: { master: 0.9, sfx: 1.0, music: 0.6, amb: 0.8 }, buses: {}, lastVariant: {}, ext: 'ogg', played: [], manifest: null, files: {},
    init() {
      try { const m = JSON.parse(localStorage.getItem('cagekings.settings') || '{}'); if (m.muted) A.muted = true; if (m.vol) Object.assign(A.vol, m.vol); } catch (e) {}
      fetch(CK.ASSET_PATHS.audio + 'manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : { files: [] })
        .then(m => { A.manifest = m; (m.files || []).forEach(f => A.available.add(f)); A.resolveAll(); A.ready = true; if (A.unlocked) A.preloadAll(); })
        .catch(() => { A.ready = true; });
      const unlock = () => {
        A.unlocked = true; A.ensureCtx();
        if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
        if (A.ready) A.preloadAll();
        ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.removeEventListener(ev, unlock, true));
      };
      ['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, unlock, true));
    },
    ensureCtx() {
      if (A.ctx || !A.unlocked) return A.ctx;
      try {
        A.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = A.ctx.createGain(); master.connect(A.ctx.destination); A.buses.master = master;
        for (const b of ['sfx', 'music', 'amb']) { const g = A.ctx.createGain(); g.connect(master); A.buses[b] = g; }
        A.applyVolumes();
        const probe = document.createElement('audio');
        A.canOgg = !!(probe.canPlayType && probe.canPlayType('audio/ogg; codecs="vorbis"')); A.ext = A.canOgg ? 'ogg' : 'mp3';
      } catch (e) { A.ctx = null; }
      return A.ctx;
    },
    applyVolumes() {
      if (!A.ctx) return;
      A.buses.master.gain.value = A.muted ? 0 : A.vol.master;
      for (const b of ['sfx', 'music', 'amb']) A.buses[b].gain.value = A.vol[b];
    },
    setMuted(m) { A.muted = !!m; A.applyVolumes(); A.saveSettings(); },
    saveSettings() { try { localStorage.setItem('cagekings.settings', JSON.stringify({ muted: A.muted, vol: A.vol })); } catch (e) {} },
    // cue -> list of file stems, from manifest.json: exact stem or stem_NN variants; else manifest fallback / synth fallback
    resolveAll() {
      const m = A.manifest || {}, stems = new Set([...A.available].map(f => f.replace(/\.(ogg|mp3)$/, '')));
      const fb = m.fallbacks || {}, syn = m.synth_fallbacks || {};
      for (const cue in CK.SOUND_MAP) {
        const st = CK.SOUND_MAP[cue].stem; if (!st) { A.files[cue] = []; continue; }
        let list = [...stems].filter(x => x === st || new RegExp('^' + st + '_\\d+$').test(x)).sort();
        if (!list.length && fb[st] && stems.has(fb[st])) list = [fb[st]];
        if (!list.length) { const sv = Object.keys(syn).filter(k => k === st || k.startsWith(st + '_')).map(k => syn[k]).filter(x => stems.has(x)); list = sv; }
        A.files[cue] = list;
      }
    },
    fileFor(stem, loop) {
      // loops: OGG first whenever the browser can decode it (gapless); one-shots: best supported format
      const order = A.ext === 'ogg' || loop && A.canOgg ? ['ogg', 'mp3'] : ['mp3', 'ogg'];
      for (const e of order) { const f = stem + '.' + e; if (A.available.has(f)) return f; }
      return null;
    },
    loadStem(stem, loop) {
      if (A.buffers[stem] !== undefined) return A.buffers[stem];
      const file = A.fileFor(stem, loop);
      if (!file || !A.ctx) { if (A.ready && A.ctx) A.buffers[stem] = null; return null; }
      A.buffers[stem] = 'loading';
      fetch(CK.ASSET_PATHS.audio + file).then(r => r.arrayBuffer())
        .then(b => new Promise((res, rej) => A.ctx.decodeAudioData(b, res, rej)))
        .then(buf => { buf._mp3 = /\.mp3$/.test(file); A.buffers[stem] = buf; A.startWantedLoops(); })
        .catch(() => { A.buffers[stem] = null; });
      return 'loading';
    },
    preloadAll() { if (!A.ensureCtx()) return; for (const k in A.files) for (const s of A.files[k]) A.loadStem(s, CK.SOUND_MAP[k].loop); },
    pickStem(name) {
      const files = A.files[name]; if (!files || !files.length) return null;
      if (files.length === 1) return files[0];
      let i = Math.floor(Math.random() * files.length);
      if (files[i] === A.lastVariant[name]) i = (i + 1) % files.length;
      return (A.lastVariant[name] = files[i]);
    },
    play(name, opts) {
      try {
        A.played.push(name); if (A.played.length > 50) A.played.shift();
        const e = CK.SOUND_MAP[name]; if (!e || !A.ensureCtx()) return;
        if (e.loop) return A.loop(name);
        const stem = A.pickStem(name);
        if (!stem) { if (A.ready && e.alt && !(opts && opts.isAlt)) e.alt.forEach(n => A.play(n, { isAlt: true })); return; }
        const buf = A.loadStem(stem); if (!buf || buf === 'loading') return;
        const src = A.ctx.createBufferSource(); src.buffer = buf;
        src.playbackRate.value = (e.rate || 1) * ((opts && opts.rate) || 1) * (0.97 + Math.random() * 0.06);
        const g = A.ctx.createGain(); g.gain.value = (e.vol || 1) * ((opts && opts.vol) || 1);
        src.connect(g); g.connect(A.buses[e.bus || 'sfx']); src.start();
      } catch (err) { /* silent by design */ }
    },
    // Gapless loop. If the buffer is not decoded yet it starts as soon as it is.
    loop(name) {
      A.wantLoops[name] = true;
      if (A.loops[name] || !A.ensureCtx()) return;
      const e = CK.SOUND_MAP[name]; const stem = A.files[name] && A.files[name][0]; if (!e || !stem) return;
      const buf = A.loadStem(stem, true); if (!buf || buf === 'loading') return;
      const src = A.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      // MP3 only (no OGG decoder): skip the encoder delay. loopStart = 1105 samples (manifest), loopEnd = start + loop length
      const m = A.manifest || {}, samples = m.loops && m.loops[stem];
      if (buf._mp3 && samples) { const st = (m.mp3_loop_start_samples || 1105) / buf.sampleRate; src.loopStart = st; src.loopEnd = st + samples / buf.sampleRate; }
      const g = A.ctx.createGain(); g.gain.value = 0; g.connect(A.buses[e.bus || 'sfx']); src.connect(g);
      g.gain.setTargetAtTime(e.vol || 1, A.ctx.currentTime, 0.15); src.start();
      A.loops[name] = { src, g };
    },
    startWantedLoops() { for (const n in A.wantLoops) if (A.wantLoops[n] && !A.loops[n]) A.loop(n); },
    stop(name, fade) {
      A.wantLoops[name] = false;
      const l = A.loops[name]; if (!l) return; delete A.loops[name];
      try { const t = A.ctx.currentTime, f = fade || 0.25; l.g.gain.setTargetAtTime(0, t, f / 3); l.src.stop(t + f + 0.05); } catch (e) {}
    },
    // switch the music bed (only one music loop at a time)
    music(name) { for (const n in CK.SOUND_MAP) if (CK.SOUND_MAP[n].bus === 'music' && n !== name) A.stop(n, 0.8); if (name) A.loop(name); },
    stopAll() { Object.keys(A.wantLoops).forEach(n => A.stop(n)); A.wantLoops = {}; }
  };
  CK.Audio = A;
})();
