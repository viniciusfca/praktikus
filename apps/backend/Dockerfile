FROM node:20-alpine AS base
RUN npm install -g pnpm@8.15.4

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend
COPY tsconfig.base.json ./
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm --filter @praktikus/shared build
RUN pnpm --filter backend build
RUN pnpm --filter backend deploy --prod /app/deploy

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/deploy ./
COPY --from=builder /app/packages/shared/dist ./node_modules/@praktikus/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@praktikus/shared/package.json
EXPOSE 3000
CMD ["node", "dist/src/main"]
