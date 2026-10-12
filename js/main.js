/* CAGE KINGS - main.js : boot */
(function () {
  const boot = () => {
    CK.Engine.init(); CK.Input.init(); CK.Audio.init();
    Promise.all([CK.Text.load(), CK.Art.init()]).then(() => {
      CK.DATA.buildRoster(CK.Text.data.fighters);
      CK.Career.load();
      CK.Engine.go('menu');
      CK.Engine.start();
      CK.ready = true; document.body.dataset.ready = '1';
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'F2') { e.preventDefault(); CK.FightView.showHitboxes = !CK.FightView.showHitboxes; } });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
