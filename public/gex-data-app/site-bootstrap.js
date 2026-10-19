// Runs before styles/modules: iframe first paint belongs to the signed-in site's
// current theme, not the prototype palette or the browser's white canvas.
(() => {
  const root = document.documentElement;
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
