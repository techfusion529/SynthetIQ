# ============================================================
# SynthetIQ Documentation Portal (Docusaurus)
# Multi-stage Docker build: Node.js builder + Nginx static server
# ============================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy full documentation source
COPY . .

# Environment variable to serve under /docs/ base URL
ENV DOCUSAURUS_BASE_URL=/docs/

# Build static bundle
RUN npm run build

# --- Stage 2: Production NGINX server ---
FROM nginx:alpine

# Remove default nginx site
RUN rm -rf /usr/share/nginx/html/*

# Copy built documentation static files to /docs subdirectory
COPY --from=builder /app/build /usr/share/nginx/html/docs

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/docs/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
