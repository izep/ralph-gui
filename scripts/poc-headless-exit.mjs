#!/usr/bin/env node
/**
 * POC: headless Ralph must exit when the loop finishes (stub Copilot, no LLM).
 *
 * Usage (from ralph-gui root): node scripts/poc-headless-exit.mjs
 */
import { spawn } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stub = path.join(root, "scripts/poc-copilot-stub.sh");
const repo = path.join(root, "experiments/headless-exit");
const tsx = path.join(root, "node_modules/.bin/tsx");
const timeoutMs = 20_000;

if (!existsSync(stub) || !existsSync(repo) || !existsSync(tsx)) {
  console.error("POC missing stub, experiment, or tsx. Run from ralph-gui after npm install.");
  process.exit(1);
}

chmodSync(stub, 0o755);

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      server.close((err) => (err ? reject(err) : resolve(String(port))));
    });
    server.on("error", reject);
  });
}

const port = await getFreePort();

const child = spawn(
  tsx,
  [
    path.join(root, "src/server/index.ts"),
    "--repo",
    repo,
    "--start",
    "--exit-when-complete",
    "--agent-backend",
    "copilot",
    "--use-docker",
    "false",
    "--min-backlog-size",
    "0",
    "--max-llm-calls",
    "5",
    "--port",
    port,
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      COPILOT_BIN: stub,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  stdout += text;
  process.stdout.write(text);
});
child.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  stderr += text;
  process.stderr.write(text);
});

const timer = setTimeout(() => {
  console.error(`\nPOC FAILED: still running after ${timeoutMs / 1000}s (errant loop / zombie server).`);
  child.kill("SIGKILL");
  process.exit(1);
}, timeoutMs);

child.on("exit", (code, signal) => {
  clearTimeout(timer);
  const log = `${stdout}\n${stderr}`;
  const ended = log.includes("Loop ended (epic-complete)") || log.includes("epic-complete");
  if (code === 0 && ended) {
    console.log("POC PASSED: loop finished its work and the process exited.");
    process.exit(0);
  }
  console.error(
    `\nPOC FAILED: exit=${code} signal=${signal ?? ""} (expected 0 and epic-complete in logs).`,
  );
  process.exit(1);
});
