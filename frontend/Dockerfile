# --- STAGE 1: Build the React App ---
    FROM node:18-alpine as build

    WORKDIR /app
    
    # Copy dependency manifests
    COPY package*.json ./
    
    # Install dependencies
    RUN npm install
    
    # Copy the rest of the frontend source code
    COPY . .
    
    # Run the build script defined in package.json
    # This creates a 'build' folder with all the static assets.
    RUN npm run build
    
    
    # --- STAGE 2: Serve the App with Nginx ---
    FROM nginx:stable-alpine
    
    # Copy the static files from the 'build' stage into the Nginx web server directory
    COPY --from=build /app/build /usr/share/nginx/html
    
    # Copy your custom Nginx configuration file
    # This is needed to make sure a single-page application works correctly.
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    
    # Expose the default web port
    EXPOSE 80
    
    # The command to start the Nginx server
    CMD ["nginx", "-g", "daemon off;"]
    
    