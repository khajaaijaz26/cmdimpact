# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG PUBLIC_SITE_URL
ARG PUBLIC_SPONSOR_NAME
ARG PUBLIC_SPONSOR_TEXT
ARG PUBLIC_SPONSOR_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL \
	PUBLIC_SPONSOR_NAME=$PUBLIC_SPONSOR_NAME \
	PUBLIC_SPONSOR_TEXT=$PUBLIC_SPONSOR_TEXT \
	PUBLIC_SPONSOR_URL=$PUBLIC_SPONSOR_URL
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS terminal
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		build-essential ca-certificates curl file gh git jq less nano openssh-client \
		pipx procps python3 python3-venv ripgrep rsync unzip util-linux zip \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd --gid 10002 terminal \
	&& useradd --uid 10002 --gid terminal --create-home --home-dir /home/terminal --shell /bin/bash terminal
WORKDIR /app
COPY --from=build --chown=terminal:terminal /app/package.json /app/package-lock.json ./
COPY --from=build --chown=terminal:terminal /app/node_modules ./node_modules
COPY --chown=root:root server ./server
COPY --chown=root:root scripts/verify-container.mjs ./scripts/verify-container.mjs
RUN mkdir -p /app/.data /workspace \
	&& chown root:root /app/.data \
	&& chmod 0700 /app/.data \
	&& chown terminal:terminal /workspace \
	&& chmod 0711 /workspace
ENV NODE_ENV=production \
	TERMINAL_HOST=0.0.0.0 \
	TERMINAL_PORT=8787 \
	TERMINAL_WORKSPACE=/workspace \
	TERMINAL_STATE_FILE=/app/.data/sessions.json \
	TERMINAL_PTY_UID=10002 \
	TERMINAL_PTY_GID=10002 \
	PIPX_HOME=/workspace/.local/pipx \
	PIPX_BIN_DIR=/workspace/.local/bin
USER root
EXPOSE 8787
CMD ["node", "server/index.mjs"]

FROM caddy:2.10-alpine AS web
RUN setcap -r /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 4321
