# Dockerize Express App with Node.js port 3001 
# Version 1.0
# Austin Hunt

# Base image
FROM node:latest 

# Create app directory
WORKDIR /usr/src/app 

COPY . .

RUN npm install

# Bundle app source

COPY . .

# Expose port 5000

EXPOSE 5000  

CMD [ "node", "server.js" ]
