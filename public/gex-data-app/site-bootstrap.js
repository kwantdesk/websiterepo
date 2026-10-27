// Runs before styles/modules: iframe first paint belongs to the signed-in site's
// current theme, not the prototype palette or the browser's white canvas.
(() => {
  const root = document.documentElement;
  // Host registration runs in React after the frame can start parsing. Seed
  // from the already-painted same-origin parent before any prototype CSS runs.
  const keys = ['background', 'panel', 'surface', 'foreground', 'muted', 'border', 'primary', 'secondary', 'accent', 'danger'];
  let seed = {background:'#000000',panel:'#080808',surface:'#151515',foreground:'#FFFFFF',muted:'#777777',border:'#333333',primary:'#FFFFFF',secondary:'#9A9A9A',accent:'#9A9A9A',danger:'#6B6B6B',bullish:'#FFFFFF',bearish:'#737373'};
  try {
    const saved = JSON.parse(localStorage.getItem('olisa-theme') || 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const key of Object.keys(seed)) if (typeof saved[key] === 'string' && saved[key]) seed[key] = saved[key];
    }
  } catch { /* A parent palette can still recover unavailable local storage. */ }
  try {
    if (window.parent !== window) {
      const parentStyle = window.parent.getComputedStyle(window.parent.document.documentElement);
      for (const key of keys) {
        const value = parentStyle.getPropertyValue('--' + key).trim();
        if (value) seed[key] = value;
      }
      seed.bullish = parentStyle.getPropertyValue('--candle-up').trim() || seed.primary;
      seed.bearish = parentStyle.getPropertyValue('--candle-down').trim() || seed.danger;
    }
  } catch { /* Never cross an origin boundary. */ }
  for (const [key, value] of Object.entries(seed)) {
    if (typeof value === 'string' && value) root.style.setProperty('--site-' + key, value);
  }
  if (seed.background) root.style.backgroundColor = seed.background;
  if (seed.foreground) root.style.color = seed.foreground;
  const hostId = new URLSearchParams(location.search).get('hostId');
  let owner = window;
  for (let depth = 0; depth < 5; depth++) {
    try {
      const host = hostId ? owner.__kwantOptionsToolHosts?.[hostId] : location.pathname?.startsWith('/kwanty-app/') ? owner.__kwantyHost : owner.__kwantGexDataHost;
      if (host) {
        const theme = host.theme();
        for (const [key, value] of Object.entries(theme)) root.style.setProperty('--site-' + key, value);
        root.style.backgroundColor = theme.background;
        root.style.color = theme.foreground;
        break;
      }
      if (owner.parent !== owner) owner = owner.parent;
      else if (owner.opener) owner = owner.opener;
      else break;
    } catch { break; } // Cross-origin frames must never be inspected.
  }
})();
