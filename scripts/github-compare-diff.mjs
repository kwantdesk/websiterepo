const [base, head] = process.argv.slice(2);
const sha = /^[a-f0-9]{7,64}$/i;

if (!sha.test(base || "") || !sha.test(head || "")) {
  process.stderr.write("Invalid comparison revisions.\n");
  process.exit(2);
}

const response = await fetch(
  `https://github.com/kwantdesk/websiterepo/compare/${base}...${head}.diff`,
  { headers: { "Accept-Encoding": "identity", "User-Agent": "KwantDesk-Vercel-Build-Gate" } },
);
if (!response.ok) {
  process.stderr.write(`Public comparison failed (${response.status}).\n`);
  process.exit(2);
}

const bytes = new Uint8Array(await response.arrayBuffer());
const body = new TextDecoder().decode(bytes);
const declaredLength = Number(response.headers.get("content-length"));
if (!body || body.length > 5_000_000 ||
    (Number.isFinite(declaredLength) && declaredLength > 0 && bytes.byteLength !== declaredLength)) {
  process.stderr.write("Public comparison was empty, oversized or truncated.\n");
  process.exit(2);
}

const files = new Set();
let sections = 0;
for (const line of body.split("\n")) {
  if (!line.startsWith("diff --git ")) continue;
  sections += 1;
  const match = /^diff --git a\/(\S+) b\/(\S+)$/.exec(line.trimEnd());
  if (!match) {
    process.stderr.write("Public comparison used an ambiguous path encoding.\n");
    process.exit(2);
  }
  files.add(match[1]);
  files.add(match[2]);
}

if (sections === 0 || files.size === 0) {
  process.stderr.write("Public comparison contained no file sections.\n");
  process.exit(2);
}

process.stdout.write([...files].join("\n"));
