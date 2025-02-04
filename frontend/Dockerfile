# frontend/Dockerfile

# --- Stage 1: Build the Vite project ---
    FROM node:18-alpine AS build
    WORKDIR /usr/src/app
    
    COPY package*.json ./
    RUN npm install
    
    COPY . .
    # This will create a production-ready build in /usr/src/app/dist
    RUN npm run build
    
    # --- Stage 2: Serve with Nginx ---
    FROM nginx:alpine
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    # Copy the built files from the previous stage
    COPY --from=build /usr/src/app/dist /usr/share/nginx/html
    
    # Expose port 80
    EXPOSE 80
    
    CMD ["nginx", "-g", "daemon off;"]
    