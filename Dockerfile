# Stage 1: Build the frontend and install dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json tsconfig.json vite.config.ts index.html ./
RUN npm ci

# Copy source files and build
COPY src/ ./src
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine
WORKDIR /app

# Set default production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy runtime dependencies and server files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY server.ts tsconfig.json ./

# Expose port
EXPOSE 3000

# Run the TypeScript-based Express server using tsx
CMD ["npx", "tsx", "server.ts"]
