FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY server ./server

RUN npm ci \
  && npx prisma generate \
  && npx tsc -p server/tsconfig.json \
  && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=4000
ENV UPLOAD_DIR=/app/uploads

RUN mkdir -p /app/uploads

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && exec node server/dist/index.js"]
