FROM node:22-alpine as base

RUN apk update
RUN apk upgrade
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json .
RUN npm install

COPY . .

CMD ["npm", "start"]
