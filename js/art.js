/* CAGE KINGS - art.js : optional image loader. Falls back to the code-drawn rig when an image is missing. */
(function () {
  const Art = {
    available: new Set(), images: {}, ready: false,
    init() {
      return fetch(CK.ASSET_PATHS.art + 'manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : { files: [] }).then(m => {
        (m.files || []).forEach(f => Art.available.add(f)); Art.ready = true;
        Object.values(CK.ART_MAP).forEach(f => { if (Art.available.has(f)) Art.loadFile(f); });
        Art.available.forEach(f => { if (/\.(png|webp)$/.test(f)) Art.loadFile(f); });
      }).catch(() => { Art.ready = true; });
    },
    loadFile(f) {
      if (Art.images[f]) return;
      const img = new Image(); img.onload = () => { Art.images[f] = img; }; img.onerror = () => {};
      img.src = CK.ASSET_PATHS.art + f;
    },
    get(key) { const f = CK.ART_MAP[key]; return f && Art.images[f] || null; },
    // rig part lookup: fighter skin first, then default
    part(skin, part) {
      return Art.images[skin + '/' + part + '.png'] || Art.images[skin + '/' + part + '.webp'] ||
             Art.images['default/' + part + '.png'] || null;
    },
    hasAnyParts(skin) { for (const p of CK.ART_PARTS) if (Art.part(skin, p)) return true; return false; }
  };
  CK.Art = Art;
})();
