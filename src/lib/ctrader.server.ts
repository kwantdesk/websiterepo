import type { CTraderTokenSet } from "@/lib/ctraderSession";
import { readCTraderServerTokenSet, saveCTraderServerTokenSet } from "@/lib/ctraderTokenStore.server";

type CTraderEnvironment = "demo" | "live";

type CTraderBrokerAccount = {
  broker: string;
  label: string;
  accountId: number;
  environment: CTraderEnvironment;
  aliases?: string[];
};

type RawCTraderMessage = {
  clientMsgId?: string;
  payloadType?: number;
  payload?: Record<string, unknown>;
};

type CTraderAccountSummary = {
  ctidTraderAccountId: number;
  isLive?: boolean;
  traderLogin?: number;
};

type CTraderLightSymbol = {
  symbolId: number;
  symbolName?: string;
  description?: string;
  enabled?: boolean;
};

type CTraderSymbol = {
  symbolId: number;
  symbolName?: string;
  description?: string;
  digits?: number;
};

type CTraderResolvedSymbol = {
  displaySymbol: string;
  light: CTraderLightSymbol;
  symbol: CTraderSymbol;
};

type CTraderTrendbar = {
  low: number;
  deltaOpen: number;
  deltaClose: number;
  deltaHigh: number;
  volume: number;
  utcTimestampInMinutes: number;
};

const CTRADER_JSON_ENDPOINTS: Record<CTraderEnvironment, string> = {
  demo: "wss://demo.ctraderapi.com:5036",
  live: "wss://live.ctraderapi.com:5036",
};

const PAYLOAD = {
  applicationAuthReq: 2100,
  applicationAuthRes: 2101,
  accountAuthReq: 2102,
  accountAuthRes: 2103,
  symbolsListReq: 2114,
  symbolsListRes: 2115,
  symbolByIdReq: 2116,
  symbolByIdRes: 2117,
  traderReq: 2121,
  traderRes: 2122,
  subscribeSpotsReq: 2127,
  subscribeSpotsRes: 2128,
  spotEvent: 2131,
  subscribeLiveTrendbarReq: 2135,
  getTrendbarsReq: 2137,
  getTrendbarsRes: 2138,
  errorRes: 2142,
  getAccountsByAccessTokenReq: 2149,
  getAccountsByAccessTokenRes: 2150,
} as const;

const TRENDBAR_PERIODS: Record<string, number> = {
  "1m": 1,
  "2m": 2,
  "3m": 3,
  "4m": 4,
  "5m": 5,
  "10m": 6,
  "15m": 7,
  "30m": 8,
  "1h": 9,
  "4h": 10,
  "12h": 11,
  "1D": 12,
  "1W": 13,
  "1M": 14,
};

const DISPLAY_SYMBOL_ALIASES: Record<string, string[]> = {
  NAS100: ["NAS100", "US100", "USTEC", "NAS100USD"],
  XAUUSD: ["XAUUSD", "GOLD", "XAUUSD.SPOT"],
  EURUSD: ["EURUSD"],
  GBPUSD: ["GBPUSD"],
  GER40: ["GER40", "DE40", "GERMANY40"],
  "S&P500": ["SPX500", "US500", "S&P500", "SP500"],
  UK100: ["UK100", "FTSE100"],
  USDJPY: ["USDJPY"],
  AUDUSD: ["AUDUSD"],
  NZDUSD: ["NZDUSD"],
  USDCAD: ["USDCAD"],
  USDCHF: ["USDCHF"],
  US30: ["US30", "DJ30", "WALLSTREET30"],
  DOW30: ["US30", "DJ30", "WALLSTREET30"],
  OIL: ["USOIL", "UKOIL", "XBRUSD", "XTIUSD", "OIL"],
  NIKKEI: ["JP225", "JPN225", "NIKKEI225"],
};

