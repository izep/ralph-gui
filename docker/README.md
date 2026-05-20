# Docker Agent Container

Ralph can run coding agents inside a Docker container. The container shares the
target repository via a bind-mount so all file edits happen on the host working
tree and in the same `.git` index.

## Prerequisites

- Docker Desktop or Docker Engine + Compose plugin installed and running
- The agent CLI you want to use installed inside the container (see below)

## Build and start the container

```bash
# From the ralph-gui repo root
docker compose -f docker-compose.agents.yml up -d
```

The `ralph-agent` service will start and stay running. Ralph connects to it via
`docker compose exec` when `useDocker` is enabled in Settings.

## Installing agent CLIs in the container

The bundled `Dockerfile` installs **git**, **Node 22**, **npm**, and **pnpm**.
Agent CLIs must be added on top. Options:

### Option A — extend the Dockerfile

Add a layer to `docker/Dockerfile` (or a custom Dockerfile pointed to by
`dockerComposeFile`):

```dockerfile
# GitHub Copilot CLI
RUN npm install -g @github/copilot-cli

# Anthropic Claude CLI
RUN npm install -g @anthropic-ai/claude-cli

# Google Gemini CLI
RUN npm install -g @google/gemini-cli
```

### Option B — per-repo override compose file

Create a `docker-compose.agents.override.yml` in your target repo:

```yaml
services:
  ralph-agent:
    build:
      context: /absolute/path/to/custom/docker
```

Then set `dockerComposeFile` in Settings (relative to repo root).

## Authentication env vars

Agent CLIs need auth tokens. Pass them via a `.env` file in the **ralph-gui
repo root** (it is loaded by `env_file` in the compose file, which is optional):

```env
# GitHub Copilot
GITHUB_TOKEN=ghp_...

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
GOOGLE_API_KEY=...
```

**Do not commit `.env` to version control.**

## Git identity in the container

The container sets default git identity via compose `environment`:

```
GIT_AUTHOR_NAME=Ralph Agent
GIT_AUTHOR_EMAIL=ralph@localhost
```

Override by setting these variables in your shell or `.env` file before
`docker compose up`.

Optionally mount your `~/.gitconfig` read-only for identical git behavior:

```yaml
# in your override compose file
services:
  ralph-agent:
    volumes:
      - ~/.gitconfig:/root/.gitconfig:ro
```

## Branch workflow

When `useDocker` + `dockerIsolateBranch` is enabled in Settings, Ralph:

1. Records the current branch as **Epic Base Branch** at loop start.
2. Creates a work branch `ralph/epic-<slug>` from the base branch.
3. All agent commits land on the work branch (shared `.git`, bind-mounted).
4. After the epic is complete, click **Merge work into epic branch** in the
   Docker section of the Settings panel to merge into the base branch.

## Validate your setup

Click **Set Docker** in Settings → Docker section. Ralph will:
1. Check Docker daemon is running.
2. Verify the compose file resolves.
3. Run `node -v`, `pnpm -v`, `git --version` inside the container.
