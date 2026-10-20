// Offline push sidebar; the article stays readable and the page never dims.
(() => {
  const toggle = document.querySelector('.toc-toggle');
  const panel = document.querySelector('.toc-panel');
  if (!toggle || !panel) return;
  function setOpen(open, restoreFocus = false) {
    document.body.classList.toggle('toc-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '收起目录' : '展开目录');
    toggle.textContent = open ? '← 收起' : '目录 →';
    panel.inert = !open;
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setOpen(false, true);
  });
  panel.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (target) { target.setAttribute('tabindex', '-1'); target.focus({preventScroll:true}); }
  });
})();
