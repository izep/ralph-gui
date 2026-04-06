#!/usr/bin/env node
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const experimentsDir = path.join(repoRoot, "experiments");

const REQ_CANDIDATES = [
  "requirements.md",
  "REQUIREMENTS.md",
  "Requirements.md",
  "docs/requirements.md",
  "docs/REQUIREMENTS.md",
];

async function hasRequirements(expPath) {
  for (const f of REQ_CANDIDATES) {
    try {
      const st = await stat(path.join(expPath, f));
      if (st.isFile()) {
        return true;
      }
    } catch {
      /* next */
    }
  }
  return false;
}

function usage(slugs) {
  const list =
    slugs.length > 0
      ? slugs.map((s) => `  ${s}`).join("\n")
      : "  (none — add experiments/<slug>/requirements.md)";
  console.error(`Starts Ralph Kanban with --repo set to <ralph-gui>/experiments/<slug> (absolute path).

Usage: npm run exp -- <slug> [start.sh args...]

Examples:
  npm run exp -- todo
  npm run exp -- todo --start

Experiments (folders here with a requirements file):
${list}
`);
}

async function listSlugs() {
  if (!existsSync(experimentsDir)) {
    return [];
  }
  const names = await readdir(experimentsDir);
  const slugs = [];
  for (const name of names) {
    if (name.startsWith(".")) {
      continue;
    }
    const expPath = path.join(experimentsDir, name);
    try {
      const st = await stat(expPath);
      if (st.isDirectory() && (await hasRequirements(expPath))) {
        slugs.push(name);
      }
    } catch {
      /* skip */
    }
  }
  slugs.sort();
  return slugs;
}

const extraArgs = process.argv.slice(3);
const slug = process.argv[2];
const slugs = await listSlugs();

if (!slug) {
  usage(slugs);
  process.exit(1);
}

if (!slugs.includes(slug)) {
  console.error(`Unknown experiment "${slug}".\n`);
  usage(slugs);
  process.exit(1);
}

const startSh = path.join(repoRoot, "start.sh");
const child = spawn("bash", [startSh, "exp", slug, ...extraArgs], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 1);
});
