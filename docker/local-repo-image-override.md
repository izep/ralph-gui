# Local repo Docker image override — Tutorial

Use this guide when the **bundled** Ralph agent image (`ralph-gui/docker-compose.agents.yml`) is not enough for your **target repository**. Typical reasons:

- The project needs extra OS packages, language runtimes, or databases clients in the agent container
- You want a **pinned, repo-specific** toolchain (for example a particular Node or Python version)
- The team already maintains a `docker/` folder in the target repo and you want Ralph to use it

Ralph supports this through **Settings → Docker Agents → Compose file**: point at a `docker-compose` file **inside the target repo** (or an absolute path). Ralph still bind-mounts that repo to `/workspace`; only the **container image and compose stack** change.

```
  ralph-gui (orchestrator)              Target repo (your project)
  ┌────────────────────┐               ┌─────────────────────────────┐
  │  Ralph GUI / loop  │               │  docker-compose.agents.yml  │  ← override
  │  resolveComposeFile│─── -f ───────►│  docker/Dockerfile          │
  └─────────┬──────────┘               │  .env (auth keys)           │
            │                          └──────────────┬──────────────┘
            │  docker compose exec                     │
            │  cwd = repo root                         │  build + up
            │  RALPH_REPO_ROOT = repo path             ▼
            └──────────────────────────────►  ralph-agent container
                                              /workspace ← same repo files
```

The main setup guide ([README.md](README.md)) covers the default bundled image. This document is only for **per-repo overrides**.

---

## What you need before you start

