# ---------- Builder Stage ----------
    FROM node:18-buster AS builder

    WORKDIR /app
    
    # Install openssl 1.1 for Prisma
    RUN apt-get update && \
        apt-get install -y openssl libssl1.1 ca-certificates && \
        apt-get clean && rm -rf /var/lib/apt/lists/*
    
    # Copy package files and install dependencies
    COPY package*.json ./
    RUN npm install --only=production
    
    # Copy prisma schema and generate client
    COPY src/config/prisma ./src/config/prisma/
    RUN npx prisma generate
    
    # Copy application code
    COPY . .
    
    # ---------- Production Stage ----------
    FROM node:18-buster
    
    WORKDIR /app
    
    # Install libssl1.1 again for production runtime
    RUN apt-get update && \
        apt-get install -y openssl libssl1.1 ca-certificates && \
        apt-get clean && rm -rf /var/lib/apt/lists/*
    
    # Copy from builder
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package*.json ./
    COPY --from=builder /app/src ./src
    COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
    
    # Set environment variables
    ENV NODE_ENV=production
    
    # Run the application
    CMD ["node", "src/index.js"]
    