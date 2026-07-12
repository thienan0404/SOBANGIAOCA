FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @a25/api db:generate && pnpm build
CMD ["pnpm","--filter","@a25/api","start:prod"]
