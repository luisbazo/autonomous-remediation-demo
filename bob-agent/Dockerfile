FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Fix permissions for OpenShift (runs as random UID)
# Instana needs to write precompiled native modules at runtime
RUN chgrp -R 0 /app && \
    chmod -R g=u /app && \
    chmod -R g+w /app/node_modules

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/index.js"]