# Docker Agent Container — Setup Guide

Ralph can run coding agents **inside a Docker container** instead of on your host. The target repo is bind-mounted to `/workspace`, so file edits and git history stay on your machine—the container only provides the toolchain and agent CLI.

```
  Your machine                         Docker container (ralph-agent)
  ┌─────────────────┐                 ┌──────────────────────────────┐
  │  Ralph GUI      │  docker exec    │  copilot / claude / …        │
  │  (or start.sh)  │ ──────────────► │  node, pnpm, git             │
  └────────┬────────┘                 └──────────────┬───────────────┘
           │                                         │
           │         same files, same .git           │
           └─────────────────┬───────────────────────┘
                             ▼
                    /workspace  ←  your target repo
```

**Important:** Logins on your host (for example `copilot login`) do **not** carry into the container. You must pass API keys or tokens via `.env` (see Step 2).

---

## What you need before you start

- [Docker Desktop](https://docs.docker.com/get-docker/) or Docker Engine, with the **Compose plugin**, installed and **running**
- This repo (`ralph-gui`) cloned locally
- For **Copilot** (default): a GitHub account with **Copilot** access and a fine-grained token (Step 2)
- For **other agents**: the matching API key and an image that includes that CLI (Step 6, optional)

The bundled image already includes **git**, **Node 22**, **pnpm**, and **GitHub Copilot CLI** (`copilot`). Other backends require extra install steps.

---

## Step 1 — Start the container

From the **ralph-gui repo root** (where `docker-compose.agents.yml` lives):

```bash
docker compose -f docker-compose.agents.yml up -d
```

This builds (first time) and starts the `ralph-agent` service. It stays running in the background so Ralph can run `docker compose exec` when you enable Docker in Settings.

Check that it is up:

```bash
docker compose -f docker-compose.agents.yml ps
```

You should see `ralph-agent` with state **running**.

---

## Step 2 — Add authentication (`.env`)

Create a file named `.env` in the **ralph-gui repo root** (next to `docker-compose.agents.yml`):

```bash
cd /path/to/ralph-gui
touch .env
```

**Do not commit `.env`** — it is already in `.gitignore`.

### If you use GitHub Copilot (default backend)

This is the most common setup. The bundled image includes `copilot`; you only need a token in `.env`.

1. Open [Fine-grained personal access tokens → New](https://github.com/settings/personal-access-tokens/new).
2. **Resource owner:** select **your personal account** (not an organization).
3. **Repository access:** choose repos Ralph will work on (or “All repositories”).
4. Under **Permissions** → **Account** → **Add permissions** → select **Copilot Requests**.
5. Generate the token and copy it (starts with `github_pat_`).

Add one line to `.env`:

```env
COPILOT_GITHUB_TOKEN=github_pat_paste_your_token_here
```

`GH_TOKEN` and `GITHUB_TOKEN` also work, but `COPILOT_GITHUB_TOKEN` is clearest for Docker.

| Token | Works? |
|-------|--------|
| Fine-grained PAT with **Copilot Requests** (`github_pat_…`) | Yes — use this |
| OAuth from `copilot login` (`gho_…`) | Yes — paste into `.env` if you already logged in on the host |
| Classic PAT (`ghp_…`) | **No** — Copilot CLI rejects these |

You need an active **GitHub Copilot** subscription. If your org uses SAML SSO, authorize the token for that org after creating it.

Docs: [Authenticate Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli)

### If you use another backend

Add the matching line to the same `.env` file. You must also install that CLI in the image (see [Step 6 — Other agent backends](#step-6--other-agent-backends-optional)).

| Backend in Settings | Add to `.env` | Get the key from |
|-------------------|---------------|------------------|
| `claude` | `ANTHROPIC_API_KEY=sk-ant-...` | [console.anthropic.com](https://console.anthropic.com/) |
| `gemini` | `GEMINI_API_KEY=...` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `cursor-agent` | `CURSOR_API_KEY=...` | [Cursor Dashboard → Integrations](https://cursor.com/dashboard) |

Example `.env` with several backends (only set what you use):

```env
COPILOT_GITHUB_TOKEN=github_pat_...
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
# CURSOR_API_KEY=...

# Optional: name/email on agent commits
# GIT_AUTHOR_NAME=Ralph Agent
# GIT_AUTHOR_EMAIL=ralph@localhost
```

### Apply changes to the running container

Whenever you **create or edit** `.env`, recreate the container so it picks up new variables:

```bash
docker compose -f docker-compose.agents.yml up -d --force-recreate ralph-agent
```

---

## Step 3 — Turn on Docker in Ralph

1. Start Ralph (`./start.sh` or `npm run dev`) and open the UI (default `http://localhost:3001`).
2. Set **Repo root** to the project you want the agent to work in.
3. In **Settings** → **Docker Agents**:
   - Enable **Run agents in Docker**
   - Leave **Compose file** blank to use the bundled `docker-compose.agents.yml`
   - **Service name:** `ralph-agent` (default)
4. Click **Set Docker** to validate.

Ralph checks that Docker is running, the compose file resolves, and basic tools work inside the container (`node`, `pnpm`, `git`). If you use Copilot, it also checks that `copilot` is on PATH in the container.

---

## Step 4 — Run the loop

Start the epic loop as usual. Ralph runs plan / dev / QA by executing the agent CLI **inside** the container.

If authentication is missing, the **plan phase** often fails first with:

```text
No authentication information found
```

Fix: confirm `.env` has the right variable, run the **force-recreate** command from Step 2, click **Set Docker** again, and restart the loop.

---

## Step 5 — Optional: isolate agent commits on a branch

In **Settings** → **Docker Agents**, enable **Isolate on work branch** if you want agent commits on a separate branch:

1. At loop start, Ralph saves your current branch as **Epic base branch**.
2. It creates `ralph/epic-<slug>` for agent work.
3. When the epic is done, use **Merge work into epic branch** in the Docker section to merge back.

Host and container share the same `.git` directory, so branches and commits are visible on your machine immediately.

---

## Step 6 — Build the image for your backends

The bundled `docker/Dockerfile` uses **build args** to install only the CLIs you need:

| Build arg | Default | Installs |
|-----------|---------|---------|
| `INSTALL_COPILOT` | `true` | `@github/copilot` (pinned version) |
| `INSTALL_CLAUDE` | `false` | `@anthropic-ai/claude-code` |
| `INSTALL_GEMINI` | `false` | `@google/gemini-cli` |
| `INSTALL_CURSOR` | `false` | Cursor Agent (see note below) |
| `INSTALL_DOCKER_CLI` | `false` | Docker CLI + Compose v2 plugin (for nested compose) |

### Build examples

Set args in `.env` next to `docker-compose.agents.yml`, then rebuild:

```env
# .env
INSTALL_CLAUDE=true
INSTALL_GEMINI=false
INSTALL_DOCKER_CLI=false
```

```bash
# Rebuild image and recreate containers
docker compose -f docker-compose.agents.yml up -d --build --force-recreate
```

Or pass args inline:

```bash
INSTALL_CLAUDE=true docker compose -f docker-compose.agents.yml up -d --build
```

After rebuilding, click **Set Docker** in Ralph — it probes each CLI listed in `dockerInstalledBackends` and reports which ones are missing.

**Cursor note:** Cursor Agent may not be installable via a single `npm install`. If `INSTALL_CURSOR=true` fails, follow the [Cursor CLI installation docs](https://docs.cursor.com/more/cursor-agent-cli) and add the manual install steps to a custom Dockerfile that extends `ralph-agent`.

---

## Step 7 — Container pool (parallel agents)

Run more than one container to process multiple backlog tasks simultaneously.

### Enable the pool

In **Settings → Docker Agents**, set **Pool size** to `N` (default `1`, max `8`). Ralph scales the compose service automatically when you click **Set Docker** or start the loop.

Manual equivalent:

```bash
docker compose -f docker-compose.agents.yml up -d --scale ralph-agent=2
```

Verify N containers are running:

```bash
docker compose -f docker-compose.agents.yml ps
```

### Enable parallel tasks

Check **Run backlog tasks in parallel** in Settings (only available when Pool size > 1). When enabled:

- Ralph picks up to N backlog tasks at once.
- Each task runs in its own git worktree: `.ralph/worktrees/slot-0`, `.ralph/worktrees/slot-1`, …
- All files under `.ralph/worktrees/slot-N` are inside the same `.git` object store as the host repo.
- After completion, the worktree branch is merged back into the epic work branch automatically.
- All task-status writes are mutex-protected to prevent race conditions.

### Plan-phase parallel research (stretch)

Check **Parallel plan research** in Settings (also requires Pool size > 1). When enabled alongside a plan prompt template that emits `<research-prompt>...</research-prompt>` blocks, Ralph:

1. Runs the sequential plan phase as normal.
2. Parses any `<research-prompt>` blocks from the plan output.
3. Dispatches each block to a pool slot concurrently, each in its own worktree.
4. Aggregates the resulting task lists (JSON) from all sub-job outputs into the backlog.
5. Continues with the normal dev/QA loop against the enriched backlog.

Each research sub-job sends one additional LLM call. Enable this only if your plan prompt is adapted to produce `<research-prompt>` output; without those tags the setting has no effect.

### Resource considerations

N parallel agents multiply CPU, RAM, and API-token usage. A reasonable rule of thumb: start with `dockerPoolSize=2` and monitor system load before increasing.

### Requirements

Parallel container exec requires **Docker Compose plugin ≥ 2.24** (which supports `docker compose exec --index N`). Check your version:

```bash
docker compose version
```

---

## Step 8 — Nested Docker (target repo compose stacks)

Some tasks require the agent to run `docker compose` inside the target repo (for example, spinning up a Postgres + app stack and then running E2E tests). This requires mounting the host Docker socket into the agent container.

### Enable nested Docker

1. Build the image with Docker CLI support:

   ```env
   # .env
   INSTALL_DOCKER_CLI=true
   ```

   ```bash
   docker compose -f docker-compose.agents.yml up -d --build --force-recreate
   ```

2. In **Settings → Docker Agents**, enable **Allow agents to run Docker in the target repo**.

3. Click **Set Docker** — Ralph will run `docker info` and `docker compose version` inside the container to confirm they work.

### How it works

When the setting is on, `docker-compose.agents.yml` mounts the host socket:

```yaml
volumes:
  - ${DOCKER_SOCKET:-/var/run/docker.sock}:/var/run/docker.sock
```

The agent container then uses `DOCKER_HOST=unix:///var/run/docker.sock` to talk to the host daemon.

Ralph injects context into dev/QA prompts so the agent knows it can run `docker compose` against files under `/workspace`.

### Security warning

Mounting the host socket gives the agent **effective host-level Docker control**. The agent can create, start, and stop any container on the host. **Never enable this in multi-tenant or untrusted environments.** Default is off.

### Troubleshooting nested Docker

| Symptom | Fix |
|---------|-----|
| `docker info` fails inside agent | Ensure `INSTALL_DOCKER_CLI=true` and the image was rebuilt |
| `permission denied /var/run/docker.sock` | Add the container user to the `docker` group, or run compose with `user: root` |
| Task blocked "cannot create containers" | Enable **Allow agents to run Docker** or run Ralph with `useDocker: false` on the host |
| Locked-down CI (no socket, no cgroup rights) | Task stays blocked — run on a Docker-capable runner |

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| `No authentication information found` | `.env` in **ralph-gui root** with `COPILOT_GITHUB_TOKEN` (fine-grained PAT + Copilot Requests). Recreate container after editing `.env`. |
| `copilot exited with code 1` (auth) | Not using classic `ghp_` PAT; token is on your **user**, not org-only PAT without Copilot permission. |
| Container not running | `docker compose -f docker-compose.agents.yml ps` — run `up -d` or `up -d --force-recreate ralph-agent`. |
| Docker daemon errors | Start Docker Desktop or `sudo systemctl start docker`. |
| Wrong CLI in container | Rebuild after Dockerfile changes: `INSTALL_CLAUDE=true docker compose -f ... up -d --build --force-recreate`. |
| Host login does not help | `copilot login` on the host does not authenticate the container — use `.env`. |
| Pool not scaling | Check `docker compose ps` — some containers may be stopped; run `up -d --scale N` manually then **Set Docker** again. |
| `--index` flag unsupported | Upgrade Docker Compose plugin: `docker compose version` should be ≥ 2.24. |
| Exec lands on wrong index | Compose assigns `--index` in container-start order; remove and recreate the pool if indices drift. |
| Worktree already exists | Run `git worktree remove .ralph/worktrees/slot-N` (or `--force`) from the target repo, then restart the loop. |
| Parallel task file conflicts | Two slots modified the same file; Ralph's merge-back will stop at the conflict; resolve manually with `git mergetool`. |

Verify auth inside the container (replace the variable name if needed):

```bash
docker compose -f docker-compose.agents.yml exec -T ralph-agent sh -lc \
  'test -n "$COPILOT_GITHUB_TOKEN" && echo "token is set" || echo "token missing"'
```

---

## Reference — environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `COPILOT_GITHUB_TOKEN` | Copilot | Preferred GitHub token for Docker |
| `GH_TOKEN` / `GITHUB_TOKEN` | Copilot | Alternatives (same CLI) |
| `ANTHROPIC_API_KEY` | Claude | Anthropic API |
| `GEMINI_API_KEY` | Gemini | Google AI Studio |
| `CURSOR_API_KEY` | Cursor Agent | Cursor API key |
| `CURSOR_SESSION_TOKEN` | Cursor Agent | Session token (if required by Cursor) |
| `DOCKER_SOCKET` | Nested Docker | Host socket path (default `/var/run/docker.sock`) |
| `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` | git commits | Optional override (defaults in compose) |
| `GIT_COMMITTER_NAME` / `GIT_COMMITTER_EMAIL` | git commits | Optional override |

Compose also forwards `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, and `GITHUB_TOKEN` from your **shell** when you run `docker compose up`, if you prefer `export` over `.env`.

---

## Advanced — custom images and compose

### Mount your git config

For the same user.name/email as your laptop, add to a compose override:

```yaml
services:
  ralph-agent:
    volumes:
      - ~/.gitconfig:/root/.gitconfig:ro
```

### Per-repo compose override

```yaml
services:
  ralph-agent:
    build:
      context: /absolute/path/to/your/docker
```

Set **Compose file** in Ralph Settings to that file (relative to target repo root or absolute).

---

## Quick checklist (Copilot + Docker)

- [ ] Docker installed and daemon running
- [ ] `docker compose -f docker-compose.agents.yml up -d` from ralph-gui root
- [ ] `ralph-gui/.env` with `COPILOT_GITHUB_TOKEN=github_pat_...` (Copilot Requests permission)
- [ ] `up -d --force-recreate ralph-agent` after any `.env` change
- [ ] Ralph Settings: **Run agents in Docker** on, **Set Docker** succeeds
- [ ] *(Optional)* Set **Pool size** > 1 and rebuild with required `INSTALL_*` args for additional CLIs
- [ ] *(Optional)* Build with `INSTALL_DOCKER_CLI=true` and enable **Allow agents to run Docker** for nested compose
- [ ] Start loop

For a shorter summary in the main project README, see [Docker Agent Execution](../README.md#docker-agent-execution).