- Completed the default Docker flow at least once ([Step 1–3 in README.md](README.md#step-1--start-the-container))
- **Repo root** in Ralph set to the project you want agents to edit
- Docker Desktop or Docker Engine with the **Compose plugin** running
- A clear idea of what to add to the image (extra CLIs, apt packages, etc.)

---

## Step 1 — Choose an approach

| Approach | Best when | Trade-off |
|----------|-----------|-----------|
| **A. Copy and customize** | You want full control; the target repo owns the Dockerfile | Duplicate `docker/` assets from ralph-gui; you maintain them |
| **B. Extend the bundled Dockerfile** | Small additions (one apt package, extra npm global) | Build context must reach ralph-gui’s `docker/` folder (path or copy) |
| **C. Pre-built image tag** | CI already publishes `myorg/ralph-agent:…` | Fast startup; no local build unless you change the tag |

Most teams use **A**: copy `docker-compose.agents.yml` and `docker/Dockerfile` from ralph-gui into the target repo, then edit.

---

## Step 2 — Add compose + Dockerfile to the target repo

From your **target repository root** (not ralph-gui):

```bash
mkdir -p docker
```

### Option A — Copy the bundled files

From the ralph-gui checkout:

```bash
cp /path/to/ralph-gui/docker-compose.agents.yml .
cp /path/to/ralph-gui/docker/Dockerfile docker/
```

Edit `docker/Dockerfile` for your project (extra `RUN apt-get …`, different `INSTALL_*` defaults, etc.).

### Option B — Minimal override compose

Create `docker-compose.agents.yml` in the target repo root:

```yaml
services:
  ralph-agent:
    build:
      context: ./docker
      args:
        INSTALL_COPILOT: ${INSTALL_COPILOT:-true}
        INSTALL_CLAUDE: ${INSTALL_CLAUDE:-false}
        INSTALL_GEMINI: ${INSTALL_GEMINI:-false}
        INSTALL_CURSOR: ${INSTALL_CURSOR:-false}
        INSTALL_DOCKER_CLI: ${INSTALL_DOCKER_CLI:-false}
    command: ["sleep", "infinity"]
    working_dir: /workspace
    volumes:
      - ${RALPH_REPO_ROOT:-.}:/workspace
    environment:
      - GIT_AUTHOR_NAME=${GIT_AUTHOR_NAME:-Ralph Agent}
      - GIT_AUTHOR_EMAIL=${GIT_AUTHOR_EMAIL:-ralph@localhost}
      - GIT_COMMITTER_NAME=${GIT_COMMITTER_NAME:-Ralph Agent}
      - GIT_COMMITTER_EMAIL=${GIT_COMMITTER_EMAIL:-ralph@localhost}
      - COPILOT_GITHUB_TOKEN=${COPILOT_GITHUB_TOKEN:-}
      - GH_TOKEN=${GH_TOKEN:-}
      - GITHUB_TOKEN=${GITHUB_TOKEN:-}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
      - CURSOR_API_KEY=${CURSOR_API_KEY:-}
      - CURSOR_SESSION_TOKEN=${CURSOR_SESSION_TOKEN:-}
    env_file:
      - path: .env
        required: false
    restart: "no"
```

Use a `docker/Dockerfile` that matches the contract in [Step 3](#step-3--image-contract-ralph-agent-service).

### Option C — Use a published image (no local build)

```yaml
services:
  ralph-agent:
    image: ghcr.io/your-org/your-ralph-agent:1.2.0
    command: ["sleep", "infinity"]
    working_dir: /workspace
    volumes:
      - ${RALPH_REPO_ROOT:-.}:/workspace
    # … same environment / env_file as above
```

Build and push that image in CI from the same Dockerfile you would use locally.

---

## Step 3 — Image contract (`ralph-agent` service)

Ralph does not run an arbitrary container. The compose service must satisfy:

| Requirement | Why |
|-------------|-----|
| Service name matches **Service name** in Settings (default `ralph-agent`) | `docker compose exec` targets this service |
| `command: ["sleep", "infinity"]` (or equivalent long-running process) | Container stays up between agent turns |
| `working_dir: /workspace` | Matches exec `-w /workspace` in Ralph |
| Volume `${RALPH_REPO_ROOT:-.}:/workspace` | Ralph sets `RALPH_REPO_ROOT` to the **target repo path** when starting compose |
| `node`, `pnpm`, and `git` on PATH | Validated on **Set Docker** |
| Agent CLI on PATH for your backend | e.g. `copilot`, `claude`, `gemini`, or `cursor-agent` — see [README.md — Step 6](README.md#step-6--build-the-image-for-your-backends) |
| Auth env vars forwarded (or `.env` beside the compose file) | Same variables as the bundled compose |

Optional but common:

- **`INSTALL_*` build args** — same names as [docker/Dockerfile](Dockerfile) if you copied it
- **Docker socket mount** — only if you enable **Allow agents to run Docker** in Settings; see [README.md — Step 8](README.md#step-8--nested-docker-target-repo-compose-stacks)

### Example: project-specific Dockerfile layer

`docker/Dockerfile` in the target repo — start from the ralph-gui template and add packages:

```dockerfile
FROM node:22-bookworm-slim

ARG INSTALL_COPILOT=true
ARG INSTALL_CLAUDE=false
ARG INSTALL_GEMINI=false
ARG INSTALL_CURSOR=false
ARG INSTALL_DOCKER_CLI=false

RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates \
    # --- your project extras ---
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

RUN if [ "$INSTALL_COPILOT" = "true" ]; then npm install -g @github/copilot@1.0.51; fi
RUN if [ "$INSTALL_CLAUDE" = "true" ]; then npm install -g @anthropic-ai/claude-code; fi
RUN if [ "$INSTALL_GEMINI" = "true" ]; then npm install -g @google/gemini-cli; fi

# … INSTALL_DOCKER_CLI block if needed (copy from bundled Dockerfile)
```

Rebuild after any Dockerfile change:

```bash
docker compose -f docker-compose.agents.yml up -d --build --force-recreate ralph-agent
```

(Run from the **target repo root**.)

---

## Step 4 — Put authentication in the right `.env`

| Compose file location | Where to put `.env` |
|-----------------------|---------------------|
| Bundled (blank **Compose file** in Settings) | `ralph-gui/.env` next to `docker-compose.agents.yml` |
| **Override** in target repo | Target repo root `.env` next to **your** `docker-compose.agents.yml` |

Example target repo `.env`:

```env
COPILOT_GITHUB_TOKEN=github_pat_...
INSTALL_CLAUDE=false
```

After editing `.env`:

```bash
docker compose -f docker-compose.agents.yml up -d --force-recreate ralph-agent
```

Token types and backend keys: [README.md — Step 2](README.md#step-2--add-authentication-env).

---

## Step 5 — Point Ralph at the override

1. Set **Repo root** to the target repository.
2. **Settings → Docker Agents**:
   - Enable **Run agents in Docker**
   - **Compose file:** `docker-compose.agents.yml` (relative to repo root)  
     Or an absolute path, e.g. `/home/you/projects/my-app/docker-compose.agents.yml`
   - **Service name:** `ralph-agent` unless you renamed the service
3. **Save Settings**, then click **Set Docker**.

Ralph resolves relative paths against **repo root**, not ralph-gui:

```text
dockerComposeFile: "docker-compose.agents.yml"
repoRoot:          "/home/you/my-app"
→ compose file:    "/home/you/my-app/docker-compose.agents.yml"
```

Headless equivalent:

```bash
./start.sh /path/to/my-app \
  --use-docker true \
  --docker-compose docker-compose.agents.yml \
  --docker-service ralph-agent
```

---

## Step 6 — Validate before running the loop

### In Ralph

Click **Set Docker**. Ralph will:

1. Check Docker on the host
2. Run `docker compose -f <your file> up -d --build` with `cwd` = target repo and `RALPH_REPO_ROOT` set
3. Exec into the container and verify `node`, `pnpm`, `git`, and your active agent CLI

### On the command line (same repo root)

```bash
export RALPH_REPO_ROOT="$(pwd)"
docker compose -f docker-compose.agents.yml up -d --build
docker compose -f docker-compose.agents.yml ps
docker compose -f docker-compose.agents.yml exec -T ralph-agent node -v
docker compose -f docker-compose.agents.yml exec -T ralph-agent sh -lc 'command -v copilot && copilot --version'
```

If **Set Docker** fails, read the log panel message, then check container logs:

```bash
docker compose -f docker-compose.agents.yml logs --tail 50 ralph-agent
```

---

## Step 7 — Pool size and parallel tasks (override compose)

If you use **Pool size** > 1, your override compose must support scaling the same service name:

```bash
docker compose -f docker-compose.agents.yml up -d --scale ralph-agent=2 --build
```

Requirements:

- Compose file defines a single scalable service (no fixed `container_name` that blocks scale)
- Compose plugin **≥ 2.24** for `exec --index N`

See [README.md — Step 7](README.md#step-7--container-pool-parallel-agents).

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Build context not found | `build.context` is relative to the **compose file’s directory**; use `./docker` if Dockerfile is in `repo/docker/` |
| Wrong repo mounted in `/workspace` | Volume must use `${RALPH_REPO_ROOT:-.}:/workspace`; manual `docker compose up` without `RALPH_REPO_ROOT` mounts `.` (compose project dir) |
| Auth works in ralph-gui but not override | `.env` must live next to **your** compose file in the target repo, not only in ralph-gui |
| Set Docker can’t find CLI | Rebuild with correct `INSTALL_*` args; probe with `exec … sh -lc 'command -v copilot'` |
| Ralph still uses bundled image | **Compose file** must be saved; blank = bundled `ralph-gui/docker-compose.agents.yml` |
| Compose file not found | Path is relative to **repo root**; confirm file exists: `ls docker-compose.agents.yml` |
| Pool / `--index` errors | Upgrade Compose; ensure scale works manually before enabling parallel tasks |

---

## Quick checklist (per-repo override)

- [ ] `docker-compose.agents.yml` and `docker/Dockerfile` (or `image:` tag) in target repo
- [ ] Service named `ralph-agent`, `sleep infinity`, `/workspace` mount with `RALPH_REPO_ROOT`
- [ ] Target repo `.env` with tokens / `INSTALL_*` build args
- [ ] `docker compose -f docker-compose.agents.yml up -d --build` succeeds from repo root
- [ ] Ralph **Repo root** = target repo; **Compose file** = override path; **Set Docker** OK
- [ ] Start epic loop

---

## Reference — bundled vs override

| | Bundled (default) | Local repo override |
|--|-------------------|---------------------|
| Compose file | `ralph-gui/docker-compose.agents.yml` | Your path under repo root (or absolute) |
| Dockerfile | `ralph-gui/docker/Dockerfile` | `your-repo/docker/Dockerfile` (typical) |
| `.env` for auth | `ralph-gui/.env` | `your-repo/.env` |
| **Compose file** in Settings | *(blank)* | e.g. `docker-compose.agents.yml` |
| `docker compose` cwd | Target **repo root** | Target **repo root** |

Implementation detail: `resolveComposeFile()` in Ralph uses the ralph-gui package root only when the setting is empty; otherwise it joins the setting with **repo root** or uses an absolute path.

---

Back to the main guide: [Docker Agent Container — Setup Guide](README.md).
