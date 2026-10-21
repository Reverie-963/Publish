// One scale for the whole document, shared by pages using this asset directory.
(() => {
  if (document.querySelector('.page-zoom')) return;
  let host = document.querySelector('.index-actions');
  let layout = document.querySelector('.layout');
  if (host) {
    const main = document.querySelector('body > main');
    if (main) {
      layout = document.createElement('div'); layout.className = 'index-layout';
      const sidebar = document.createElement('div'); sidebar.className = 'index-sidebar';
      main.before(layout); sidebar.append(host); layout.append(sidebar, main);
    }
  } else if (layout && document.querySelector('.reader-heading')) {
    let sidebar = layout.querySelector('.reader-sidebar');
    if (!sidebar) {
      sidebar = document.createElement('div'); sidebar.className = 'reader-sidebar';
      const toolbar = document.createElement('div'); toolbar.className = 'toc-toolbar';
      sidebar.append(toolbar); layout.prepend(sidebar);
    }
    layout.classList.add('has-reader-tools');
    host = sidebar.querySelector('.toc-toolbar');
  }
  if (!host) return;
  function fitTools() {
    if (layout) layout.classList.toggle('tools-compact', innerWidth / (Number(document.body.style.zoom) || 1) < 820);
  }
  fitTools();
  window.addEventListener('resize', fitTools);
  document.addEventListener('page-scalechange', fitTools);
  const currentScript = document.currentScript;
  const script = currentScript?.src || document.querySelector('script[src$="page-zoom.js"]')?.src;
  const storageKey = 'file-index:page-scale:v1:' + (script ? new URL('.', script).href : location.pathname);
  const stores = [];
  for (const name of ['localStorage', 'sessionStorage']) {
    try { const store = window[name]; store.getItem(storageKey); stores.push(store); } catch (_) {}
  }
  const steps = [.5, .67, .8, .9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  let scale = 1;
  const ui = document.createElement('div'); ui.className = 'page-zoom';
  ui.innerHTML = '<button type="button" class="page-scale" aria-label="当前缩放 100%，恢复原始大小" title="恢复 100% · Cmd/Ctrl+0">100%</button><button type="button" class="page-scale-menu" aria-label="调整页面缩放" aria-expanded="false" aria-controls="page-scale-panel" title="调整页面缩放"><svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg></button><div id="page-scale-panel" class="page-zoom-panel" role="group" aria-label="页面缩放" hidden><button type="button" data-scale-action="out" aria-label="缩小页面">−</button><button type="button" data-scale-action="reset" aria-label="恢复页面原始大小">100%</button><button type="button" data-scale-action="in" aria-label="放大页面">+</button></div>';
  // Both surfaces place their navigation control before the scale controls.
  host.append(ui);
  const reset = ui.querySelector('.page-scale'), trigger = ui.querySelector('.page-scale-menu'), panel = ui.querySelector('.page-zoom-panel');
  const smaller = ui.querySelector('[data-scale-action="out"]'), larger = ui.querySelector('[data-scale-action="in"]');
  function display() {
    const percent = Math.round(scale * 100) + '%';
    reset.textContent = percent; reset.setAttribute('aria-label', '当前缩放 ' + percent + '，恢复原始大小');
    smaller.disabled = scale <= .5; larger.disabled = scale >= 3;
  }
  function setScale(value, point, remember = true) {
    const next = Math.min(3, Math.max(.5, value));
    if (!Number.isFinite(next)) return;
    const x = point?.x ?? innerWidth / 2, y = point?.y ?? innerHeight / 2;
    let anchor = document.elementFromPoint?.(x, y);
    if (anchor?.closest('.page-zoom') || anchor === document.body || anchor === document.documentElement) anchor = null;
    const before = anchor?.getBoundingClientRect(), oldScroll = window.scrollY, ratio = next / scale;
    document.body.style.zoom = String(next); scale = next; display();
    document.dispatchEvent(new CustomEvent('page-scalechange'));
    if (remember) {
      // Restore the point under the pointer after layout reflows at the new scale.
      const after = anchor?.getBoundingClientRect();
      const offset = after && before ? after.top + (y - before.top) * ratio - y : (oldScroll + y) * ratio - y - window.scrollY;
      const oldBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(window.scrollX, Math.max(0, window.scrollY + offset));
      document.documentElement.style.scrollBehavior = oldBehavior;
      for (const store of stores) { try { store.setItem(storageKey, String(scale)); } catch (_) {} }
    }
  }
  function step(direction) {
    return direction > 0 ? (steps.find(n => n > scale + .001) ?? 3) : ([...steps].reverse().find(n => n < scale - .001) ?? .5);
  }
  function open(show, focus = false) {
    panel.hidden = !show; trigger.setAttribute('aria-expanded', String(show));
    if (focus) trigger.focus({preventScroll:true});
  }
  reset.addEventListener('click', () => { setScale(1); open(false); });
  trigger.addEventListener('click', () => open(panel.hidden));
  ui.addEventListener('click', event => {
    const action = event.target.closest('[data-scale-action]')?.dataset.scaleAction;
    if (action) setScale(action === 'reset' ? 1 : step(action === 'in' ? 1 : -1));
  });
  document.addEventListener('click', event => { if (!ui.contains(event.target)) open(false); });
  ui.addEventListener('focusout', event => { if (!ui.contains(event.relatedTarget)) open(false); });
  const editable = target => target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { open(false, true); return; }
    if (!(event.ctrlKey || event.metaKey) || event.altKey || editable(event.target)) return;
    if (!['+', '=', '-', '0'].includes(event.key)) return;
    event.preventDefault();
    setScale(event.key === '0' ? 1 : step(event.key === '-' ? -1 : 1));
  });
  document.addEventListener('wheel', event => {
    if (event.metaKey || !event.ctrlKey || editable(event.target) || !event.deltaY) return;
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    setScale(scale * Math.exp(-Math.max(-80, Math.min(80, pixels)) * .008), {x:event.clientX,y:event.clientY});
  }, {passive:false});
  function restore(keepPlace = false) {
    for (const store of stores) {
      try {
        const value = Number(store.getItem(storageKey));
        if (value >= .5 && value <= 3) { if (value !== scale) setScale(value, null, keepPlace); break; }
      } catch (_) {}
    }
  }
  restore();
  window.addEventListener('pageshow', () => restore(true));
  display();
})();
