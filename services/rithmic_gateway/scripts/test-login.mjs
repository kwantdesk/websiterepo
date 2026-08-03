import { loadConfig } from "../src/config.mjs";
import { RithmicMarketDataClient } from "../src/rithmic-client.mjs";

const config = loadConfig();
if (!config.configured) {
  throw new Error("RITHMIC_USER and RITHMIC_PASSWORD must be set locally.");
}

const client = new RithmicMarketDataClient(config);
client.on("gatewayError", () => {
  // The sanitized health result below owns diagnostic output.
});

try {
  await client.start();
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const health = client.health();
  process.stdout.write(
    `${JSON.stringify(
      {
        provider: health.provider,
        environment: health.environment,
        connected: health.connected,
        authenticated: health.authenticated,
        infraType: health.infraType,
        discoveredSystems: health.discoveredSystems,
        subscriptions: health.subscriptions,
        instruments: health.instruments,
        templateCounts: health.templateCounts,
        subscriptionResponses: health.subscriptionResponses,
        lastMessageAt: health.lastMessageAt,
        lastError: health.lastError,
      },
      null,
      2,
    )}\n`,
  );
  if (!health.authenticated) process.exitCode = 1;
} finally {
  await client.stop();
}
