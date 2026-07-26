# =====================================================================================
# KHD-IT-SUP Frontend — Multi-stage Dockerfile (Angular + Nginx static serve)
# =====================================================================================

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

# ---- Stage 2: runtime (Nginx serving static build) ----
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80 >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
