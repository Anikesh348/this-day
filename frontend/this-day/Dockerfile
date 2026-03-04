# ---------- Build ----------
FROM node:20-bookworm-slim AS build
ARG APP_ENV=prod
ARG EXPORT_MODE=prod
ARG EXPO_MAX_WORKERS=2
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --prefer-offline

# Copy everything else
COPY . .

# Select env file at build time (dev/prod)
RUN if [ -f ".env.${APP_ENV}" ]; then cp ".env.${APP_ENV}" .env; fi

RUN if [ "${EXPORT_MODE}" = "dev" ]; then \
      ./node_modules/.bin/expo export --platform web --dev --no-minify --no-bytecode --max-workers "${EXPO_MAX_WORKERS}"; \
    else \
      ./node_modules/.bin/expo export --platform web --max-workers "${EXPO_MAX_WORKERS}"; \
    fi

# ---------- Runtime ----------
FROM nginx:1.25-alpine
ARG APP_ENV=prod
ENV APP_ENV=${APP_ENV}
# Remove default Nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Expo exports to the /dist folder by default in newer versions
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]
