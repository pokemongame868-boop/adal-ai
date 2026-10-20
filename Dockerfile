FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
