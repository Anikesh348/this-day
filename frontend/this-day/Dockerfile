# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files first (better layer caching)
COPY package.json yarn.lock ./

# Install dependencies with frozen lockfile and cache mount
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --network-timeout 100000

# Copy nginx config early (rarely changes)
COPY nginx.conf ./nginx.conf

# Copy env file
COPY .env .env

# Copy source files (changes most frequently)
COPY . .

ENV EXPO_NO_TELEMETRY=1
ENV NODE_ENV=production

# Build with cache for Expo/Metro bundler
RUN --mount=type=cache,target=/app/.expo \
    --mount=type=cache,target=/app/node_modules/.cache \
    npx expo export --platform web

# ---------- Runtime ----------
FROM nginx:1.25-alpine

# Use specific version for reproducibility
RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]