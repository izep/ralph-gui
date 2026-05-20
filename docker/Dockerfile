FROM node:22-bookworm-slim

# Install git and other essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via Corepack (included with Node 22)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

# Agent CLIs (copilot, cursor-agent, claude, gemini) are not preinstalled.
# Install the CLI for your chosen agentBackend as an additional layer or
# by extending this Dockerfile. Example for GitHub Copilot CLI:
#   RUN npm install -g @github/copilot-cli
# See docker/README.md for full instructions and auth env vars.
