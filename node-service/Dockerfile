# node-service/Dockerfile
FROM node:18-alpine AS build
WORKDIR /usr/src/app

# Copy only package files first to leverage Docker's layer caching
COPY package*.json ./
RUN npm install

# Now copy the rest of the code
COPY . .

# Expose port (the one you use in server.js—assume 3001 here)
EXPOSE 3001

# Define the command to start your server
CMD ["npm", "start"]
