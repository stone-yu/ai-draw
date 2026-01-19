# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Install pnpm
RUN npm install -g pnpm && pnpm config set registry https://registry.npmmirror.com/

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --registry=https://registry.npmmirror.com/

# Copy source code
COPY . .

# Build frontend
RUN pnpm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Install pnpm
RUN npm install -g pnpm && pnpm config set registry https://registry.npmmirror.com/

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only (including express for server)
RUN pnpm install --prod --registry=https://registry.npmmirror.com/ && pnpm rebuild sqlite3

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy server code
COPY --from=builder /app/server ./server

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Environment variables
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV NODE_ENV=production

# Start server
CMD ["node", "server/index.js"]

