FROM node:16-alpine
WORKDIR /usr/src/app
COPY . .
ARG TOKEN
RUN npm install pm2 -g
RUN npm install
CMD ["npm", "run", "start"]