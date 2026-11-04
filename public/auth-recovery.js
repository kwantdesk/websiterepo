(() => {
  const status = document.getElementById('recovery-status');
  const button = document.getElementById('retry-session');
  button?.addEventListener('click', () => location.reload());
  let attempts = 0, timer;
  async function retry() {
    attempts++;
    try {
      const result = await fetch(location.href, { method: 'HEAD', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(7000) });
      if (result.ok) { location.reload(); return; }
    } catch { /* Keep the recovery shell; do not clear or refresh credentials. */ }
    if (attempts < 3) timer = setTimeout(retry, attempts * 2000);
    else if (status) status.textContent = 'Still unable to verify your session. You can try again shortly.';
  }
  timer = setTimeout(retry, 2000);
  window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });
})();
