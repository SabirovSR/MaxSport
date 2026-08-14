# syntax=docker/dockerfile:1

FROM node:22-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY apps/mini-app/package.json ./apps/mini-app/
COPY packages ./packages

RUN npm ci
COPY . .
RUN npm run build

FROM build AS prod-deps
ENV HUSKY=0
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/mini-app/dist ./apps/mini-app/dist
COPY deploy/migrations ./deploy/migrations
COPY deploy/seeds ./deploy/seeds
COPY --from=prod-deps /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "apps/api/dist/server.js"]
