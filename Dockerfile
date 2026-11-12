# LendLab production image (Lab 5, Issue #24).
#
# One image: Express serves the API and the built React app on $PORT (3000).
# Cloud Run, CI and docker compose all run this same image. The migration job
# runs `prisma migrate deploy` and the seed from it too, so prisma/ and the
# seed's tooling are kept in the runtime stage.
#
# No secret is baked in: DATABASE_URL and DEMO_USER_PASSWORD are injected at
# run time (docker compose env, or Secret Manager on Cloud Run).
#
# Build from the repository root:  docker build -t lendlab .

# ---------------------------------------------------------------------------
# Stage 1: install all workspace dependencies and build server + client
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

# Manifests first, so `npm ci` stays cached until dependencies change.
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY server/ server/
COPY client/ client/
# Empty API URL: the browser calls the API on the same origin (same container).
ENV VITE_API_URL=""
RUN npx --workspace server prisma generate && npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package.json /app/package-lock.json ./
# Full node_modules (with the generated Prisma client): the migration job needs
# the prisma CLI and tsx for the seed.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/server/tsconfig.json ./server/tsconfig.json
# app.ts serves ../../client/dist relative to server/dist.
COPY --from=build /app/client/dist ./client/dist

WORKDIR /app/server
EXPOSE 3000
# Run as the unprivileged user that the node image provides.
USER node
# Exec form: node is PID 1 and receives SIGTERM from Cloud Run directly.
CMD ["node", "dist/index.js"]
