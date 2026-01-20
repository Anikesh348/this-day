# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .
RUN npx expo export --platform web

# ---------- Runtime ----------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3001
