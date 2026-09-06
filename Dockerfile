# Multi-stage Dockerfile for Routed MCP Server
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/adapters/package*.json ./packages/adapters/
COPY packages/cli/package*.json ./packages/cli/

RUN npm install

COPY . .

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/adapters/dist ./packages/adapters/dist
COPY --from=builder /app/packages/adapters/package.json ./packages/adapters/package.json
COPY --from=builder /app/packages/cli/dist ./packages/cli/dist
COPY --from=builder /app/packages/cli/bin ./packages/cli/bin
COPY --from=builder /app/packages/cli/package.json ./packages/cli/package.json
COPY --from=builder /app/node_modules ./node_modules

ENTRYPOINT ["node", "packages/cli/bin/routed.js", "mcp"]
