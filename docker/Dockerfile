FROM node:24-bookworm-slim

# Build args — set to "true" to install each coding-agent CLI.
# Rebuild the image after changing these (docker compose build --no-cache).
ARG INSTALL_COPILOT=true
ARG INSTALL_CLAUDE=false
ARG INSTALL_GEMINI=false
ARG INSTALL_CURSOR=false
ARG INSTALL_OPENCODE=false
# Set to "true" to install Docker CLI + Compose plugin (needed for nested compose / target-repo E2E tasks).
ARG INSTALL_DOCKER_CLI=false

# Install git and other essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via Corepack (included with Node 24)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

# Install coding-agent CLIs based on build args.
# See docker/README.md for per-backend auth env vars and rebuild instructions.
RUN if [ "$INSTALL_COPILOT" = "true" ]; then npm install -g @github/copilot@1.0.51; fi
RUN if [ "$INSTALL_CLAUDE" = "true" ]; then npm install -g @anthropic-ai/claude-code; fi
RUN if [ "$INSTALL_GEMINI" = "true" ]; then npm install -g @google/gemini-cli; fi
RUN if [ "$INSTALL_CURSOR" = "true" ]; then \
    apt-get update && apt-get install -y --no-install-recommends curl \
    && curl -fsSL https://cursor.com/install | bash \
    && ln -sf /root/.local/bin/cursor-agent /usr/local/bin/cursor-agent \
    && ln -sf /root/.local/bin/agent /usr/local/bin/agent \
    && rm -rf /var/lib/apt/lists/*; \
fi
RUN if [ "$INSTALL_OPENCODE" = "true" ]; then \
    apt-get update && apt-get install -y --no-install-recommends curl \
    && curl -fsSL https://opencode.ai/install | bash \
    && ln -sf /root/.opencode/bin/opencode /usr/local/bin/opencode \
    && rm -rf /var/lib/apt/lists/*; \
fi

# Cursor CLI installs to ~/.local/bin; OpenCode installs to ~/.opencode/bin (root in this image).
ENV PATH="/root/.opencode/bin:/root/.local/bin:${PATH}"

# Install Docker CLI + Compose plugin when INSTALL_DOCKER_CLI=true.
# Required only when agents need to run `docker compose` inside the container
# (target-repo E2E / nested-compose tasks). See dockerMountSocket setting.
RUN if [ "$INSTALL_DOCKER_CLI" = "true" ]; then \
    apt-get update && apt-get install -y --no-install-recommends \
        apt-transport-https \
        gnupg \
        lsb-release \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
        https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*; \
fi
