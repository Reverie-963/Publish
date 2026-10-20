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
  function restore() {
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
  tree.addEventListener('click', event => { if (event.target.closest('a')) save(); }, true);
  buttons.forEach(button => button.addEventListener('click', () => {
    const open = !branches.some(node => node.open);
    branches.forEach(node => { node.open = open; });
    save();
  }));
  window.addEventListener('pagehide', save);
  window.addEventListener('pageshow', restore);
})();
