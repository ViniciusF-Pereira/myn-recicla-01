FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation python3 python3-pip python3-pil tesseract-ocr \
    ffmpeg ca-certificates curl \
 && pip3 install --no-cache-dir --break-system-packages edge-tts pypdf \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY config ./config
COPY src ./src
COPY scripts ./scripts
COPY site ./site
COPY docker ./docker

ENV MYN_DADOS=/data \
    MYN_GATEWAY_TOKEN_FILE=/tmp/myn-recyla-token.txt \
    PORTA=36877 \
    CHROME=/usr/bin/chromium \
    MYN_HOST=0.0.0.0 \
    TTL=1800000 \
    NODE_ENV=production

VOLUME ["/data"]
EXPOSE 5188 36877

CMD ["bash", "/app/docker/entrypoint.sh"]
