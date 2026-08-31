const DEFAULT_REVOCATION_CHECK_MS = 5_000;

export function createDesktopStreamGuard({
  authorization,
  response,
  revocationCache,
  now = () => Date.now(),
  revocationCheckMs = DEFAULT_REVOCATION_CHECK_MS,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
}) {
  if (authorization?.mode !== "desktop-ticket") {
    return Object.freeze({ active: false, dispose() {} });
  }

  let disposed = false;
  let checking = false;
  let lease = null;
  let watch = null;

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (lease) clearTimeoutImpl(lease);
    if (watch) clearIntervalImpl(watch);
  }

  function close(reason) {
    if (disposed || response.writableEnded || response.destroyed) {
      dispose();
      return;
    }
    const timestamp = now();
    dispose();
    try {
      response.write(`event: rotate\ndata: ${JSON.stringify({ reason, timestamp })}\n\n`);
    } finally {
      response.end();
    }
  }

  const expiresAtMs = Number(authorization.principal?.expiresAt || 0) * 1_000;
  lease = setTimeoutImpl(() => close("ticket-expired"), Math.max(0, expiresAtMs - now()));
  lease?.unref?.();

  if (!revocationCache) {
    close("revocation-unavailable");
  } else {
    watch = setIntervalImpl(async () => {
      if (checking || disposed || response.writableEnded || response.destroyed) return;
      checking = true;
      try {
        if (await revocationCache.isRevoked(authorization.principal)) close("ticket-revoked");
      } catch {
        close("revocation-unavailable");
      } finally {
        checking = false;
      }
    }, revocationCheckMs);
    watch?.unref?.();
  }

  return Object.freeze({
    get active() { return !disposed; },
    dispose,
  });
}

export const desktopStreamGuardContract = Object.freeze({
  defaultRevocationCheckMs: DEFAULT_REVOCATION_CHECK_MS,
});
