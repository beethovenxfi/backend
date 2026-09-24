# Build with bun (matches the lockfile), run with node (matches package.json "start").
FROM oven/bun:1-debian AS build
WORKDIR /app

COPY package.json bun.lockb ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

COPY . .
RUN bunx prisma generate && bun run build

# production node_modules only (keeps prisma CLI, needed by the pre-deploy migrate command)
RUN rm -rf node_modules && bun install --frozen-lockfile --production && bunx prisma generate

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

EXPOSE 4000
CMD ["node", "dist/apps/main.js"]
