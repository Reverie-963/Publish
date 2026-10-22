// Shared content scale; navigation and scale controls retain their normal size.
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
    const scale=Number(document.body.style.zoom)||1;
    document.body.style.setProperty('--content-scale',String(scale));
    document.body.style.setProperty('--ui-scale',String(1/scale));
    if(layout){
      layout.classList.toggle('tools-compact',innerWidth/scale<1100);
      const sidebar=layout.querySelector(':scope > .reader-sidebar,:scope > .index-sidebar');
      if(sidebar){
        sidebar.style.zoom=String(1/scale);
        const compact=layout.classList.contains('tools-compact')||document.body.classList.contains('is-compare-pane');
        sidebar.style.top=(compact?0:(parseFloat(getComputedStyle(layout).paddingTop)||0)*scale)+'px';
      }
    }
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
  ui.innerHTML = '<button type="button" data-scale-action="out" aria-label="缩小页面" title="缩小">−</button><button type="button" class="page-scale" aria-label="当前缩放 100%，恢复原始大小" title="恢复 100% · Cmd/Ctrl+0">100%</button><button type="button" data-scale-action="in" aria-label="放大页面" title="放大">+</button>';
  const floating=true;
  let hideTimer,hovered=false,keyboardInput=true;
  function hideZoom(){clearTimeout(hideTimer);hovered=false;ui.classList.remove('is-visible');if(ui.contains(document.activeElement))document.activeElement.blur();ui.inert=true;ui.setAttribute('aria-hidden','true');}
  function scheduleHide(){
    clearTimeout(hideTimer);
    if(!floating||!ui.classList.contains('is-visible')||hovered||(keyboardInput&&ui.contains(document.activeElement)))return;
    hideTimer=setTimeout(hideZoom,3000);
  }
  function showZoom(){if(!floating)return;ui.classList.add('is-visible');ui.inert=false;ui.removeAttribute('aria-hidden');scheduleHide();}
  if(floating){
    ui.classList.add('page-zoom-floating');ui.setAttribute('role','group');ui.setAttribute('aria-label','页面缩放');
    // Outside the scaled body: the transient controls keep their normal size.
    document.documentElement.append(ui);hideZoom();
    ui.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;hovered=true;clearTimeout(hideTimer);});
    ui.addEventListener('pointerleave',()=>{hovered=false;scheduleHide();});
    ui.addEventListener('focusin',scheduleHide);
    // Mouse/touch clicks leave focus behind; only keyboard focus pauses hiding.
    document.addEventListener('pointerdown',event=>{keyboardInput=false;if(event.pointerType==='touch')hovered=false;scheduleHide();},true);
    document.addEventListener('keydown',event=>{if(event.key==='Tab'||(ui.contains(event.target)&&!event.metaKey&&!event.ctrlKey&&['Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)))keyboardInput=true;scheduleHide();},true);
    ui.addEventListener('focusout',()=>queueMicrotask(scheduleHide));
    window.addEventListener('pagehide',hideZoom);
    window.addEventListener('blur',hideZoom);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)hideZoom();});
  }else host.append(ui);
  const reset = ui.querySelector('.page-scale');
  const smaller = ui.querySelector('[data-scale-action="out"]'), larger = ui.querySelector('[data-scale-action="in"]');
  function display() {
    const percent = Math.round(scale * 100) + '%';
    reset.textContent = percent; reset.setAttribute('aria-label', '当前缩放 ' + percent + '，恢复原始大小');
    smaller.disabled = scale <= .5; larger.disabled = scale >= 3;
  }
  function setScale(value, point, remember = true, announce = remember) {
    const next = Math.min(3, Math.max(.5, value));
    if (!Number.isFinite(next)) return;
    const x = point?.x ?? innerWidth / 2, y = point?.y ?? innerHeight / 2;
    let anchor = document.elementFromPoint?.(x, y);
    if (anchor?.closest('.reader-sidebar,.index-sidebar,.page-zoom') || anchor === document.body || anchor === document.documentElement) anchor = null;
    const before = anchor?.getBoundingClientRect(), oldScroll = window.scrollY, ratio = next / scale;
    document.body.style.zoom = String(next); scale = next; display();
    document.dispatchEvent(new CustomEvent('page-scalechange'));
    if(announce)showZoom();
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
  reset.addEventListener('click', () => setScale(1));
  ui.addEventListener('click', event => {
    const action = event.target.closest('[data-scale-action]')?.dataset.scaleAction;
    if (action) setScale(step(action === 'in' ? 1 : -1));
  });
  const editable = target => target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
  document.addEventListener('keydown', event => {
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
        if (value >= .5 && value <= 3) { if (value !== scale) setScale(value, null, keepPlace, false); break; }
      } catch (_) {}
    }
  }
  restore();
  window.addEventListener('pageshow', () => restore(true));
  display();
})();
