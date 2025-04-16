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
    
    # Install necessary dependencies for Chromium and ChromeDriver
    RUN apt-get update && apt-get install -y --no-install-recommends \
        wget \
        # Needed for Chromium / Headless mode
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libgdk-pixbuf2.0-0 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        xdg-utils \
        # Install openssl 1.1 for Prisma
        openssl libssl1.1 \
        # Install Chromium and ChromeDriver from Debian repo
        chromium \
        chromium-driver \
        && \
        # Clean up
        apt-get clean && \
        rm -rf /var/lib/apt/lists/*

    # Set PATH for ChromeDriver (chromium-driver package should put it in PATH already, but being explicit)
    ENV PATH /usr/bin:$PATH

    # Copy from builder
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package*.json ./*
    COPY --from=builder /app/src ./src
    COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
    
    # Set environment variables
    ENV NODE_ENV=production
    
    EXPOSE 80

    # Run the application
    CMD ["node", "src/index.js"]
    