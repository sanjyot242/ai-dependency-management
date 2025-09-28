# Use Node.js 18 Alpine for a lightweight image
FROM node:18-alpine AS build

# Set the working directory
WORKDIR /usr/src/app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire project
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose the port (same as before)
EXPOSE 3001

# Start the server using the compiled JavaScript file
CMD ["node", "dist/server.js"]