const DEFAULT_CTRADER_BROKER_ACCOUNTS: CTraderBrokerAccount[] = [
  {
    broker: "Pepperstone",
    label: "Pepperstone - Demo - 5289101",
    accountId: 5289101,
    environment: "demo",
    aliases: ["Pepperstone - Demo - 5289101"],
  },
  {
    broker: "IC Markets",
    label: "IC Markets cTrader - Demo - 9029766",
    accountId: 9029766,
    environment: "demo",
    aliases: ["ic markets", "ic markets ctrader", "ic markets ctrader demo"],
  },
  {
    broker: "FP Markets",
    label: "FPMarketsASIC - Demo - 1110550",
    accountId: 1110550,
    environment: "demo",
    aliases: ["fp markets", "fpmarketsasic", "fp markets demo"],
  },
  {
    broker: "BlackBull Markets",
    label: "BlackBull Markets - Demo - 2127793",
    accountId: 2127793,
    environment: "demo",
    aliases: ["blackbull", "blackbull markets", "blackbull markets demo"],
  },
  {
    broker: "FxPro",
    label: "FxPro - Demo - 10639945",
    accountId: 10639945,
    environment: "demo",
    aliases: ["fxpro", "fxpro demo"],
  },
];

const CTRADER_TOKEN_REFRESH_SKEW_MS = 60_000;
let cachedEnvironmentTokenSet: CTraderTokenSet | null = null;

function normalizeBrokerKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function getConfig(): {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  environment: CTraderEnvironment;
  brokerAccounts: CTraderBrokerAccount[];
} {
  const clientId = process.env.CTRADER_CLIENT_ID;
  const clientSecret = process.env.CTRADER_CLIENT_SECRET;
  const refreshToken = process.env.CTRADER_REFRESH_TOKEN;
  const accessToken = process.env.CTRADER_ACCESS_TOKEN;
  const environment = (process.env.CTRADER_ENVIRONMENT || "demo").toLowerCase() as CTraderEnvironment;
  const accountsJson = process.env.CTRADER_BROKER_ACCOUNTS_JSON;

  let brokerAccounts: CTraderBrokerAccount[] = [];

  if (accountsJson) {
    try {
      const parsed = JSON.parse(accountsJson) as Array<Partial<CTraderBrokerAccount>>;
      brokerAccounts = parsed
        .filter((entry) => entry.broker && entry.label && entry.accountId)
        .map((entry) => ({
          broker: String(entry.broker),
          label: String(entry.label),
          accountId: Number(entry.accountId),
          environment: entry.environment === "live" ? "live" : "demo",
          aliases: Array.isArray(entry.aliases) ? entry.aliases.map(String) : undefined,
        }));
    } catch {
      throw new Error("CTRADER_BROKER_ACCOUNTS_JSON is not valid JSON.");
    }
  }

  if (brokerAccounts.length === 0) {
    const singleAccountId = process.env.CTRADER_ACCOUNT_ID;
    if (singleAccountId) {
      brokerAccounts = [
        {
          broker: "Pepperstone",
          label: `Pepperstone - ${environment === "live" ? "Live" : "Demo"} - ${singleAccountId}`,
          accountId: Number(singleAccountId),
          environment: environment === "live" ? "live" : "demo",
          aliases: ["pepperstone"],
        },
      ];
    } else {
      brokerAccounts = DEFAULT_CTRADER_BROKER_ACCOUNTS;
    }
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    accessToken,
    environment: environment === "live" ? "live" : "demo",
    brokerAccounts,
  };
}

