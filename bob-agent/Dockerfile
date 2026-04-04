FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/index.js"]