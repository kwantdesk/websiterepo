import { loadConfig } from "../src/config.mjs";
import { discoverRithmicSystems } from "../src/rithmic-client.mjs";

const config = loadConfig();
const systems = await discoverRithmicSystems(config);
process.stdout.write(`${JSON.stringify({ url: config.url, systems }, null, 2)}\n`);
