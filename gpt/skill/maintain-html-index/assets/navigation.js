// Remember each index independently; keys follow heading ancestry, not list position.
(() => {
  const tree = document.querySelector('.tree');
  if (!tree) return;
  const branches = Array.from(tree.querySelectorAll('details'));
  const buttons = Array.from(document.querySelectorAll('[data-tree-toggle]'));
  function syncButton() {
    const anyOpen = branches.some(node => node.open);
    buttons.forEach(button => {
      button.disabled = branches.length === 0;
      button.dataset.action = anyOpen ? 'collapse' : 'expand';
      button.title = anyOpen ? '全部收起' : '全部展开';
      button.setAttribute('aria-label', button.title);
    });
  }
  const label = node => node.querySelector('summary').textContent.trim();
  const parent = node => node.parentElement.closest('details');
  const keys = new Map();
  function key(node) {
    if (keys.has(node)) return keys.get(node);
    const owner = parent(node);
    const peers = branches.filter(other => parent(other) === owner && label(other) === label(node));
    const parts = owner ? JSON.parse(key(owner)) : [];
    parts.push([label(node), peers.indexOf(node)]);
    const value = JSON.stringify(parts);
    keys.set(node, value);
    return value;
  }
  branches.forEach(key);
  const storageKey = 'course-index:v1:' + location.href.split(/[?#]/)[0];
  const stores = [];
  for (const name of ['localStorage', 'sessionStorage']) {
    try { const store = window[name]; store.getItem(storageKey); stores.push(store); } catch (_) {}
  }
  function save() {
    syncButton();
    const state = JSON.stringify({version:1, open:branches.filter(node => node.open).map(key), scroll:window.scrollY});
    for (const store of stores) { try { store.setItem(storageKey, state); } catch (_) {} }
  }
  const motions=new Map(),motionPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  function stopMotion(){for(const animation of motions.values())animation.cancel();motions.clear();}
  motionPreference?.addEventListener?.('change',stopMotion);
  window.addEventListener('resize',stopMotion);
  document.addEventListener('page-scalechange',stopMotion);
  function changeBranches(nodes,open){
    const animate=!motionPreference?.matches&&typeof tree.animate==='function';
    const zoom=Number(document.body.style.zoom)||1;
    // Only animate the outer changed branches; nested heights must not compound.
    const outer=nodes.filter(node=>!nodes.some(other=>other!==node&&other.contains(node)));
    const previous=animate?outer.map(node=>[node,node.getBoundingClientRect().height/zoom]):[];
    stopMotion();
    nodes.forEach(node=>{node.open=open;});
    for(const [node,height] of previous){
      const next=node.getBoundingClientRect().height/zoom;
      if(Math.abs(height-next)<.5)continue;
      const animation=node.animate([
        {height:height+'px',overflow:'clip',boxSizing:'border-box'},
        {height:next+'px',overflow:'clip',boxSizing:'border-box'}
      ],{duration:200,easing:'cubic-bezier(.2,.7,.2,1)'});
      motions.set(node,animation);
      animation.onfinish=()=>{if(motions.get(node)===animation)motions.delete(node);};
    }
    save();
  }
  function restore() {
    stopMotion();
    for (const store of stores) {
      try {
        const state = JSON.parse(store.getItem(storageKey));
        if (!state || state.version !== 1 || !Array.isArray(state.open)) continue;
        const open = new Set(state.open);
        branches.forEach(node => { node.open = open.has(key(node)); });
        if (Number.isFinite(state.scroll)) requestAnimationFrame(() => window.scrollTo(0, state.scroll));
        break;
      } catch (_) {}
    }
    syncButton();
  }
  restore();
  branches.forEach(node => node.addEventListener('toggle', save));
  tree.addEventListener('click', event => {
    if(event.target.closest('a')){save();return;}
    const summary=event.target.closest('summary');
    if(!summary||!tree.contains(summary)||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    changeBranches([summary.parentElement],!summary.parentElement.open);
  });
  buttons.forEach(button => button.addEventListener('click', () => {
    const open = !branches.some(node => node.open);
    changeBranches(branches,open);
  }));
  window.addEventListener('pagehide', save);
  window.addEventListener('pageshow', restore);
})();
