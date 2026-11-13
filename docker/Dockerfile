FROM node:20-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY scripts/vendor.mjs scripts/vendor.mjs
COPY scripts/bundles scripts/bundles
COPY assets assets
RUN node scripts/vendor.mjs

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    AUTEUR_HOST=0.0.0.0 AUTEUR_PORT=8800 AUTEUR_DATA=/data \
    CHROME_PATH=/usr/bin/chromium RENDERER_AUTOSTART=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium ffmpeg curl git ca-certificates fonts-noto-color-emoji fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
COPY --from=web /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=web /app/node_modules node_modules
COPY package.json run.py release.json ./
COPY server server
COPY renderer renderer
COPY skills skills
COPY templates templates
RUN git clone --depth 1 https://github.com/kajisho5/ffmpeg-skill engines/ffmpeg-skill && rm -rf engines/ffmpeg-skill/.git
COPY web/index.html web/index.html
COPY web/app web/app
COPY web/runtime web/runtime
COPY --from=web /app/web/vendor web/vendor
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /data
VOLUME ["/data"]
EXPOSE 8800
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD curl -fs http://127.0.0.1:8800/api/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
