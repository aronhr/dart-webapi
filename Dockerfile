# Builds the frontend (dart-webapp, passed in as the `webapp` build context) and serves it from the API.
FROM node:22-alpine AS web
WORKDIR /web
COPY --from=webapp package.json package-lock.json ./
RUN npm install --no-audit --no-fund --ignore-scripts
COPY --from=webapp . .
RUN npx nuxt prepare && npx nuxt generate

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
COPY --from=web /web/.output/public ./public
ENV NODE_ENV=production
CMD ["node", "src/app.js"]
