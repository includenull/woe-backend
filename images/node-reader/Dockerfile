FROM node:24-bookworm-slim
RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json biome.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-contracts/package.json packages/api-contracts/package.json

RUN pnpm install --frozen-lockfile --store-dir /pnpm/store

RUN groupadd --system waxonedge && useradd --system --gid waxonedge --home-dir /home/waxonedge --create-home waxonedge
USER waxonedge

CMD ["node"]
