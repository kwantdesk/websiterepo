const [owner, repository, base, head] = process.argv.slice(2);
const safePart = /^[A-Za-z0-9_.-]+$/;
const safeSha = /^[a-f0-9]{7,64}$/i;

if (!safePart.test(owner || "") || !safePart.test(repository || "") ||
    !safeSha.test(base || "") || !safeSha.test(head || "")) {
  process.stderr.write("Invalid GitHub comparison coordinates.\n");
  process.exit(2);
}

const endpoint = `https://api.github.com/repos/${owner}/${repository}/compare/${base}...${head}?per_page=100`;
const response = await fetch(endpoint, {
  headers: {
    Accept: "application/vnd.github+json",
    "User-Agent": "KwantDesk-Vercel-Build-Gate",
    "X-GitHub-Api-Version": "2022-11-28",
  },
});

if (!response.ok) {
  process.stderr.write(`GitHub comparison failed (${response.status}).\n`);
  process.exit(2);
}

const comparison = await response.json();
if (!Array.isArray(comparison.files) || comparison.files.length >= 300) {
  // GitHub caps compare file lists at 300. At the cap we cannot prove that a
  // shipped file was not omitted, so force a real build.
  process.stderr.write("GitHub comparison was missing or truncated.\n");
  process.exit(2);
}

const files = comparison.files.map((file) => file?.filename);
if (files.some((file) => typeof file !== "string" || file.length === 0)) {
  process.stderr.write("GitHub comparison contained an invalid file entry.\n");
  process.exit(2);
}

process.stdout.write(files.join("\n"));
