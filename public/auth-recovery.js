(() => {
  const status = document.getElementById('recovery-status');
  const button = document.getElementById('retry-session');
  let attempts = 0, timer, busy = false, stopped = false;
  function schedule(delay) {
    clearTimeout(timer);
    if (!stopped && !document.hidden) timer = setTimeout(retry, delay);
  }
  async function retry() {
    if (stopped || busy || document.hidden) return;
    clearTimeout(timer);
    busy = true;
    attempts++;
    try {
      const result = await fetch(location.href, { method: 'HEAD', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(7000) });
      if (result.ok && !stopped) { stopped = true; location.reload(); return; }
    } catch { /* Keep the recovery shell; do not clear or refresh credentials. */ }
    finally { busy = false; }
    if (status && attempts >= 3) status.textContent = 'Waiting for the sign-in service to recover. Reconnecting automatically…';
    // A project restart can take minutes. Three short attempts used to leave
    // the owner stranded here even after Auth recovered. Back off instead;
    // hidden tabs do no work and concurrent clicks never multiply probes.
    schedule(Math.min(30000, 2000 * 2 ** Math.min(attempts, 4)));
  }
  button?.addEventListener('click', () => void retry());
  document.addEventListener('visibilitychange', () => schedule(document.hidden ? 30000 : 0));
  window.addEventListener('online', () => schedule(0));
  schedule(2000);
  window.addEventListener('pagehide', () => { stopped = true; clearTimeout(timer); }, { once: true });
})();
