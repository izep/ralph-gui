# Headless exit POC

Prove that Ralph **stops and the process exits** when the loop has no remaining work.

This experiment is not a product epic. The stub agent always returns `<status>complete</status>`.

## Run

From the ralph-gui repo root (does not use a real Copilot login):

```bash
npm run poc:headless-exit
```

or:

```bash
node scripts/poc-headless-exit.mjs
```

Expect the server to print `Loop ended (epic-complete)` and exit 0 within a few seconds. A hang past 20s is a failure.
