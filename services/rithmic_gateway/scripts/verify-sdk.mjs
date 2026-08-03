import { loadConfig } from "../src/config.mjs";
import { loadProtocol } from "../src/protocol.mjs";

const config = loadConfig();
const protocol = loadProtocol(config.protoDir);
const request = protocol.encode("RequestRithmicSystemInfo", {
  templateId: 16,
  userMsg: ["kwantify-sdk-verification"],
});
if (!request.length) throw new Error("The Rithmic SDK encoded an empty request.");
process.stdout.write(
  `${JSON.stringify(
    {
      protoDir: config.protoDir,
      templateId: protocol.templateId(request),
      encodedBytes: request.length,
    },
    null,
    2,
  )}\n`,
);
