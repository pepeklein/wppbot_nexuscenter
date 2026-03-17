# Use a Node image that includes all necessary dependencies for Puppeteer
FROM node:20-bullseye-slim

# Install necessary system dependencies for Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Set environment to production
ENV NODE_ENV=production

# The bot doesn't need to expose a port, but Railway likes it for health checks
EXPOSE 3000

# Run the bot
CMD [ "npm", "start" ]
