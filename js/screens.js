/* CAGE KINGS - screens.js : menu, fighter select, fight (with pause/corner/results), career screens.
 * Menus are DOM panels inside the scaled 1280x720 stage; the canvas underneath keeps drawing the arena. */
(function () {
  const C = CK.CONFIG, E = CK.Engine, T = () => CK.Text, D = () => CK.DATA;
  const ui = () => document.getElementById('ui');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tx = (path, fb, vars) => esc(T().ui(path, vars, fb));
  const lbl = (g, k, fb) => esc(T().label(g, k, fb));
  const click = (root, handlers) => root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    CK.Audio.play(b.dataset.act === 'back' || b.dataset.act === 'menu' ? 'ui_back' : 'ui_select');
    const h = handlers[b.dataset.act]; if (h) h(b.dataset.arg, b, e);
  });
  const panel = (cls, html) => { const d = document.createElement('div'); d.className = 'panel ' + (cls || ''); d.innerHTML = html; ui().appendChild(d); return d; };
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  CK.UI = { esc, panel, click, money };

  // shared background: arena + idle fighters
  function drawShowcase(ctx, list, t) {
    CK.FightView.drawArena(ctx);
    // dim the arena, not the fighters (rough spot: the showcase fighters were lost behind the UI)
    ctx.fillStyle = 'rgba(5,6,12,0.45)'; ctx.fillRect(0, 0, C.VIEW.W, C.VIEW.H);
    list.forEach((it, i) => {
      if (!it) return;
      const pose = it.pose || CK.Rig.sampleAnim(it.anim || 'idle', t + i * 333);
      CK.Renderer.drawFighter(ctx, { x: it.x, floorY: C.ARENA.floorY, facing: it.facing, pose, wc: it.def.wc, look: it.def.look, skin: it.def.skin, dmg: { head: 0, body: 0, leg: 0 } });
    });
    CK.FightView.drawFront(ctx);
  }

  // ======================= MAIN MENU =======================
  const Menu = {
    t: 0,
    enter() {
      CK.Audio.music('music_menu'); CK.Audio.stop('crowd_loop'); CK.Input.showTouch(false);
      const has = CK.Career.exists(); const s = has ? CK.Career.s : null;
      const logo = CK.Art.get('ui/logo') ? `<img class="logo" src="${CK.ASSET_PATHS.art}ui/logo.png" alt="CAGE KINGS">` : `<h1 class="title">CAGE <span>KINGS</span></h1>`;
      const p = panel('menu', `${logo}
        <div class="tagline">${tx('meta.tagline', 'Climb the ladder. Take the crown.')}</div>
        <div class="menu-items">
          ${has ? `<button data-act="continue" class="primary">${tx('mainMenu.items.continueCareer', 'Continue Career')}<small>${esc(s.player.first + ' ' + s.player.last)} · ${CK.Career.recordStr(s.record)}</small></button>` : ''}
          <button data-act="quick" class="${has ? '' : 'primary'}" id="btnQuick">${tx('mainMenu.items.quickFight', 'Quick Fight')}<small>${tx('mainMenu.hints.quickFight', 'Jump straight into a fight.')}</small></button>
          <button data-act="newcareer" id="btnNewCareer">${tx('mainMenu.items.newCareer', 'New Career')}<small>${tx('mainMenu.hints.newCareer', 'Start from nothing. Finish with a belt.')}</small></button>
          <button data-act="controls">${tx('controls.screen.title', 'Controls')}</button>
          <button data-act="mute">${CK.Audio.muted ? 'Sound: Off' : 'Sound: On'}</button>
        </div>
        <div class="foot">${tx('meta.copyright', 'All fighters and organizations are fictional.')} · ${tx('meta.promotionName', 'Apex Fighting League')}</div>`);
      click(p, {
        continue: () => E.go('careerHub'), quick: () => E.go('select'),
        newcareer: () => { if (!has || confirm(T().ui('confirmDialogs.newCareer.text', null, 'Start a new career? Your current career will be erased.'))) E.go('careerCreate'); },
        controls: () => showControls(), mute: (a, b) => { CK.Audio.setMuted(!CK.Audio.muted); b.textContent = CK.Audio.muted ? 'Sound: Off' : 'Sound: On'; }
      });
      const R = D().ROSTER; this.show = [R.find(r => r.id === 'okafor') || R[0], R.find(r => r.id === 'vale') || R[1]].map(r => CK.Fighters.fromRoster(r.id));
    },
    update(dt) { this.t += dt; },
    render(ctx) { drawShowcase(ctx, [{ def: this.show[0], x: 720, facing: 1 }, { def: this.show[1], x: 1010, facing: -1 }], this.t); }
  };

  function showControls() {
    const K = (tok) => esc((T().get('ui', 'controls.tokens.' + tok) || {}).keyboard || '');
    const rows = [['move', 'Move', 'A / D'], ['low', 'Low modifier / sprawl / check', 'S'], ['jab', 'Jab', 'J'], ['power', 'Power strike', 'K'], ['kick', 'Kick (forward = teep, low = leg kick, up = head kick)', 'L'],
      ['block', 'Block (hold)', 'Space'], ['grab', 'Clinch / grab', 'U'], ['takedown', 'Takedown / guard pull (BJJ)', 'I'], ['ground', 'Ground: J/K/L/U by context (labels on screen)', 'J K L U'], ['pause', 'Pause', 'Esc']];
    const p = panel('modal controls', `<h2>${tx('controls.screen.title', 'Controls')}</h2>
      <table>${rows.map(r => `<tr><td>${tx('controls.screen.rows.' + r[0], r[1])}</td><td class="key">${esc(r[2])}</td></tr>`).join('')}</table>
      <p class="note">${tx('controls.screen.contextNote', 'Buttons change labels in the clinch and on the ground.')} Clinch: J strike · K elbow · L knee · U break (S+U guillotine) · I takedown. Guard bottom: S+U = triangle. Creative fighters: back+K spinning back fist, back+L spinning back kick. Submissions: tap J on the beat. Touch: left stick, 4 context buttons + Block; flick the stick down-forward to shoot. F2 shows hitboxes.</p>
      <button data-act="close" class="primary">${tx('common.back', 'Back')}</button>`);
    click(p, { close: () => p.remove() });
  }

  // ======================= QUICK FIGHT SELECT =======================
  const Select = {
    t: 0,
    enter() {
      CK.Audio.music('music_menu');
      this.p1 = this.p1 || 'okafor'; this.p2 = this.p2 || 'aslanov'; this.diff = this.diff || 'normal'; this.rounds = this.rounds || 3; this.picking = 1;
      this.draw();
    },
    draw() {
      ui().innerHTML = '';
      const R = D().ROSTER;
      const card = (r) => `<button class="fcard ${this.p1 === r.id ? 'p1' : ''} ${this.p2 === r.id ? 'p2' : ''}" data-act="pick" data-arg="${r.id}" id="card-${r.id}">
          <span class="sw" style="background:${r.look.shorts[0]};border-color:${r.look.shorts[1]}"></span>
          <b>${esc(r.first)} ${esc(r.last)}</b><i>"${esc(r.nick)}"</i>
          <small>${lbl('weightClasses', r.wc, r.wc)}${r.champion ? ' · 👑' : ''} · ${lbl('disciplines', r.disc, r.disc)}</small></button>`;
      const info = (id, side) => {
        const r = R.find(x => x.id === id), fj = T().fighter(id);
        const st = D().STAT_KEYS.map(k => `<div class="stat"><span>${lbl('stats', k, k)}</span><em style="width:${r.stats[k]}%"></em><b>${r.stats[k]}</b></div>`).join('');
        return `<div class="finfo ${side}"><h3>${esc(r.first)} "${esc(r.nick)}" ${esc(r.last)}</h3>
          <div class="sub">${lbl('weightClasses', r.wc, r.wc)} · ${lbl('disciplines', r.disc, r.disc)} / ${lbl('approaches', r.appr, r.appr)}${r.champion ? ' · Champion' : ''}</div>
          <div class="hook">${esc(r.hook)}</div>${r.record ? `<div class="sub">Record ${r.record.w}-${r.record.l}-${r.record.d}</div>` : ''}${r.notable && r.notable.length ? `<div class="notable">${r.notable.slice(0, 3).map(n => `<span class="${/^l/i.test(n.result) ? 'loss' : 'win'}">${/^l/i.test(n.result) ? 'L' : 'W'}</span> ${esc(n.opponent)} <small>(${esc(n.method || '')})</small>`).join(' · ')}</div>` : ''}${st}${fj && fj.bio ? `<p class="bio">${esc(fj.bio)}</p>` : ''}</div>`;
      };
      const p = panel('select', `<h2>${tx('quickFight.title', 'Quick Fight')}</h2>
        <div class="pickhint">${this.picking === 1 ? tx('quickFight.selectFighter', 'Choose Your Fighter') : tx('quickFight.selectOpponent', 'Choose Opponent')}</div>
        <div class="grid">${R.map(card).join('')}</div>
        <div class="row opts">
          <span>${tx('quickFight.difficulty', 'Difficulty')}</span>${['easy', 'normal', 'hard'].map(d => `<button data-act="diff" data-arg="${d}" class="${this.diff === d ? 'on' : ''}" id="diff-${d}">${lbl('difficulties', d, d)}</button>`).join('')}
          <span>${tx('quickFight.rounds', 'Rounds')}</span><button data-act="rounds" data-arg="3" class="${this.rounds === 3 ? 'on' : ''}">${tx('quickFight.roundsOptions.three', '3 Rounds')}</button><button data-act="rounds" data-arg="5" class="${this.rounds === 5 ? 'on' : ''}">${tx('quickFight.roundsOptions.five', '5 Rounds (Title)')}</button>
          <span class="sp"></span>
          <button data-act="back">${tx('common.back', 'Back')}</button>
          <button data-act="fight" class="primary" id="btnFight">${tx('quickFight.start', 'Fight!')}</button>
        </div>
        ${R.find(x => x.id === this.p1).wc !== R.find(x => x.id === this.p2).wc ? `<div class="warn">${tx('quickFight.crossDivisionWarning', 'Different divisions: expect a size gap.')}</div>` : ''}`);
      panel('infos', info(this.p1, 'left') + info(this.p2, 'right'));
      click(p, {
        pick: (id) => { if (this.picking === 1) { this.p1 = id; if (this.p2 === id) this.p2 = R.find(x => x.id !== id).id; this.picking = 2; } else { if (id !== this.p1) this.p2 = id; this.picking = 1; } this.draw(); },
        diff: (d) => { this.diff = d; this.draw(); }, rounds: (n) => { this.rounds = +n; this.draw(); },
        back: () => E.go('menu'), fight: () => this.start()
      });
    },
    start() {
      const a = CK.Fighters.fromRoster(this.p1), b = CK.Fighters.fromRoster(this.p2);
      E.go('fight', { a, b, difficulty: this.diff, rounds: this.rounds, title: this.rounds === 5, mode: 'quick' });
    },
    update(dt) { this.t += dt; },
    render(ctx) { drawShowcase(ctx, [{ def: CK.Fighters.fromRoster(this.p1), x: 500, facing: 1 }, { def: CK.Fighters.fromRoster(this.p2), x: 780, facing: -1 }], this.t); }
  };

  // ======================= FIGHT =======================
  const FightScreen = {
    enter(p) {
      this.params = p; CK.FightView.reset(); this.cornerOpen = false; this.resultShown = false; this.careerRes = null; this.paused = false;
      const ctrlA = p.ctrlA || (p.spectate ? CK.AI.make(p.difficulty || 'normal', p.a) : new CK.AI.PlayerController());
      const ctrlB = p.ctrlB || CK.AI.make(p.difficulty || 'normal', p.b);
      this.fight = new CK.Fight({ a: p.a, b: p.b, ctrlA, ctrlB, rounds: p.rounds, title: p.title, seed: p.seed });
      this.player = ctrlA.human ? this.fight.f[0] : null;
      CK.evlog = [];
      CK.Audio.music('music_fight'); CK.Audio.loop('crowd_loop');
      CK.Input.showTouch(!!this.player);
      if (!CK.Input.touchEnabled) { const pb = document.createElement('button'); pb.id = 'pauseBtn'; pb.textContent = 'II'; pb.title = 'Pause (Esc)'; pb.onclick = () => this.pause(); ui().appendChild(pb); }
      window.CK.game = this; // test hook
    },
    exit() { clearTimeout(this.revealT); CK.Input.showTouch(false); CK.Audio.stop('sub_loop'); CK.Audio.stop('crowd_loop'); },
    update(dt) {
      const f = this.fight;
      if (CK.Input.peekPause() && !this.resultShown) { this.paused ? this.resume() : this.pause(); }
      if (this.paused) return;
      if (f.phase === 'break') { if (!this.cornerOpen) this.showCorner(); else if (performance.now() - this.cornerAt > C.CORNER.maxMs && !this.params.holdCorner) this.closeCorner(); }
      f.step(dt);
      for (const e of f.events) { CK.FightView.onEvent(e, f); CK.evlog.push(e.type + (e.name ? ':' + e.name : '')); if (CK.evlog.length > 800) CK.evlog.shift(); } f.events.length = 0;
      if (this.player) CK.Input.setLabels(f.labelsFor(this.player));
      // QA CK-02: save the career result as soon as the fight is decided (finish phase), before any results screen
      if (f.result && this.params.onEnd && !this.careerRes) this.careerRes = this.params.onEnd(f.result, f);
      if (f.phase === 'over' && !this.resultShown) this.showResults();
    },
    render(ctx) {
      const dt = 1000 / 60;
      CK.FightView.drawFight(ctx, this.fight, dt);
      CK.FightView.drawHUD(ctx, this.fight, dt, this.player);
    },
    pause() {
      if (this.paused || this.resultShown) return; this.paused = true; this.fight.paused = true;
      const career = this.params.mode === 'career';
      const p = panel('modal pause', `<h2>${tx('pause.title', 'Paused')}</h2><div class="sub">${tx('pause.roundInfo', '', { round: this.fight.round, time: this.fight.clockLeft() })}</div>
        <button data-act="resume" class="primary" id="btnResume">${tx('pause.resume', 'Resume')}</button>
        ${career ? '' : `<button data-act="restart">${tx('pause.restart', 'Restart Fight')}</button>`}
        <button data-act="controls">${tx('pause.controls', 'Controls')}</button>
        <button data-act="hitbox">Hitboxes: ${CK.FightView.showHitboxes ? 'On' : 'Off'}</button>
        <button data-act="mute">${CK.Audio.muted ? 'Sound: Off' : 'Sound: On'}</button>
        <button data-act="quit">${career ? tx('pause.forfeit', 'Forfeit') : tx('pause.quit', 'Quit to Menu')}</button>`);
      this.pausePanel = p;
      click(p, {
        resume: () => this.resume(), restart: () => E.go('fight', Object.assign({}, this.params, { seed: undefined })), controls: () => showControls(),
        hitbox: (a, b) => { CK.FightView.showHitboxes = !CK.FightView.showHitboxes; b.textContent = 'Hitboxes: ' + (CK.FightView.showHitboxes ? 'On' : 'Off'); },
        mute: (a, b) => { CK.Audio.setMuted(!CK.Audio.muted); b.textContent = CK.Audio.muted ? 'Sound: Off' : 'Sound: On'; },
        quit: () => { if (career) { this.resume(); this.fight.finish(this.fight.f[1], 'TKO', 'Forfeit'); } else E.go('menu'); }
      });
    },
    resume() { this.paused = false; this.fight.paused = false; if (this.pausePanel) this.pausePanel.remove(); this.pausePanel = null; CK.Input.clear(); },

    // ----- corner screen between rounds (3-5 s, skippable) -----
    showCorner() {
      const f = this.fight, me = f.f[0], op = f.f[1], ri = f.round - 1, rs = f.roundStats[ri];
      this.cornerOpen = true; this.cornerAt = performance.now();
      const est = [0, 0]; (f.roundScores || []).forEach((r, i) => { const z = f.scoreRound(i, true)[0]; est[0] += z[0]; est[1] += z[1]; });
      const word = (v, kind) => kind === 'stam' ? (v > 60 ? T().ui('corner.readout.fresh', null, 'Fresh') : v > C.STAMINA.lowThreshold ? T().ui('corner.readout.tired', null, 'Tired') : T().ui('corner.readout.gassed', null, 'Gassed'))
        : (v > 60 ? T().ui('corner.readout.ok', null, 'OK') : v > 35 ? T().ui('corner.readout.hurt', null, 'Hurt') : T().ui('corner.readout.badlyHurt', null, 'Badly Hurt'));
      const bar = (v, kind) => `<div class="cbar"><em style="width:${Math.max(0, Math.min(100, v))}%;background:${v > 60 ? '#2fd47a' : v > 35 ? '#f0a020' : '#ff3b3b'}"></em><b>${esc(word(v, kind))}</b></div>`;
      const standing = est[0] > est[1] ? 'ahead' : est[0] < est[1] ? 'behind' : 'even';
      const tip = cornerTip(f, me, op, rs[0], rs[1], est);
      const p = panel('modal corner', `<h2>${tx('corner.roundBreak', 'End of Round ' + f.round, { round: f.round })}</h2>
        ${f.rounds === 5 && f.round >= 3 ? `<div class="sub gold">${tx('corner.championshipRounds', 'Championship rounds')}</div>` : ''}
        <div class="cgrid"><span>${tx('corner.readout.stamina', 'Stamina')}</span>${bar(me.stam, 'stam')}<span>${tx('corner.readout.head', 'Head')}</span>${bar(me.head)}
          <span>${tx('corner.readout.body', 'Body')}</span>${bar(me.body)}<span>${tx('corner.readout.leg', 'Leg')}</span>${bar(me.leg)}</div>
        <div class="score">${tx('corner.scoreEstimate', '', { scoreFor: est[0], scoreAgainst: est[1] })} · <b>${tx('corner.scoreEstimateLabels.' + standing, standing)}</b></div>
        <div class="tip"><b>${tx('corner.tipLabel', 'Coach says:')}</b> ${esc(tip)}</div>
        <button data-act="skip" class="primary" id="btnSkipCorner">${tx('corner.skip', 'Tap to skip')} → ${tx('corner.nextRound', 'Round ' + (f.round + 1), { nextRound: f.round + 1 })}</button>`);
      this.cornerPanel = p; click(p, { skip: () => this.closeCorner() });
      this.cornerKey = (e) => { if (performance.now() - this.cornerAt > 400 && (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'j')) this.closeCorner(); };
      window.addEventListener('keydown', this.cornerKey);
    },
    closeCorner() {
      if (!this.cornerOpen) return; this.cornerOpen = false; window.removeEventListener('keydown', this.cornerKey);
      if (this.cornerPanel) this.cornerPanel.remove(); CK.Input.clear(); this.fight.nextRound();
    },

    // ----- results / scorecard -----
    showResults() {
      this.resultShown = true; const f = this.fight, r = f.result; CK.Input.showTouch(false); CK.Audio.stop('sub_loop');
      const win = r.winner >= 0 ? f.f[r.winner] : null, human = !!this.player;
      // audio: decisions get the scorecard drum roll then the reveal; title wins get the new-champion moment
      const P = this.params, titleWin = P.mode === 'career' && P.title && r.winner === 0;
      const sting = () => { if (CK.Engine.current !== this) return; CK.Audio.play(r.winner === -1 ? 'stinger_draw' : titleWin ? 'new_champion' : !human || r.winner === 0 ? 'stinger_win' : 'stinger_lose'); };
      if (r.cards) { CK.Audio.play('judges_build'); this.revealT = setTimeout(() => { if (CK.Engine.current !== this) return; CK.Audio.play('judges_reveal'); setTimeout(sting, 900); }, 3400); }
      else sting();
      const disp = (d) => d.nick ? `${d.first} "${d.nick}" ${d.last}` : d.name;
      const head = r.winner === -1 ? tx('results.drawTitle', 'DRAW') : human ? (r.winner === 0 ? tx('results.youWin', 'YOU WIN!') : tx('results.youLose', 'YOU LOSE')) : tx('results.winnerTitle', 'WINNER');
      const methodName = r.method === 'DEC' || r.method === 'DRAW' ? r.detail : (r.method === 'SUB' ? T().label('submissions', subKey(r.detail), r.detail) : r.method + ' (' + r.detail + ')');
      // announcer read-out from scorecards.json
      const SC = T().data.scorecards; let readout = '';
      const judges = SC && SC.judgeNames ? SC.judgeNames.slice(0, 3) : ['Judge A', 'Judge B', 'Judge C'];
      if (r.cards) {
        const cardsW = r.cards.map(t => r.winner === 1 ? `${t[1]}-${t[0]}` : `${t[0]}-${t[1]}`);
        const vars = { totalRounds: f.rounds, card1: cardsW[0], card2: cardsW[1], card3: cardsW[2], judge1Name: judges[0], judge2Name: judges[1], judge3Name: judges[2], winner: win ? disp(win.def) : '', promotionShort: 'AFL', weightClass: T().label('weightClasses', f.f[0].wcKey) };
        const key = /Split d/.test(r.detail) ? 'split' : /Majority d/.test(r.detail) ? 'majority' : /Unanimous d/.test(r.detail) ? 'unanimous' : /Split draw/.test(r.detail) ? 'splitDraw' : /Majority draw/.test(r.detail) ? 'majorityDraw' : 'unanimousDraw';
        const intro = T().pick(T().get('scorecards', 'readouts.intro'), 'sc.intro', vars), line = T().pick(T().get('scorecards', 'readouts.' + key), 'sc.' + key, vars);
        readout = [intro && intro.text, line && line.text].filter(Boolean).join(' ') || r.readout;
      } else if (win) {
        const inl = r.method === 'KO' ? 'ko' : r.method === 'SUB' ? subKey(r.detail) : /bell/.test(r.detail) ? 'tkoDidNotAnswerBell' : /leg/.test(r.detail) ? 'tkoLegDamage' : 'tko';
        const vars = { refName: (SC && SC.refereeNames || ['the referee'])[0], time: r.clock, round: r.round, method: T().get('ui', 'labels.methodsInline.' + inl) || r.method.toLowerCase(), winner: disp(win.def) };
        const v = T().pick(T().get('scorecards', 'readouts.finishAnnouncement'), 'sc.finish', vars); readout = v ? v.text : '';
      }
      // scorecard table (completed rounds)
      const rows = (r.roundScores || []).map((rs, i) => `<tr><td>R${i + 1}</td>${rs.map(j => `<td>${j[0]}-${j[1]}</td>`).join('')}</tr>`).join('');
      const totals = r.cards ? `<tr class="tot"><td>Total</td>${r.cards.map(t => `<td>${t[0]}-${t[1]}</td>`).join('')}</tr>` : '';
      const sum = (i, k) => f.roundStats.reduce((t, rr) => t + (rr[i][k] || 0), 0);
      const stat = (label, k, fmt) => `<tr><td>${sum(0, k) !== undefined ? (fmt ? fmt(sum(0, k)) : Math.round(sum(0, k))) : ''}</td><th>${label}</th><td>${fmt ? fmt(sum(1, k)) : Math.round(sum(1, k))}</td></tr>`;
      const p = panel('modal results', `<h2 class="${r.winner === 0 || !human ? 'gold' : ''}">${head}</h2>
        <div class="winner">${win ? esc(disp(win.def)) : ''}</div>
        <div class="method" id="resMethod">${esc(methodName)} · ${tx('results.methodLine', '', { method: '', round: r.round, time: r.clock }).replace(/^\s*\|\s*/, '')}</div>
        ${readout ? `<p class="readout">${esc(readout)}</p>` : ''}
        <div class="cols">
          <div><h3>${tx('results.scorecards', 'Scorecards')}</h3>
            <table class="cards" id="scorecard"><tr><th>${esc(f.f[0].def.last)} - ${esc(f.f[1].def.last)}</th>${judges.map(j => `<th>${esc(j)}</th>`).join('')}</tr>${rows}${totals}</table></div>
          <div><h3>${tx('results.stats.title', 'Fight Stats')}</h3>
            <table class="fstats"><tr><td>${esc(f.f[0].def.last)}</td><th></th><td>${esc(f.f[1].def.last)}</td></tr>
            ${stat(tx('results.stats.strikesLanded', 'Strikes Landed'), 'landed')}${stat(tx('results.stats.powerLanded', 'Power Strikes'), 'power')}${stat(tx('results.stats.kicksLanded', 'Kicks Landed'), 'kicks')}
            ${stat(tx('results.stats.knockdowns', 'Knockdowns'), 'kd')}${stat(tx('results.stats.takedowns', 'Takedowns'), 'td')}${stat(tx('results.stats.subAttempts', 'Submission Attempts'), 'subAtt')}
            ${stat(tx('results.stats.perfectBlocks', 'Perfect Blocks'), 'perfect')}${stat(tx('results.stats.kicksChecked', 'Kicks Checked'), 'checks')}${stat(tx('results.stats.controlTime', 'Control Time'), 'ctrl', v => Math.round(v) + 's')}</table></div>
        </div>
        <div class="row">${this.params.mode === 'career' ? `<button data-act="continue" class="primary" id="btnContinue">${tx('results.buttons.continue', 'Continue')}</button>`
          : `<button data-act="rematch" id="btnRematch">${tx('results.buttons.rematch', 'Rematch')}</button><button data-act="menu" class="primary" id="btnMenu">${tx('results.buttons.mainMenu', 'Main Menu')}</button>`}</div>`);
      click(p, {
        rematch: () => E.go('fight', Object.assign({}, this.params, { seed: undefined })), menu: () => E.go('menu'),
        continue: () => E.go('careerHub', { after: this.careerRes })
      });
      // QA CK-02: the career result is saved the moment the fight ends, not when Continue is pressed,
      // so reloading on the results screen can't erase a loss.
      if (this.params.onEnd && !this.careerRes) this.careerRes = this.params.onEnd(r, f);
      if (this.params.onResult) this.params.onResult(r, f);
    }
  };
  function subKey(detail) { return { 'Guillotine': 'guillotine', 'Armbar': 'armbar', 'Triangle': 'triangle', 'Rear-Naked Choke': 'rnc' }[detail] || 'armbar'; }

  // corner tip: evaluate corner-tips.json situations against the round, highest priority wins
  function cornerTip(f, me, op, mine, theirs, est) {
    const S = T().get('corner-tips', 'situations');
    const fallback = 'Keep your hands up and work behind the jab.';
    if (!S) return fallback;
    const nextIsLast = f.round + 1 === f.rounds;
    const trig = {
      hurtLastRound: theirs.kd > 0 || me.head < C.REF.hurtHead, refMeterClose: mine.refPeak > 60, gassed: me.stam < C.STAMINA.lowThreshold, ownLegHurt: me.leg < 45,
      behindOnCards: est[0] < est[1], finalRoundClose: nextIsLast && Math.abs(est[0] - est[1]) <= 1, aheadOnCards: est[0] > est[1],
      stuckOnBottom: mine.bottom > C.ROUND_SECONDS * 0.4, losingOnFeet: mine.standTaken > mine.standLanded * 1.5 + 5, winningOnFeet: mine.standLanded > mine.standTaken * 1.3 + 5,
      opponentGassed: op.stam < C.STAMINA.lowThreshold + 5, opponentLegHurt: op.leg < 50, opponentBodyHurt: op.body < 55,
      opponentWrestler: op.disc === 'WR' || op.appr === 'SMOTHER', opponentBjj: op.disc === 'BJJ', opponentKicker: op.disc === 'MT' || theirs.kicks >= 4,
      opponentBoxer: op.disc === 'BOX', opponentPressure: op.appr === 'PRESSURE', opponentCounter: op.appr === 'COUNTER', opponentCreative: op.appr === 'CREATIVE',
      stallWarning: mine.stall > 0, subAttemptSurvived: mine.subEsc > 0, general: true
    };
    let best = null;
    for (const k in S) { if (S[k].scope === 'later' || !trig[k]) continue; if (!best || S[k].priority > S[best].priority) best = k; }
    f.usedTips = f.usedTips || new Set();
    const v = best && T().pick(S[best].tips.filter(t => !f.usedTips.has(t.id)).length ? S[best].tips.filter(t => !f.usedTips.has(t.id)) : S[best].tips, 'tip.' + best, {});
    if (v) f.usedTips.add(v.id);
    return v ? v.text : fallback;
  }

  E.register('menu', Menu); E.register('select', Select); E.register('fight', FightScreen);
  CK.Screens = { Menu, Select, FightScreen, drawShowcase, showControls };
})();
