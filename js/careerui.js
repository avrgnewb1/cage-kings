/* CAGE KINGS - careerui.js : career screens (create, hub w/ training / offers / rankings / fighter / history, fight night, post-fight) */
(function () {
  const C = CK.CONFIG, E = CK.Engine, T = () => CK.Text, D = () => CK.DATA, Car = () => CK.Career;
  const { esc, panel, click, money } = CK.UI;
  const ui = () => document.getElementById('ui');
  const tx = (path, fb, vars) => esc(T().ui(path, vars, fb));
  const lbl = (g, k, fb) => esc(T().label(g, k, fb));
  const WCS = ['FLY', 'LW', 'MW', 'HW'];
  const fullName = (d) => d.nick ? `${d.first} "${d.nick}" ${d.last}` : `${d.first} ${d.last}`;

  // ======================= CREATE =======================
  const Create = {
    t: 0,
    enter() {
      CK.Audio.music('music_menu');
      const rng = CK.makeRng(Date.now() & 0xffff);
      const nm = T().generateName(rng, 'BOX', 'PRESSURE', new Set());
      this.o = { first: nm.first || 'Sam', last: nm.last || 'Rivera', nick: '', lookId: 'p1', wc: 'LW', disc: 'BOX', appr: 'PRESSURE', difficulty: 'normal' };
      this.draw();
    },
    draw() {
      ui().innerHTML = ''; const o = this.o;
      const opt = (name, list, labelFn) => list.map(k => `<button data-act="set" data-arg="${name}:${k}" class="${o[name] === k ? 'on' : ''}" id="opt-${name}-${k}">${labelFn(k)}</button>`).join('');
      const discDesc = T().get('ui', 'labels.disciplines.' + o.disc), apDesc = T().get('ui', 'labels.approaches.' + o.appr);
      const p = panel('create', `<h2>${tx('career.createFighter.title', 'Create Your Fighter')}</h2>
        <div class="crow"><label>${tx('career.createFighter.firstNameLabel', 'First name')}<input id="inFirst" maxlength="14" value="${esc(o.first)}"></label>
          <label>${tx('career.createFighter.lastNameLabel', 'Last name')}<input id="inLast" maxlength="16" value="${esc(o.last)}"></label>
          <label>${tx('career.createFighter.nicknameLabel', 'Nickname (optional)')}<input id="inNick" maxlength="16" placeholder="${tx('career.createFighter.nicknamePlaceholder', '')}" value="${esc(o.nick)}"></label>
          <button data-act="rand">${tx('career.createFighter.randomName', 'Random name')}</button></div>
        <div class="crow"><span class="lab">${tx('career.createFighter.steps.look', 'Look')}</span>${D().CAREER_LOOKS.map(l => `<button data-act="set" data-arg="lookId:${l.id}" class="${o.lookId === l.id ? 'on' : ''}"><span class="sw" style="background:${l.look.skin}"></span><span class="sw" style="background:${l.look.shorts[0]}"></span>${esc(l.name)}</button>`).join('')}</div>
        <div class="crow"><span class="lab">${tx('career.createFighter.steps.weightClass', 'Weight Class')}</span>${opt('wc', WCS, k => lbl('weightClasses', k, k) + ` <small>${C.WEIGHT[k].lbs} lb</small>`)}</div>
        <div class="crow"><span class="lab">${tx('career.createFighter.steps.discipline', 'Discipline')}</span>${opt('disc', Object.keys(D().DISCIPLINES), k => lbl('disciplines', k, D().DISCIPLINES[k].name))}</div>
        <div class="desc">${esc(discDesc && discDesc.description || '')}</div>
        <div class="crow"><span class="lab">${tx('career.createFighter.steps.approach', 'Approach')}</span>${opt('appr', Object.keys(D().APPROACHES), k => lbl('approaches', k, D().APPROACHES[k].name))}</div>
        <div class="desc">${esc(apDesc && apDesc.description || '')}</div>
        <div class="crow"><span class="lab">${tx('quickFight.difficulty', 'Difficulty')}</span>${opt('difficulty', ['easy', 'normal', 'hard'], k => lbl('difficulties', k, k))}</div>
        <div class="err" id="createErr"></div>
        <div class="row"><button data-act="back">${tx('common.back', 'Back')}</button><span class="sp"></span><button class="primary" data-act="go" id="btnSign">${tx('career.createFighter.confirm', 'Sign with the AFL')}</button></div>`);
      const sync = () => { o.first = p.querySelector('#inFirst').value.trim(); o.last = p.querySelector('#inLast').value.trim(); o.nick = p.querySelector('#inNick').value.trim(); };
      click(p, {
        set: (a) => { sync(); const [k, v] = a.split(':'); o[k] = v; this.draw(); },
        rand: () => { sync(); const nm = T().generateName(CK.makeRng(Date.now() & 0xffff), o.disc, o.appr, new Set()); o.first = nm.first; o.last = nm.last; o.nick = nm.nick || ''; this.draw(); },
        back: () => E.go('menu'),
        go: () => {
          sync(); const err = p.querySelector('#createErr');
          if (!o.first || !o.last) { err.textContent = T().ui('career.createFighter.errors.nameRequired', null, 'Your fighter needs a first and last name.'); return; }
          const reserved = T().reservedNames().concat(D().ROSTER.map(r => r.last.toLowerCase()));
          if (reserved.includes(o.last.toLowerCase())) { err.textContent = T().ui('career.createFighter.errors.nameReserved', null, 'That name belongs to an AFL star. Pick your own.'); return; }
          Car().create(o); E.go('careerHub', { welcome: true });
        }
      });
    },
    update(dt) { this.t += dt; },
    render(ctx) {
      const lk = D().CAREER_LOOKS.find(l => l.id === this.o.lookId).look;
      CK.Screens.drawShowcase(ctx, [{ def: { wc: this.o.wc, look: lk, skin: 'career_' + this.o.lookId }, x: 1090, facing: -1 }], this.t);
    }
  };

  // ======================= HUB =======================
  const Hub = {
    t: 0,
    enter(p) {
      CK.Audio.music('music_menu'); CK.Audio.stop('crowd_loop');
      if (!Car().s && !Car().load()) return E.go('menu');
      const abandoned = !p.after && Car().resolveAbandoned();
      const s = Car().s; if (!s.booked && (!s.offers || !s.offers.length)) Car().makeOffers();
      this.tab = this.tab || 'camp'; this.log = [];
      this.draw();
      if (p.welcome) this.toast(T().ui('career.hub.title', null, 'Career'), `Welcome to the ${T().ui('meta.promotionName', null, 'Apex Fighting League')}, ${s.player.first}. Pick your first fight.`);
      const news = p.after || abandoned || s.pendingNews;
      if (s.pendingNews) { s.pendingNews = null; Car().save(); }
      if (news) this.postFight(news);
    },
    toast(title, html) {
      const m = panel('modal news', `<h2>${esc(title)}</h2><div class="newsbody">${html}</div><button class="primary" data-act="ok" id="btnNewsOk">${tx('common.ok', 'OK')}</button>`);
      click(m, { ok: () => m.remove() });
    },
    postFight(res) {
      const s = Car().s, e = res.entry, won = e.result === 'W';
      const k = e.result === 'D' ? 'draw' : (won ? 'win' : 'loss') + (e.method === 'KO' ? 'Ko' : e.method === 'TKO' ? 'Tko' : e.method === 'SUB' ? 'Submission' : /Split/.test(e.detail) ? 'SplitDecision' : 'Decision');
      const vars = { fighter: s.player.first + ' ' + s.player.last, fighterLast: s.player.last, opponent: e.oppName, opponentLast: e.oppName.split(' ').slice(-1)[0], round: e.round, time: e.clock, eventName: e.event, method: e.method, record: Car().recordStr(s.record) };
      const ev = T().event('postFight', k, vars, won ? 'A big win for {fighter}.' : e.result === 'D' ? 'A draw.' : 'A tough night for {fighter}.');
      let html = `<p>${esc(ev.text)}</p><p><b>${e.result}</b> vs ${esc(e.oppName)} · ${esc(e.method)}${e.detail ? ' (' + esc(e.detail) + ')' : ''} · R${e.round} ${esc(e.clock)}</p><p>${tx('career.hub.earnings', 'Earnings')}: <b>${money(res.purse + res.bonus)}</b>${res.bonus ? ' (incl. finish bonus ' + money(res.bonus) + ')' : ''}</p>`;
      CK.Audio.play(res.titleNote === 'win' ? 'belt_fanfare' : res.newRank != null && (res.oldRank == null || res.newRank < res.oldRank) ? 'rank_up' : res.oldRank != null && (res.newRank == null || res.newRank > res.oldRank) ? 'rank_down' : 'ui_select');
      if (res.titleNote) { const tv = T().event('titleFight', res.titleNote, vars); if (tv) html += `<p class="gold"><b>${esc(tv.title || '')}</b> ${esc(tv.text)}</p>`; }
      const rk = (r) => r === 0 ? 'Champion' : r ? '#' + r : 'Unranked';
      if (res.oldRank !== res.newRank) {
        const sub = res.newRank === 1 && res.oldRank !== 1 ? 'numberOne' : res.oldRank == null && res.newRank ? 'entered' : res.newRank == null ? 'droppedOut' : (res.newRank < res.oldRank ? 'up' : 'down');
        const rv = T().event('ranking', sub, Object.assign({ rank: res.newRank, oldRank: res.oldRank, newRank: res.newRank, weightClass: T().label('weightClasses', s.player.wc) }, vars));
        html += `<p>${rk(res.oldRank)} → <b>${rk(res.newRank)}</b>. ${rv ? esc(rv.text) : ''}</p>`;
      }
      if (Car().titleEligible()) { const tv = T().event('titleShot', 'offered', Object.assign({ champion: Car().npc(s.div.champion).def.name }, vars)); if (tv) html += `<p class="gold">${esc(tv.text)}</p>`; }
      this.toast(T().ui('results.title', null, 'Fight Result'), html);
    },
    draw() {
      ui().innerHTML = '';
      const s = Car().s, p = s.player, rank = Car().rankLabel('player');
      const tabs = ['camp', 'rankings', 'fighter', 'history'];
      const tabName = { camp: s.booked ? T().ui('career.training.title', null, 'Training Camp') : T().ui('career.offers.title', null, 'Fight Offers'), rankings: T().ui('career.hub.menu.rankings', null, 'Rankings'), fighter: T().ui('career.hub.menu.fighter', null, 'My Fighter'), history: T().ui('career.hub.menu.history', null, 'Fight History') };
      const side = panel('hubside', `<div class="pname">${esc(fullName(p))}</div>
        <div class="pmeta">${lbl('weightClasses', p.wc, p.wc)} · ${lbl('disciplines', p.disc, p.disc)} / ${lbl('approaches', p.appr, p.appr)}</div>
        <table class="kv"><tr><td>${tx('career.hub.record', 'Record')}</td><td id="hubRecord">${Car().recordStr(s.record)}</td></tr>
          <tr><td>${tx('career.hub.rank', 'Rank')}</td><td class="${s.champion ? 'gold' : ''}" id="hubRank">${esc(rank)}</td></tr>
          <tr><td>${tx('career.hub.earnings', 'Earnings')}</td><td>${money(s.money)}</td></tr>
          <tr><td>${tx('career.hub.fatigue', 'Fatigue')}</td><td><div class="mbar"><em style="width:${p.fatigue}%;background:${p.fatigue > 55 ? '#ff3b3b' : p.fatigue > 30 ? '#f0a020' : '#2fd47a'}"></em></div></td></tr>
          <tr><td>${tx('career.hub.nextFight', 'Next Fight')}</td><td>${s.booked ? esc(Car().npc(s.booked.opp).def.name) + '<br><small>' + tx('career.hub.weekOf', '', { week: Math.min(s.week + 1, s.campWeeks), totalWeeks: s.campWeeks }) + '</small>' : tx('career.hub.noFightBooked', 'No fight booked')}</td></tr></table>
        <div class="stats">${D().STAT_KEYS.map(k => `<div class="stat"><span>${lbl('stats', k, k)}</span><em style="width:${p.stats[k]}%"></em><b>${p.stats[k]}</b></div>`).join('')}</div>
        <button data-act="menu">${tx('common.mainMenu', 'Main Menu')}</button>`);
      click(side, { menu: () => E.go('menu') });
      const main = panel('hubmain', `<div class="tabs">${tabs.map(t => `<button data-act="tab" data-arg="${t}" class="${this.tab === t ? 'on' : ''}" id="tab-${t}">${esc(tabName[t])}</button>`).join('')}</div><div class="tabbody">${this['tab_' + this.tab]()}</div>`);
      click(main, {
        tab: (t) => { this.tab = t; this.draw(); },
        accept: (i) => { Car().accept(+i); this.log = []; this.draw(); },
        train: (a) => { const r = Car().train(a); if (r) this.logTrain(a, r); this.draw(); },
        auto: () => { const out = Car().autoPlan(); out.forEach(x => x.res && this.logTrain(x.act, x.res)); this.draw(); },
        fightnight: () => this.fightNight()
      });
    },
    logTrain(act, r) {
      const s = Car().s, gains = Object.keys(r.gains).map(k => `+${r.gains[k]} ${T().label('stats', k, k)}`).join(', ');
      const ev = T().event('trainingWeek', act, { fighter: s.player.first, fighterLast: s.player.last, week: s.week, totalWeeks: s.campWeeks, stats: gains }, '');
      this.log.unshift(`<b>Wk ${s.week}</b> ${lbl('trainingActivities', act, act)}: ${esc(gains || 'recovered')}${ev && ev.text ? ' · <i>' + esc(ev.text) + '</i>' : ''}`);
      if (r.unlocked) { CK.Audio.play('unlock'); const uv = T().event('trainingWeek', 'crossTrainUnlock', { move: Car().MOVE_NAMES[r.unlocked], fighter: s.player.first }, 'New move unlocked: {move}!'); this.log.unshift(`<b class="gold">${esc(uv.text)}</b>`); }
    },
    tab_camp() {
      const s = Car().s, p = s.player;
      if (!s.booked) {
        if (!s.offers.length) return `<p>${tx('career.offers.noOffers', 'No offers right now.')}</p>`;
        const hypeL = T().get('ui', 'career.offers.hypeLevels') || ['Undercard', 'Prelims', 'Main Card', 'Co-Main', 'Main Event'];
        return `<p class="sub">${tx('career.offers.subtitle', 'Pick one. The others go to someone else.')}</p><div class="offers">${s.offers.map((o, i) => {
          const n = Car().npc(o.opp), d = n.def, rival = s.rivals[o.opp];
          const badges = [o.title ? (o.defense ? 'TITLE DEFENSE' : T().ui('career.offers.card.titleFight', null, 'TITLE FIGHT')) : '', o.shortNotice ? T().ui('career.offers.card.shortNotice', null, 'SHORT NOTICE') : '', o.rematch ? T().ui('career.offers.card.rematch', null, 'REMATCH') : '', rival ? T().ui('career.offers.card.rival', null, 'RIVAL') : '', o.hype >= 4 ? T().ui('career.offers.card.mainEvent', null, 'MAIN EVENT') : ''].filter(Boolean);
          return `<div class="offer ${o.title ? 'title' : ''}" id="offer-${i}"><div class="badges">${badges.map(b => `<span>${esc(b)}</span>`).join('')}</div>
            <h3>${esc(fullName(d))}</h3><div class="sub">${esc(Car().rankLabel(o.opp))} · ${n.w}-${n.l}-${n.d} · ${lbl('disciplines', d.disc, d.disc)} / ${lbl('approaches', d.appr, d.appr)} · OVR ${CK.Fighters.overall(d.stats)}</div>
            <table class="kv"><tr><td>${tx('career.offers.card.event', 'Event')}</td><td>${esc(o.event)} · ${esc(hypeL[o.hype] || '')}</td></tr>
            <tr><td>${tx('career.offers.card.purse', 'Purse')}</td><td>${money(o.purse)} <small>(x2 to win)</small></td></tr>
            <tr><td>${tx('career.offers.card.rankJump', 'Rank Jump')}</td><td>${o.title ? 'Title' : o.jump ? '+' + o.jump : '-'}</td></tr>
            <tr><td>${tx('career.offers.card.camp', 'Camp')}</td><td>${o.camp} wk${o.shortNotice ? ' · ' + tx('career.offers.card.halfCamp', 'HALF CAMP') : ''}</td></tr>
            <tr><td>Rounds</td><td>${o.rounds}</td></tr>${o.faced ? `<tr><td></td><td>${tx('career.offers.card.timesFaced', '', { count: o.faced })}</td></tr>` : ''}</table>
            <button class="primary" data-act="accept" data-arg="${i}" id="btnAccept-${i}">${tx('career.offers.accept', 'Accept')}</button></div>`;
        }).join('')}</div>`;
      }
      const o = s.booked, n = Car().npc(o.opp), done = s.week >= s.campWeeks;
      const acts = Object.keys(Car().ACTIVITIES).map(a => {
        const A = Car().ACTIVITIES[a], cross = A.disc && A.disc !== p.disc ? ` <small>cross-train ${Math.min(100, Math.round((p.cross[A.disc] || 0) / C.CAREER.crossTrainUnlockWeeks * 100))}%</small>` : '';
        return `<button data-act="train" data-arg="${a}" ${done ? 'disabled' : ''} id="train-${a}"><b>${lbl('trainingActivities', a, a)}</b><small>${A.stats.map(k => T().label('stats', k, k)).join(' + ') || 'Recover fatigue'}</small>${cross}</button>`;
      }).join('');
      return `<div class="camp"><h3>vs ${esc(fullName(n.def))} <small>${esc(o.event)}${o.title ? ' · TITLE' : ''}</small></h3>
        <div class="sub">${done ? `<b class="gold">${tx('career.hub.fightWeek', 'Fight Week!')}</b>` : tx('career.training.weekLabel', '', { week: s.week + 1, totalWeeks: s.campWeeks }) + ' · ' + tx('career.training.subtitle', '')}</div>
        ${p.fatigue > 55 && !done ? `<div class="warn">${tx('career.training.fatigueWarning', 'You are worn down.')}</div>` : ''}
        <div class="acts">${acts}</div>
        <div class="row">${done ? `<button class="primary big" data-act="fightnight" id="btnFightNight">${tx('career.fightNight.title', 'Fight Night')} →</button>` : `<button data-act="auto" id="btnAuto">${tx('career.training.autoPlan', 'Auto-Plan')}</button><small>${tx('career.training.autoPlanHelp', '')}</small>`}</div>
        <div class="log">${this.log.slice(0, 7).join('<br>')}</div>
        <div class="note">${tx('career.training.noGrindNote', '')} Unlocked: ${p.unlocks.length ? p.unlocks.map(u => esc(Car().MOVE_NAMES[u])).join(', ') : 'none yet (cross-train 3 weeks in another discipline)'}</div></div>`;
    },
    tab_rankings() {
      const s = Car().s, lad = Car().ladder().slice(0, 10), champ = s.champion ? null : Car().npc(s.div.champion);
      const row = (r, id) => { const me = id === 'player', n = me ? null : Car().npc(id); const d = me ? s.player : n.def;
        return `<tr class="${me ? 'me' : ''}"><td>${r}</td><td>${esc(fullName(d))}${me ? ' <b>(' + tx('career.rankings.youMarker', 'YOU') + ')</b>' : ''}</td><td>${me ? Car().recordStr(s.record) : n.w + '-' + n.l + '-' + n.d}</td><td>${lbl('disciplines', d.disc, d.disc)}</td></tr>`; };
      return `<h3>${tx('career.rankings.title', 'Rankings', { weightClass: T().label('weightClasses', s.player.wc) })}</h3><table class="rank" id="rankTable">
        ${s.champion ? row('<span class="gold">C</span>', 'player') : row('<span class="gold">C</span>', s.div.champion)}
        ${lad.map((x, i) => row(i + 1, x.id)).join('')}</table>${Car().rankOf('player') == null ? `<p class="sub">${tx('career.rankings.notRanked', 'Not ranked yet.')}</p>` : ''}`;
    },
    tab_fighter() {
      const s = Car().s, p = s.player, own = { BOX: 'chain', MT: 'teep', WR: 'reshot', BJJ: 'pull' }[p.disc];
      return `<h3>${esc(fullName(p))}</h3><table class="kv">
        <tr><td>Overall</td><td>${CK.Fighters.overall(p.stats)}</td></tr><tr><td>Signature move</td><td>${esc(Car().MOVE_NAMES[own])}${p.disc === 'MT' ? ', elbows, Thai clinch knees' : ''}</td></tr>
        <tr><td>Unlocked</td><td>${p.unlocks.map(u => esc(Car().MOVE_NAMES[u])).join(', ') || '-'}</td></tr>
        <tr><td>${tx('career.fighter.streak', 'Finish streak')}</td><td>${s.finishStreak}</td></tr><tr><td>${tx('career.fighter.titleDefenses', 'Title defenses')}</td><td>${s.defenses}</td></tr>
        <tr><td>Difficulty</td><td>${lbl('difficulties', s.difficulty, s.difficulty)}</td></tr></table>
        <p class="note">Title shot: be ranked #1, or top 3 with a 2-fight finish streak.</p>`;
    },
    tab_history() {
      const h = Car().s.history; if (!h.length) return `<p>${tx('career.history.empty', 'No fights yet.')}</p>`;
      return `<table class="rank">${h.map(e => `<tr><td class="${e.result === 'W' ? 'win' : e.result === 'L' ? 'loss' : ''}">${e.result}</td><td>${esc(e.oppName)}${e.title ? ' 🏆' : ''}</td><td>${esc(e.method)} ${e.detail && e.method !== 'KO' ? '(' + esc(e.detail) + ')' : ''}</td><td>R${e.round} ${esc(e.clock)}</td><td>${esc(e.event)}</td></tr>`).join('')}</table>`;
    },
    fightNight() {
      const s = Car().s, o = s.booked, n = Car().npc(o.opp), line = Car().rivalLine(o.opp), fj = T().fighter(o.opp);
      const m = panel('modal fightnight', `<h2>${tx('career.fightNight.title', 'Fight Night')} · ${esc(o.event)}</h2>
        <div class="vs"><div><b>${esc(fullName(s.player))}</b><small>${Car().recordStr(s.record)} · ${esc(Car().rankLabel('player'))}</small></div><span>VS</span>
          <div><b>${esc(fullName(n.def))}</b><small>${n.w}-${n.l}-${n.d} · ${esc(Car().rankLabel(o.opp))}</small></div></div>
        ${o.title ? `<div class="gold">${lbl('weightClasses', s.player.wc, s.player.wc)} Championship · ${o.rounds} rounds</div>` : `<div class="sub">${o.rounds} rounds</div>`}
        ${line ? `<blockquote id="rivalLine">"${esc(line)}"<br><small>- ${esc(n.def.name)}</small></blockquote>` : fj && fj.bio ? `<p class="bio">${esc(fj.bio)}</p>` : ''}
        <button class="primary big" data-act="go" id="btnEnterCage">${tx('career.fightNight.start', 'Enter the Cage')}</button>`);
      click(m, { go: () => {
        CK.Audio.play('walkout_sting');
        const pd = Car().playerDef(), od = Object.assign({}, n.def);
        s.inFight = { event: s.event, opp: o.opp }; Car().save();   // QA CK-02: leaving mid-fight counts as a forfeit
        E.go('fight', { a: pd, b: od, difficulty: s.difficulty, rounds: o.rounds, title: o.title, mode: 'career', onEnd: (r) => Car().applyResult(r) });
      } });
    },
    update(dt) { this.t += dt; },
    render(ctx) {
      const s = Car().s; if (!s) return;
      const list = [{ def: Car().playerDef(), x: 1150, facing: -1 }];
      CK.Screens.drawShowcase(ctx, list, this.t);
    }
  };

  E.register('careerCreate', Create); E.register('careerHub', Hub);
  CK.CareerUI = { Create, Hub };
})();