function normaliseSymbolKey(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function roundToDigits(value: number, digits = 5) {
  return Number(value.toFixed(digits));
}

function priceFromRelative(relative: number | undefined, digits = 5) {
  if (typeof relative !== "number") return 0;
  return roundToDigits(relative / 100000, digits);
}

function getIntervalMs(interval: string) {
  const map: Record<string, number> = {
    "1m": 60_000,
    "2m": 120_000,
    "3m": 180_000,
    "4m": 240_000,
    "5m": 300_000,
    "10m": 600_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "12h": 43_200_000,
    "1D": 86_400_000,
    "1W": 604_800_000,
    "1M": 2_592_000_000,
  };
  return map[interval] ?? 300_000;
}

function getAliases(displaySymbol: string) {
  return DISPLAY_SYMBOL_ALIASES[displaySymbol] ?? [displaySymbol];
}

function resolveLightSymbol(displaySymbol: string, symbols: CTraderLightSymbol[]) {
  const aliases = getAliases(displaySymbol).map(normaliseSymbolKey);
  const primaryAlias = aliases[0];

  const ranked = symbols
    .filter((symbol) => symbol.enabled !== false && symbol.symbolName)
    .map((symbol) => {
      const name = symbol.symbolName ?? "";
      const normalisedName = normaliseSymbolKey(name);
      let score = Number.MAX_SAFE_INTEGER;

      if (aliases.includes(normalisedName)) score = 0;
      else if (normalisedName.startsWith(primaryAlias)) score = 1;
      else if (aliases.some((alias) => normalisedName.startsWith(alias))) score = 2;

      return { symbol, score, length: name.length };
    })
    .filter((entry) => entry.score < Number.MAX_SAFE_INTEGER)
    .sort((a, b) => a.score - b.score || a.length - b.length);

  return ranked[0]?.symbol;
}

class CTraderJsonClient {
  private ws: WebSocket;
  private counter = 0;
  private pending = new Map<
    string,
    {
      resolve: (message: RawCTraderMessage) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private eventListeners = new Set<(message: RawCTraderMessage) => void>();

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener("message", (event) => this.onMessage(String(event.data)));
    this.ws.addEventListener("error", () => {
      for (const [key, pending] of this.pending.entries()) {
        clearTimeout(pending.timer);
        pending.reject(new Error("cTrader websocket error."));
        this.pending.delete(key);
      }
    });
  }

  async open() {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to cTrader.")), 8_000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Failed to connect to cTrader."));
      }, { once: true });
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }

  addEventListener(listener: (message: RawCTraderMessage) => void) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  send(payloadType: number, payload: Record<string, unknown>, timeoutMs = 8_000) {
    const clientMsgId = `ctrader-${Date.now()}-${++this.counter}`;

    return new Promise<RawCTraderMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(clientMsgId);
        reject(new Error(`Timed out waiting for cTrader response (${payloadType}).`));
      }, timeoutMs);

      this.pending.set(clientMsgId, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ clientMsgId, payloadType, payload }));
    });
  }

  private onMessage(raw: string) {
    let message: RawCTraderMessage;
    try {
      message = JSON.parse(raw) as RawCTraderMessage;
    } catch {
      return;
    }

    if (message.clientMsgId && this.pending.has(message.clientMsgId)) {
      const pending = this.pending.get(message.clientMsgId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.clientMsgId);

      if (message.payloadType === PAYLOAD.errorRes) {
        const errorCode = String(message.payload?.errorCode ?? "UNKNOWN");
        const description = String(message.payload?.description ?? "Unknown cTrader error.");
        pending.reject(new Error(`${errorCode}: ${description}`));
        return;
      }

      pending.resolve(message);
      return;
    }

    for (const listener of this.eventListeners) {
      listener(message);
    }
  }
}

function expiresAtFromIssuedAt(issuedAt: number, expiresIn?: number) {
  if (!expiresIn || !Number.isFinite(expiresIn)) return undefined;
  return issuedAt + expiresIn * 1000;
}

function shouldRefreshToken(tokenSet: CTraderTokenSet) {
  if (!tokenSet.refreshToken) return false;
  const expiresAt = tokenSet.expiresAt ?? expiresAtFromIssuedAt(tokenSet.issuedAt ?? 0, tokenSet.expiresIn);
  if (!tokenSet.accessToken || !expiresAt) return true;
  return Date.now() + CTRADER_TOKEN_REFRESH_SKEW_MS >= expiresAt;
}

