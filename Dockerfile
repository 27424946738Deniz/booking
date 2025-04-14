FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy prisma schema and generate client
COPY src/config/prisma ./src/config/prisma/
RUN npx prisma generate

# Copy application code
COPY . .

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["node", "src/index.js"] 