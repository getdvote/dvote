# dvote API container (Railway, Google Cloud Run, Fly, ...). Build from this folder: apps/api
# Settings come from the host's environment (see .env.production.example); none are baked in.

# ---- build: install everything, generate the Prisma client, compile ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
# npm ci runs the postinstall "prisma generate" (needs the schema copied above)
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- run: only what production needs ----
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# static pages served by the API (/legal/terms.html …)
COPY --from=build /app/public ./public
USER node
# the host sets PORT (Railway, Cloud Run); 3000 otherwise
EXPOSE 3000
CMD ["node", "dist/main"]