async function refreshCTraderToken(refreshToken: string, fallbackRefreshToken?: string): Promise<CTraderTokenSet> {
  const config = getConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error("CTRADER_CLIENT_ID and CTRADER_CLIENT_SECRET are required when refreshing cTrader tokens.");
  }

  const url = new URL("https://openapi.ctrader.com/apps/token");
  url.searchParams.set("grant_type", "refresh_token");
  url.searchParams.set("refresh_token", refreshToken);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("client_secret", config.clientSecret);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok || !data?.accessToken) {
    throw new Error(data?.description || data?.errorCode || "Failed to refresh cTrader access token.");
  }

  const issuedAt = Date.now();
  const expiresIn = typeof data.expiresIn === "number" ? data.expiresIn : Number(data.expiresIn) || undefined;
  return {
    accessToken: String(data.accessToken),
    refreshToken: typeof data.refreshToken === "string" ? data.refreshToken : fallbackRefreshToken,
    tokenType: typeof data.tokenType === "string" ? data.tokenType : undefined,
    expiresIn,
    issuedAt,
    expiresAt: expiresAtFromIssuedAt(issuedAt, expiresIn),
  };
}

function copyTokenSet(target: CTraderTokenSet, source: CTraderTokenSet) {
  target.accessToken = source.accessToken;
  target.refreshToken = source.refreshToken;
  target.tokenType = source.tokenType;
  target.expiresIn = source.expiresIn;
  target.issuedAt = source.issuedAt;
  target.expiresAt = source.expiresAt;
}

function isCTraderAccessTokenInvalidError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("ch_access_token_invalid") || message.includes("invalid access token");
}

async function forceRefreshAccessToken(tokenSet?: CTraderTokenSet) {
  if (tokenSet?.refreshToken) {
    const refreshed = await refreshCTraderToken(tokenSet.refreshToken, tokenSet.refreshToken);
    copyTokenSet(tokenSet, refreshed);
    await saveCTraderServerTokenSet(tokenSet);
    return tokenSet.accessToken;
  }

  const storedTokenSet = await readCTraderServerTokenSet();
  if (storedTokenSet?.refreshToken) {
    const refreshed = await refreshCTraderToken(storedTokenSet.refreshToken, storedTokenSet.refreshToken);
    copyTokenSet(storedTokenSet, refreshed);
    await saveCTraderServerTokenSet(storedTokenSet);
    return storedTokenSet.accessToken;
  }

  const config = getConfig();
  if (config.refreshToken) {
    cachedEnvironmentTokenSet = await refreshCTraderToken(config.refreshToken, config.refreshToken);
    return cachedEnvironmentTokenSet.accessToken;
  }

  throw new Error("cTrader access token is invalid and no refresh token is configured. Re-authorise cTrader.");
}

async function getAccessToken(tokenSet?: CTraderTokenSet) {
  if (tokenSet?.refreshToken && shouldRefreshToken(tokenSet)) {
    const refreshed = await refreshCTraderToken(tokenSet.refreshToken, tokenSet.refreshToken);
    copyTokenSet(tokenSet, refreshed);
    await saveCTraderServerTokenSet(tokenSet);
    return tokenSet.accessToken;
  }

  if (tokenSet?.accessToken) {
    return tokenSet.accessToken;
  }

  const config = getConfig();
  const storedTokenSet = await readCTraderServerTokenSet();
  if (storedTokenSet?.refreshToken) {
    if (shouldRefreshToken(storedTokenSet)) {
      const refreshed = await refreshCTraderToken(storedTokenSet.refreshToken, storedTokenSet.refreshToken);
      copyTokenSet(storedTokenSet, refreshed);
      await saveCTraderServerTokenSet(storedTokenSet);
    }
    return storedTokenSet.accessToken;
  }

  if (config.refreshToken) {
    if (!cachedEnvironmentTokenSet || shouldRefreshToken(cachedEnvironmentTokenSet)) {
      cachedEnvironmentTokenSet = await refreshCTraderToken(config.refreshToken, config.refreshToken);
    }
    return cachedEnvironmentTokenSet.accessToken;
  }

  if (!config.accessToken) {
    throw new Error("cTrader token is not configured. Add CTRADER_REFRESH_TOKEN or CTRADER_ACCESS_TOKEN, or complete the broker OAuth flow.");
  }

  return config.accessToken!;
}

