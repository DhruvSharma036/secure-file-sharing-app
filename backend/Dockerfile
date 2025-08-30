
FROM node:18-alpine


WORKDIR /usr/src/app


COPY package*.json ./


RUN npm install

# Step 5: Copy the rest of your backend source code into the container
COPY . .

# Step 6: Expose the port your server runs on
# This tells Docker that the container will be listening on port 5001.
EXPOSE 5001

# Step 7: Define the command to start your server
# This is the command that will be run when the container starts.
CMD [ "npm", "start" ]