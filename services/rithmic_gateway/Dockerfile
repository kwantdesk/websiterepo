FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# The vendor edge uses the operating-system trust store for outbound HTTPS.
# bookworm-slim does not guarantee that store is present, which left Rithmic
# healthy while every KwantData/Databento proxy request failed at TLS setup.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY vendor/proto ./vendor/proto

EXPOSE 8793
CMD ["node", "src/server.mjs"]
