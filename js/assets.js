/* CAGE KINGS - assets.js
 * ONE place for every sound name and art slot. Echo / Remy drop files in and list them in
 * the folder's manifest.json (or run: node tools/build-manifests.js). Anything missing falls back:
 * sounds are silent, art falls back to the code-drawn rig.
 */
(function () {
  // Base folders, relative to index.html. Default layout:
  //   /workspace/game/cage-kings/   <- the game (serve /workspace/game and open /cage-kings/)
  //   /workspace/game/audio/        <- Echo's files + manifest.json
  //   /workspace/game/art/          <- Remy's files + manifest.json
  CK.ASSET_PATHS = { audio: 'audio/', art: 'art/', content: 'content/' };

  // Cue name -> sound STEM in Echo's pack. Files are NOT listed here: at runtime audio.js reads ../audio/manifest.json
  // and resolves every variant of the stem ("hit_jab" -> hit_jab_01/02/03, "vo_stop" -> vo_stop). A random variant is
  // picked per play (never the same twice in a row). Loop lengths (manifest.loops), the MP3 loop offset
  // (manifest.mp3_loop_start_samples), voice fallbacks (manifest.fallbacks: vo_x -> vo_x_fallback) and synth fallbacks
  // (manifest.synth_fallbacks) also come from the manifest. If neither the stem nor its fallback file exists, "alt" cues
  // play instead (every vo_* announcer line -> bell + crowd).  bus: 'sfx' | 'music' | 'amb'.
  const VO_ALT = ['bell', 'crowd_swell'];
  CK.SOUND_MAP = {
    // strikes
    hit_light:     { stem: 'hit_jab', vol: 0.95 },
    hit_punch:     { stem: 'hit_punch', vol: 0.9 },
    hit_heavy:     { stem: 'hit_power', vol: 1.0 },
    hit_heavy_hw:  { stem: 'hit_power', vol: 1.0, rate: 0.86 },          // heavyweights hit deeper
    hit_body:      { stem: 'hit_kick_body', vol: 1.0 },
    leg_kick:      { stem: 'hit_kick_leg', vol: 1.0 },
    kick_head:     { stem: 'hit_kick_head', vol: 1.0 },
    elbow:         { stem: 'hit_elbow', vol: 1.0 },
    elbow_126:     { stem: 'hit_elbow_126', vol: 1.0 },                  // downward elbows on the ground
    knee:          { stem: 'hit_knee', vol: 1.0 },
    gnp:           { stem: 'gnp_thump', vol: 1.0 },
    whiff:         { stem: 'whiff', vol: 0.7 },
    block:         { stem: 'block', vol: 0.9 },
    perfect_block: { stem: 'parry', vol: 1.0 },
    check:         { stem: 'kick_check', vol: 1.0 },                     // leg kick checked
    kick_caught:   { stem: 'kick_caught', vol: 1.0 },
    hurt:          { stem: 'hurt_wobble', vol: 0.9 },                    // fighter wobbled
    // grappling
    takedown:      { stem: 'takedown_slam', vol: 1.0 },
    sprawl:        { stem: 'sprawl', vol: 1.0 },
    clinch:        { stem: 'clinch_grab', vol: 0.9 },
    scramble:      { stem: 'grapple_scuffle', vol: 0.8 },                // position change on the ground
    knockdown:     { stem: 'knockdown', vol: 1.0 },                      // synth fallback via manifest
    sub_loop:      { stem: 'sub_struggle_loop', vol: 0.8, loop: true, bus: 'amb' },
    sub_lock:      { stem: 'sub_lock_in', vol: 1.0 },
    sub_escape:    { stem: 'sub_escape', vol: 1.0 },
    tap:           { stem: 'tap_out', vol: 1.0 },
    // bells, ref, announcer (vo_* fall back to vo_*_fallback, then bell + crowd)
    bell_start:    { stem: 'bell_round_start', vol: 0.9 },
    bell:          { stem: 'bell_round_end', vol: 0.9 },
    clap_10s:      { stem: 'clapper_10s_warning', vol: 1.0 },
    ref_fight:     { stem: 'vo_fight', vol: 1.0, alt: VO_ALT },
    ref_work:      { stem: 'vo_work', vol: 1.0, alt: VO_ALT },
    ref_stop:      { stem: 'vo_stop', vol: 1.0, alt: VO_ALT },
    ref_break:     { stem: 'vo_break', vol: 1.0, alt: VO_ALT },
    ref_standup:   { stem: 'ref_standup', vol: 1.0 },                    // whistle stinger (no voice)
    vo_standup:    { stem: 'vo_standup', vol: 1.0, alt: VO_ALT },
    ref_stoppage:  { stem: 'ref_stoppage', vol: 1.0, alt: ['crowd_swell'] }, // whistle + crowd eruption (KO/TKO)
    vo_knockdown:  { stem: 'vo_knockdown', vol: 1.0, alt: VO_ALT },
    vo_ko:         { stem: 'vo_ko', vol: 1.0, alt: VO_ALT },
    vo_tko:        { stem: 'vo_tko', vol: 1.0, alt: VO_ALT },
    vo_submission: { stem: 'vo_submission', vol: 1.0, alt: VO_ALT },
    vo_round_1:    { stem: 'vo_round_1', vol: 1.0, alt: VO_ALT },
    vo_round_2:    { stem: 'vo_round_2', vol: 1.0, alt: VO_ALT },
    vo_round_3:    { stem: 'vo_round_3', vol: 1.0, alt: VO_ALT },
    vo_round_4:    { stem: 'vo_round_4', vol: 1.0, alt: VO_ALT },
    vo_round_5:    { stem: 'vo_round_5', vol: 1.0, alt: VO_ALT },
    vo_final_round:{ stem: 'vo_final_round', vol: 1.0, alt: VO_ALT },
    vo_touch_gloves:{ stem: 'vo_touch_gloves', vol: 1.0, alt: VO_ALT },
    // crowd
    boos:          { stem: 'crowd_boo_stall', vol: 0.9 },
    crowd_loop:    { stem: 'crowd_ambience_loop', vol: 0.8, loop: true, bus: 'amb' },
    crowd_swell:   { stem: 'crowd_roar', vol: 0.9 },
    crowd_ooh:     { stem: 'crowd_ooh', vol: 0.9 },
    // results / career
    judges_build:  { stem: 'judges_cards_build', vol: 1.0 },
    judges_reveal: { stem: 'judges_cards_reveal', vol: 1.0 },
    stinger_win:   { stem: 'stinger_win', vol: 0.9 },
    stinger_lose:  { stem: 'stinger_lose', vol: 0.9 },
    stinger_draw:  { stem: 'stinger_draw', vol: 0.9 },
    new_champion:  { stem: 'stinger_new_champion', vol: 1.0 },
    belt_fanfare:  { stem: 'stinger_belt_fanfare', vol: 1.0 },
    rank_up:       { stem: 'ui_rank_up', vol: 0.9 },
    rank_down:     { stem: 'ui_rank_down', vol: 0.9 },
    unlock:        { stem: 'ui_unlock', vol: 0.9 },
    walkout_sting: { stem: 'ref_fight_02', vol: 0.8 },
    // ui
    ui_move:       { stem: 'ui_click', vol: 0.8 },
    ui_select:     { stem: 'ui_confirm', vol: 0.8 },
    ui_back:       { stem: 'ui_back', vol: 0.8 },
    // music
    music_menu:    { stem: 'music_menu_loop', vol: 0.7, loop: true, bus: 'music' },
    music_fight:   { stem: 'music_fight_loop', vol: 0.7, loop: true, bus: 'music' }
  };

  // Art slots. Rig parts are drawn along bones; a part image is drawn with its top-center at the joint
  // and stretched to the bone length. Key format: "<skin>/<part>" where skin is a fighter id
  // (okafor, vale, ...), "career_<presetId>", or "default". Files: art/<skin>/<part>.png
  CK.ART_PARTS = ['head', 'torso', 'upper_arm', 'lower_arm', 'glove', 'thigh', 'shin', 'foot'];
  CK.ART_MAP = {
    // scenery
    'bg/arena': 'bg/arena.png',
    'bg/cage_front': 'bg/cage_front.png',
    'ui/logo': 'ui/logo.png'
    // rig parts are resolved by convention: "<skin>/<part>" -> "<skin>/<part>.png" if listed in art/manifest.json
  };
})();
