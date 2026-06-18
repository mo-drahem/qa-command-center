# syntax=docker/dockerfile:1

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend/ ./backend/
COPY examples/ ./examples/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV QA_CENTER_CONFIG_PATH=/etc/qa-command-center/config.yaml

EXPOSE 4000
CMD ["node", "backend/src/index.js"]
