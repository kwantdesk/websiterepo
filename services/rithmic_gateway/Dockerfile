FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY vendor/proto ./vendor/proto

EXPOSE 8793
CMD ["node", "src/server.mjs"]
