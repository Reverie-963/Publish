// One user click opens the registered local original. No requests or polling.
document.addEventListener('click', event => {
  const link = event.target.closest?.('a[data-native-open]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = link.dataset.nativeOpen;
  if (!/^reverie-preview:\/\/open\/[a-f0-9]{64}$/.test(target)) return;
  event.preventDefault();
  // Keep the ordinary href available for copying, right-clicking or other computers.
  window.location.href = target;
});
