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
        # Prerequisites
        wget \
        gnupg \
        ca-certificates \
        unzip \
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
        # --- REMOVED OLD DEBIAN PACKAGES ---
        # chromium \
        # chromium-driver \
        && \
        # --- Add Google Chrome GPG key using modern method --- 
        wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome-keyring.gpg && \
        # --- Add Google Chrome repo referencing the key ---
        echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
        # --- Install Google Chrome --- 
        apt-get update && \
        apt-get install -y google-chrome-stable --no-install-recommends && \
        # --- INSTALL LATEST CHROMEDRIVER (using LATEST_RELEASE endpoint) --- 
        CHROME_MAJOR_VERSION=$(google-chrome --version | cut -f 3 -d ' ' | cut -d '.' -f 1) && \
        CHROMEDRIVER_VERSION=$(wget -qO- https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_MAJOR_VERSION}) && \
        echo "Installed Chrome major version: ${CHROME_MAJOR_VERSION}" && \
        echo "Attempting to download Chromedriver version: ${CHROMEDRIVER_VERSION}" && \
        wget -q --continue -P /tmp "https://chromedriver.storage.googleapis.com/${CHROMEDRIVER_VERSION}/chromedriver_linux64.zip" && \
        unzip /tmp/chromedriver_linux64.zip -d /usr/local/bin && \
        # Handle case where unzip creates a directory vs direct binary
        if [ -f /usr/local/bin/chromedriver ]; then echo 'Chromedriver unzipped directly.'; else mv /usr/local/bin/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver && rm -rf /usr/local/bin/chromedriver-linux64; fi && \
        rm /tmp/chromedriver_linux64.zip && \
        chmod +x /usr/local/bin/chromedriver && \
        # --- CLEANUP --- 
        apt-get purge -y --auto-remove wget unzip gnupg && \
        apt-get clean && \
        rm -rf /var/lib/apt/lists/* /etc/apt/sources.list.d/google-chrome.list /usr/share/keyrings/google-chrome-keyring.gpg

    # Set PATH for ChromeDriver (should be in /usr/local/bin now)
    # ENV PATH /usr/bin:$PATH # Keep default PATH which should include /usr/local/bin

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
    