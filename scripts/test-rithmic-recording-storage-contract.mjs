import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const compose = readFileSync(
  new URL("../services/rithmic_gateway/deploy/docker-compose.yml", import.meta.url),
  "utf8",
);
const bootstrap = readFileSync(
  new URL("../services/rithmic_gateway/deploy/bootstrap-vm.sh", import.meta.url),
  "utf8",
);
const dockerDropIn = readFileSync(
  new URL(
    "../services/rithmic_gateway/deploy/docker.service.d/kwantdesk-recordings.conf",
    import.meta.url,
  ),
  "utf8",
);

assert.match(
  compose,
  /^\s*- \/srv\/kwantdesk-recordings:\/recordings\s*$/m,
  "the gateway must record on the dedicated host-mounted volume",
);
assert.doesNotMatch(
  compose,
  /^\s*- recordings:\/recordings\s*$/m,
  "the root-disk Docker volume must not return",
);
assert.match(
  bootstrap,
  /mountpoint -q "\$RECORDINGS_HOST_DIR"/,
  "bootstrap must fail closed when the recording disk is not mounted",
);
assert.match(
  bootstrap,
  /\[ ! -w "\$RECORDINGS_HOST_DIR" \]/,
  "bootstrap must reject an unwritable recording disk",
);
assert.match(
  dockerDropIn,
  /^RequiresMountsFor=\/srv\/kwantdesk-recordings$/m,
  "Docker must wait for the dedicated recording filesystem after reboot",
);

console.log("Rithmic recording storage contract: 5/5 passed");
