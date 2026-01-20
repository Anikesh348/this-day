# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json yarn.lock ./

# Allow yarn to resolve correctly for Linux/ARM
RUN yarn install --network-timeout 100000

COPY . .

ENV EXPO_NO_TELEMETRY=1
ENV NODE_ENV=production

RUN npx expo export --platform web

# ---------- Runtime ----------
FROM nginx:1.25-alpine

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]
