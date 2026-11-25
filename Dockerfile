FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation python3 python3-pip python3-pil tesseract-ocr \
    ffmpeg ca-certificates curl git \
 && pip3 install --no-cache-dir --break-system-packages edge-tts pypdf \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY config ./config
COPY src ./src
COPY scripts ./scripts
COPY site ./site
COPY web ./web
COPY docs ./docs
COPY tests ./tests
COPY docker ./docker

# O worker de melhoria precisa de um repositório local para branch/commit/merge.
RUN git init -q && git config user.email "myn@local" && git config user.name "Myn Worker" \
    && git add -A && git commit -qm "base do container" && git branch -M master \
    && useradd -m -u 10001 myn && mkdir -p /data && chown -R myn:myn /app /data

ENV MYN_DADOS=/data \
    MYN_GATEWAY_TOKEN_FILE=/tmp/myn-recyla-token.txt \
    PORTA=36877 \
    CHROME=/usr/bin/chromium \
    MYN_HOST=0.0.0.0 \
    TTL=1800000 \
    NODE_ENV=production

USER myn
VOLUME ["/data"]
EXPOSE 5188 36877

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORTA}/api/saude" || exit 1

CMD ["bash", "/app/docker/entrypoint.sh"]
