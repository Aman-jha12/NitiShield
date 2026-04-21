FROM node:20-bookworm-slim AS base
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY server/package.json ./server/

RUN npm ci --omit=dev

COPY server ./server

RUN npx prisma generate && npx tsc -p server/tsconfig.json

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && exec node server/dist/index.js"]
