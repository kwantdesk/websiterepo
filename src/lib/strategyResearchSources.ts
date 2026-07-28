export type StrategyResearchSourcePack = {
  id: string;
  label: string;
  aliases: string[];
  officialDomains: string[];
  officialUrls: string[];
  requiredChecks: string[];
  searchQueries: string[];
};

export type StrategyResearchFetchResult = {
  label: string;
  fetchedAt: string;
  sources: Array<{
    url: string;
    ok: boolean;
    title?: string;
    excerpt?: string;
    error?: string;
  }>;
};

const propFirmSourcePacks: StrategyResearchSourcePack[] = [
  {
    id: "ftmo",
    label: "FTMO",
    aliases: ["ftmo"],
    officialDomains: ["ftmo.com"],
    officialUrls: [
      "https://ftmo.com/en/how-it-works/",
      "https://ftmo.com/en/trading-objectives/",
      "https://ftmo.com/en/faq/",
    ],
    requiredChecks: [
      "account size and account currency",
      "maximum daily loss rule",
      "maximum loss rule",
      "minimum trading days or activity requirements",
      "profit target or evaluation objective if applicable",
      "news trading restrictions",
      "overnight/weekend holding restrictions",
      "EA/algorithmic trading, VPS, copy trading, and signal rules",
      "instrument availability and contract/specification caveats for XAUUSD",
      "cost assumptions for spread, commission, slippage, and swap/financing",
    ],
    searchQueries: [
      "site:ftmo.com FTMO trading objectives maximum daily loss maximum loss",
      "site:ftmo.com FTMO FAQ expert advisor algorithmic trading copy trading VPS",
      "site:ftmo.com FTMO news trading overnight weekend holding rules",
      "site:ftmo.com FTMO XAUUSD specifications spread commission swap",
    ],
  },
  {
    id: "tradeify",
    label: "Tradeify",
    aliases: ["tradeify"],
    officialDomains: ["help.tradeify.co", "tradeify.co"],
    officialUrls: ["https://help.tradeify.co/"],
    requiredChecks: [
      "account type and drawdown model",
      "profit target",
      "daily loss limit if applicable",
      "maximum drawdown",
      "consistency and payout rules",
      "automation, copy trading, and data/execution restrictions",
    ],
    searchQueries: [
      "site:help.tradeify.co Tradeify rules drawdown profit target consistency payout",
      "site:help.tradeify.co Tradeify automated trading copy trading rules",
    ],
  },
];

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const noisySourcePatterns = [
  /document\.body/i,
  /window\.addEventListener/i,
  /classlist/i,
  /keydown/i,
  /hoveredItem/i,
  /activeItem/i,
  /menuOpen/i,
  /focus\(\)/i,
  /@blur/i,
  /@keydown/i,
  /x-data/i,
  /function\s*\(/i,
  /const\s+\w+/i,
  /=>/,
];

function cleanOfficialExcerpt(text: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+|\s{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 40 && item.length < 500)
    .filter((item) => !noisySourcePatterns.some((pattern) => pattern.test(item)));

  return sentences.slice(0, 8).join(" ").slice(0, 1800);
}

function extractTitle(html: string) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
}

function findMatchingPacks(text: string) {
  const lower = text.toLowerCase();
  return propFirmSourcePacks.filter((pack) => pack.aliases.some((alias) => lower.includes(alias)));
}

export async function fetchStrategyResearchSources(text: string): Promise<StrategyResearchFetchResult | null> {
  const matches = findMatchingPacks(text);
  if (!matches.length) return null;

  const sources: StrategyResearchFetchResult["sources"] = [];
  for (const pack of matches) {
    for (const url of pack.officialUrls.slice(0, 4)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, {
          headers: {
            "User-Agent": "KwantifyResearchBot/1.0; strategy research source verification",
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const body = await response.text();
        const title = extractTitle(body);
        const textBody = cleanOfficialExcerpt(stripHtml(body));
        sources.push({
          url,
          ok: response.ok,
          title,
          excerpt: textBody.slice(0, 1800),
          error: response.ok ? undefined : `HTTP ${response.status}`,
        });
      } catch (error) {
        sources.push({
          url,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    label: matches.map((pack) => pack.label).join(", "),
    fetchedAt: new Date().toISOString(),
    sources,
  };
}

export function formatFetchedResearchSources(result: StrategyResearchFetchResult | null) {
  if (!result) return "No direct official source fetch was needed.";

  return [
    `Direct official source fetch: ${result.label}`,
    `Fetched at: ${result.fetchedAt}`,
    ...result.sources.map((source, index) =>
      [
        `Source ${index + 1}: ${source.url}`,
        `Status: ${source.ok ? "ok" : "failed"}`,
        source.title ? `Title: ${source.title}` : null,
        source.error ? `Error: ${source.error}` : null,
        source.excerpt ? `Excerpt: ${source.excerpt}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
}

export function buildStrategyResearchSourceContext(text: string) {
  const matches = findMatchingPacks(text);

  if (!matches.length) {
    return {
      needsCurrentSources: false,
      allowedDomains: [] as string[],
      prompt: "No curated source pack matched. If current external facts are required, prefer official primary sources.",
    };
  }

  const allowedDomains = Array.from(new Set(matches.flatMap((pack) => pack.officialDomains)));
  const lines = matches.flatMap((pack) => [
    `Source pack: ${pack.label}`,
    `Official domains: ${pack.officialDomains.join(", ")}`,
    `Official URLs to prefer: ${pack.officialUrls.join(" | ")}`,
    `Required checks: ${pack.requiredChecks.join("; ")}`,
    `Suggested searches: ${pack.searchQueries.join(" | ")}`,
  ]);

  return {
    needsCurrentSources: true,
    allowedDomains,
    prompt: lines.join("\n"),
  };
}
