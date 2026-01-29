# --- STAGE 1: Base Setup ---
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Mengaktifkan pnpm bawaan Node.js (Corepack)
RUN corepack enable
WORKDIR /app

# --- STAGE 2: Install Production Dependencies ---
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
# --prod artinya hanya install dependencies (bukan devDependencies)
# --frozen-lockfile menjamin versi sama persis dengan lockfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# --- STAGE 3: Build Application ---
FROM base AS build
COPY package.json pnpm-lock.yaml ./
# Install SEMUA deps (termasuk devDependencies) untuk keperluan build (tsc)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
# Compile TypeScript ke JavaScript (ke folder dist)
RUN pnpm run build

# --- STAGE 4: Production Image (Final) ---
FROM base
# Copy node_modules bersih (tanpa devDependencies) dari stage prod-deps
COPY --from=prod-deps /app/node_modules /app/node_modules
# Copy hasil build dari stage build
COPY --from=build /app/dist /app/dist
# Copy package.json (penting untuk script start jika dipakai)
COPY package.json ./

# Buat folder auth agar permission-nya benar saat dimount volume
RUN mkdir -p /app/auth_info_baileys

EXPOSE 3001

# Jalankan langsung node untuk performa maksimal di production
CMD [ "node", "dist/server.js" ]