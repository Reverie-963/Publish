// A quiet outline in the document heading; no floating card or sidebar.
(() => {
  const toggle = document.querySelector('.toc-toggle');
  const panel = document.querySelector('.toc-panel');
  const header = document.querySelector('.reader-heading');
  if (!toggle || !panel || !header) return;
  const entries = Array.from(panel.querySelectorAll('a[href^="#"]')).map(link => {
    try { return {link,target:document.getElementById(decodeURIComponent(link.hash.slice(1)))}; } catch (_) { return {link,target:null}; }
  }).filter(entry => entry.target);
  if (entries.length <= 1) { toggle.remove(); panel.remove(); return; }
  let actions = header.querySelector('.reader-actions');
  if (!actions) { actions = document.createElement('div'); actions.className = 'reader-actions'; header.append(actions); }
  // Also handle the compatibility reader if zoom has already initialized.
  const zoom = header.querySelector(':scope > .page-zoom');
  if (zoom) actions.append(zoom);
  actions.append(toggle); header.append(panel);
  toggle.type = 'button';
  toggle.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h11M4 18h16"/></svg>';
  toggle.setAttribute('aria-controls', panel.id);
  function fitPanel() {
    const zoom = Number(document.body.style.zoom) || 1;
    panel.style.maxHeight = Math.min(360, window.innerHeight / zoom * .45) + 'px';
  }
  function markCurrent(target) {
    entries.forEach(entry => { if (entry.target === target) entry.link.setAttribute('aria-current','location'); else entry.link.removeAttribute('aria-current'); });
  }
  function currentHeading() {
    let current = entries[0].target;
    for (const entry of entries) { if (entry.target.getBoundingClientRect().top <= 48) current = entry.target; }
    markCurrent(current);
  }
  function setOpen(open, restoreFocus = false) {
    document.body.classList.toggle('toc-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '收起文稿目录' : '展开文稿目录');
    toggle.title = open ? '收起文稿目录 · Esc' : '文稿目录';
    panel.hidden = !open; panel.inert = !open;
    if (open) { fitPanel(); currentHeading(); }
    if (restoreFocus) toggle.focus({preventScroll:true});
  }
  setOpen(false);
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); setOpen(false, true); }
  });
  panel.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
    const entry = entries.find(entry => entry.link === link);
    if (!entry) return;
    setOpen(false); markCurrent(entry.target);
    entry.target.setAttribute('tabindex', '-1'); entry.target.focus({preventScroll:true});
    // Keep the native anchor action/history, after the outline has collapsed.
  });
  window.addEventListener('resize', fitPanel);
  document.addEventListener('page-scalechange', fitPanel);
})();