export async function exchangeCTraderAuthorizationCode(code: string, redirectUri: string): Promise<CTraderTokenSet> {
  const config = getConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("CTRADER_CLIENT_ID and CTRADER_CLIENT_SECRET are required to exchange the cTrader authorisation code.");
  }

  const url = new URL("https://openapi.ctrader.com/apps/token");
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("code", code);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("client_secret", config.clientSecret);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok || !data?.accessToken) {
    throw new Error(data?.description || data?.errorCode || "Failed to exchange cTrader authorisation code.");
  }

  const issuedAt = Date.now();
  const expiresIn = typeof data.expiresIn === "number" ? data.expiresIn : Number(data.expiresIn) || undefined;
  return {
    accessToken: String(data.accessToken),
    refreshToken: typeof data.refreshToken === "string" ? data.refreshToken : undefined,
    tokenType: typeof data.tokenType === "string" ? data.tokenType : undefined,
    expiresIn,
    issuedAt,
    expiresAt: expiresAtFromIssuedAt(issuedAt, expiresIn),
  };
}

async function authoriseApplication(client: CTraderJsonClient) {
  const config = getConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("CTRADER_CLIENT_ID and CTRADER_CLIENT_SECRET are required to authorise the cTrader application.");
  }

  await client.send(PAYLOAD.applicationAuthReq, {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
}

function resolveBrokerAccount(preferredBroker?: string) {
  const config = getConfig();
  const brokerAccounts = config.brokerAccounts;
  const desired = preferredBroker ? normalizeBrokerKey(preferredBroker) : "";

  if (!desired) {
    return brokerAccounts[0];
  }

  return (
    brokerAccounts.find((entry) => normalizeBrokerKey(entry.broker) === desired) ??
    brokerAccounts.find((entry) => normalizeBrokerKey(entry.label) === desired) ??
    brokerAccounts.find((entry) => (entry.aliases ?? []).some((alias) => normalizeBrokerKey(alias) === desired)) ??
    brokerAccounts[0]
  );
}

async function withAuthorisedClient<T>(
  preferredBroker: string | undefined,
  tokenSet: CTraderTokenSet | undefined,
  fn: (client: CTraderJsonClient, account: CTraderBrokerAccount) => Promise<T>,
) {
  const config = getConfig();
  const selectedAccount = resolveBrokerAccount(preferredBroker);
  let accessToken = await getAccessToken(tokenSet);
  const client = new CTraderJsonClient(CTRADER_JSON_ENDPOINTS[selectedAccount.environment ?? config.environment]);
  await client.open();

  try {
    await authoriseApplication(client);

    let accountListMessage: RawCTraderMessage;
    try {
      accountListMessage = await client.send(PAYLOAD.getAccountsByAccessTokenReq, { accessToken });
    } catch (error) {
      if (!isCTraderAccessTokenInvalidError(error)) throw error;
      accessToken = await forceRefreshAccessToken(tokenSet);
      accountListMessage = await client.send(PAYLOAD.getAccountsByAccessTokenReq, { accessToken });
    }
    const accounts = (accountListMessage.payload?.ctidTraderAccount as CTraderAccountSummary[] | undefined) ?? [];
    const linkedAccount = accounts.find(
      (account) =>
        Number(account.ctidTraderAccountId) === selectedAccount.accountId ||
        Number(account.traderLogin ?? -1) === selectedAccount.accountId,
    );

    if (!linkedAccount) {
      const scope = String(accountListMessage.payload?.permissionScope ?? "unknown");
      throw new Error(
        `${selectedAccount.broker} account ${selectedAccount.accountId} is not accessible with the current cTrader token (scope: ${scope}). Re-authorise the app and prefer "Account info and trading" scope.`,
      );
    }

    const ctidTraderAccountId = Number(linkedAccount.ctidTraderAccountId);

    await client.send(PAYLOAD.accountAuthReq, {
      ctidTraderAccountId,
      accessToken,
    });

    return await fn(client, { ...selectedAccount, accountId: ctidTraderAccountId });
  } finally {
    client.close();
  }
}

async function getResolvedSymbols(client: CTraderJsonClient, accountId: number, displaySymbols: string[]) {
  const lightSymbolsMessage = await client.send(
    PAYLOAD.symbolsListReq,
    { ctidTraderAccountId: accountId, includeArchivedSymbols: false },
    12_000,
  );

  const lightSymbols = ((lightSymbolsMessage.payload?.symbol as CTraderLightSymbol[] | undefined) ?? []).filter(
    (symbol) => symbol.enabled !== false,
  );

  const lightByDisplay = displaySymbols
    .map((displaySymbol) => ({ displaySymbol, light: resolveLightSymbol(displaySymbol, lightSymbols) }))
    .filter((entry): entry is { displaySymbol: string; light: CTraderLightSymbol } => Boolean(entry.light));

  if (lightByDisplay.length === 0) {
    return [];
  }

  const detailMessage = await client.send(
    PAYLOAD.symbolByIdReq,
    {
      ctidTraderAccountId: accountId,
      symbolId: lightByDisplay.map((entry) => entry.light.symbolId),
    },
    12_000,
  );

  const details = (detailMessage.payload?.symbol as CTraderSymbol[] | undefined) ?? [];
  const detailMap = new Map(details.map((symbol) => [Number(symbol.symbolId), symbol]));

  return lightByDisplay
    .map((entry) => {
      const symbol = detailMap.get(Number(entry.light.symbolId));
      if (!symbol) return null;
      return { displaySymbol: entry.displaySymbol, light: entry.light, symbol };
    })
    .filter((entry): entry is CTraderResolvedSymbol => Boolean(entry));
}

function transformTrendbars(trendbars: CTraderTrendbar[], symbol: CTraderSymbol) {
  const digits = symbol.digits ?? 5;

  return trendbars
    .map((trendbar) => {
      const lowRaw = Number(trendbar.low);
      return {
        timestamp: Number(trendbar.utcTimestampInMinutes) * 60_000,
        open: priceFromRelative(lowRaw + Number(trendbar.deltaOpen), digits),
        high: priceFromRelative(lowRaw + Number(trendbar.deltaHigh), digits),
        low: priceFromRelative(lowRaw, digits),
        close: priceFromRelative(lowRaw + Number(trendbar.deltaClose), digits),
        volume: Number(trendbar.volume ?? 0),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function getCTraderBrokerAccounts() {
  const config = getConfig();
  return config.brokerAccounts.map((account) => ({
    broker: account.broker,
    label: account.label,
    accountId: account.accountId,
    environment: account.environment,
  }));
}

export async function getCTraderLinkedAccounts(tokenSet: CTraderTokenSet) {
  const config = getConfig();
  let accessToken = await getAccessToken(tokenSet);
  const client = new CTraderJsonClient(CTRADER_JSON_ENDPOINTS[config.environment]);
  await client.open();

  try {
    await authoriseApplication(client);
    let accountListMessage: RawCTraderMessage;
    try {
      accountListMessage = await client.send(PAYLOAD.getAccountsByAccessTokenReq, { accessToken });
    } catch (error) {
      if (!isCTraderAccessTokenInvalidError(error)) throw error;
      accessToken = await forceRefreshAccessToken(tokenSet);
      accountListMessage = await client.send(PAYLOAD.getAccountsByAccessTokenReq, { accessToken });
    }
    return {
      permissionScope: String(accountListMessage.payload?.permissionScope ?? "unknown"),
      accounts: ((accountListMessage.payload?.ctidTraderAccount as Array<Record<string, unknown>> | undefined) ?? []).map((account) => ({
        accountId: Number(account.ctidTraderAccountId ?? 0),
        isLive: Boolean(account.isLive),
        traderLogin: typeof account.traderLogin === "number" ? account.traderLogin : undefined,
        brokerName: typeof account.brokerName === "string" ? account.brokerName : undefined,
        brokerTitle: typeof account.brokerTitle === "string" ? account.brokerTitle : undefined,
        accountNumber: typeof account.accountNumber === "string" ? account.accountNumber : undefined,
      })),
    };
  } finally {
    client.close();
  }
}

export async function getCTraderInstrumentCatalogue(preferredBroker?: string, tokenSet?: CTraderTokenSet) {
  return withAuthorisedClient(preferredBroker, tokenSet, async (client, account) => {
    const lightSymbolsMessage = await client.send(
      PAYLOAD.symbolsListReq,
      { ctidTraderAccountId: account.accountId, includeArchivedSymbols: false },
      12_000,
    );

    return ((lightSymbolsMessage.payload?.symbol as CTraderLightSymbol[] | undefined) ?? [])
      .filter((symbol) => symbol.enabled !== false)
      .map((symbol) => ({
        id: symbol.symbolId,
        name: symbol.symbolName ?? "",
        description: symbol.description ?? "",
      }));
  });
}

export async function getCTraderInstrumentSymbols(preferredBroker?: string, tokenSet?: CTraderTokenSet) {
  const catalogue = await getCTraderInstrumentCatalogue(preferredBroker, tokenSet);
  return catalogue
    .map((instrument) => instrument.name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export async function getCTraderPricing(preferredBroker: string | undefined, displaySymbols: string[], tokenSet?: CTraderTokenSet) {
  return withAuthorisedClient(preferredBroker, tokenSet, async (client, account) => {
    const resolvedSymbols = await getResolvedSymbols(client, account.accountId, displaySymbols);
    if (resolvedSymbols.length === 0) return [];

    const results = new Map<string, { instrument: string; bid: number; ask: number; mid: number; spread: number; time: string; broker: string }>();
    const symbolById = new Map(resolvedSymbols.map((entry) => [Number(entry.symbol.symbolId), entry]));

    const unsubscribe = client.addEventListener((message) => {
      if (message.payloadType !== PAYLOAD.spotEvent) return;
      const symbolId = Number(message.payload?.symbolId);
      const resolved = symbolById.get(symbolId);
      if (!resolved) return;

      const digits = resolved.symbol.digits ?? 5;
      const bid = priceFromRelative(Number(message.payload?.bid ?? 0), digits);
      const ask = priceFromRelative(Number(message.payload?.ask ?? 0), digits);
      if (!bid && !ask) return;

      results.set(resolved.displaySymbol, {
        instrument: resolved.displaySymbol,
        bid,
        ask,
        mid: roundToDigits((bid + ask) / 2, digits),
        spread: roundToDigits(ask - bid, digits),
        time: new Date(Number(message.payload?.timestamp ?? Date.now())).toISOString(),
        broker: account.broker,
      });
    });

    try {
      await Promise.all(
        resolvedSymbols.map((entry) =>
          client.send(PAYLOAD.subscribeSpotsReq, {
            ctidTraderAccountId: account.accountId,
            symbolId: [entry.symbol.symbolId],
            subscribeToSpotTimestamp: true,
          }),
        ),
      );

      const deadline = Date.now() + 4_000;
      while (results.size < resolvedSymbols.length && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } finally {
      unsubscribe();
    }

    return resolvedSymbols
      .map((entry) => results.get(entry.displaySymbol))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
  });
}

export async function getCTraderCandles(
  preferredBroker: string | undefined,
  displaySymbol: string,
  interval: string,
  options?: { from?: number; to?: number; count?: number },
  tokenSet?: CTraderTokenSet,
) {
  return withAuthorisedClient(preferredBroker, tokenSet, async (client, account) => {
    const resolvedSymbols = await getResolvedSymbols(client, account.accountId, [displaySymbol]);
    const resolved = resolvedSymbols[0];

    if (!resolved) {
      throw new Error(`${account.broker} does not expose a cTrader symbol that matches ${displaySymbol}.`);
    }

    const period = TRENDBAR_PERIODS[interval];
    if (!period) {
      throw new Error(`cTrader does not support ${interval} trendbars in this chart flow yet.`);
    }

    const toTimestamp = options?.to ?? Date.now();
    const requestedCount = Math.max(3, Math.min(options?.count ?? 500, 50_000));
    const fromTimestamp =
      options?.from ??
      Math.max(0, toTimestamp - getIntervalMs(interval) * Math.max(requestedCount + 10, 50));

    const trendbarsMessage = await client.send(
      PAYLOAD.getTrendbarsReq,
      {
        ctidTraderAccountId: account.accountId,
        fromTimestamp,
        toTimestamp,
        period,
        symbolId: resolved.symbol.symbolId,
        count: requestedCount,
      },
      15_000,
    );

    const trendbars = (trendbarsMessage.payload?.trendbar as CTraderTrendbar[] | undefined) ?? [];
    return transformTrendbars(trendbars, resolved.symbol);
  });
}

export async function streamCTraderPricing(
  preferredBroker: string | undefined,
  displaySymbols: string[],
  tokenSet: CTraderTokenSet | undefined,
  callbacks: {
    onPrice: (price: { instrument: string; bid: number; ask: number; mid: number; spread: number; time: string; broker: string }) => void;
    onError: (error: Error) => void;
  },
) {
  const config = getConfig();
  const selectedAccount = resolveBrokerAccount(preferredBroker);
  let accessToken = await getAccessToken(tokenSet);
  const client = new CTraderJsonClient(CTRADER_JSON_ENDPOINTS[selectedAccount.environment ?? config.environment]);
  await client.open();

  try {
    await authoriseApplication(client);

    let accountListMessage: RawCTraderMessage;
    try {
      accountListMessage = await client.send(PAYLOAD.getAccountsByAccessTokenReq, { accessToken });
    } catch (error) {
      if (!isCTraderAccessTokenInvalidError(error)) throw error;
      accessToken = await forceRefreshAccessToken(tokenSet);
      accountListMessage = await client.send(PAYLOAD.getAccountsByAccessTokenReq, { accessToken });
    }
    const accounts = (accountListMessage.payload?.ctidTraderAccount as CTraderAccountSummary[] | undefined) ?? [];
    const linkedAccount = accounts.find(
      (account) =>
        Number(account.ctidTraderAccountId) === selectedAccount.accountId ||
        Number(account.traderLogin ?? -1) === selectedAccount.accountId,
    );

    if (!linkedAccount) {
      const scope = String(accountListMessage.payload?.permissionScope ?? "unknown");
      throw new Error(
        `${selectedAccount.broker} account ${selectedAccount.accountId} is not accessible with the current cTrader token (scope: ${scope}). Re-authorise the app and prefer "Account info and trading" scope.`,
      );
    }

    const ctidTraderAccountId = Number(linkedAccount.ctidTraderAccountId);

    await client.send(PAYLOAD.accountAuthReq, {
      ctidTraderAccountId,
      accessToken,
    });

    const resolvedSymbols = await getResolvedSymbols(client, ctidTraderAccountId, displaySymbols);
    const symbolById = new Map(resolvedSymbols.map((entry) => [Number(entry.symbol.symbolId), entry]));

    const unsubscribe = client.addEventListener((message) => {
      if (message.payloadType === PAYLOAD.errorRes) {
        callbacks.onError(new Error(String(message.payload?.description ?? "cTrader stream error.")));
        return;
      }

      if (message.payloadType !== PAYLOAD.spotEvent) return;
      const symbolId = Number(message.payload?.symbolId);
      const resolved = symbolById.get(symbolId);
      if (!resolved) return;
      const digits = resolved.symbol.digits ?? 5;
      const bid = priceFromRelative(Number(message.payload?.bid ?? 0), digits);
      const ask = priceFromRelative(Number(message.payload?.ask ?? 0), digits);
      if (!bid && !ask) return;

      callbacks.onPrice({
        instrument: resolved.displaySymbol,
        bid,
        ask,
        mid: roundToDigits((bid + ask) / 2, digits),
        spread: roundToDigits(ask - bid, digits),
        time: new Date(Number(message.payload?.timestamp ?? Date.now())).toISOString(),
        broker: selectedAccount.broker,
      });
    });

    await Promise.all(
        resolvedSymbols.map((entry) =>
          client.send(PAYLOAD.subscribeSpotsReq, {
            ctidTraderAccountId,
            symbolId: [entry.symbol.symbolId],
            subscribeToSpotTimestamp: true,
          }),
        ),
    );

    return () => {
      unsubscribe();
      client.close();
    };
  } catch (error) {
    client.close();
    throw error;
  }
}

