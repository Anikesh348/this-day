# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile

# Copy everything else
COPY . .

# Ensure the app is exported for web specifically
# The --platform web flag is key here
RUN npx expo export --platform web

# ---------- Runtime ----------
FROM nginx:1.25-alpine
# Remove default Nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Expo exports to the /dist folder by default in newer versions
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]