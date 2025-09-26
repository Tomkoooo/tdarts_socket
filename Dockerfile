FROM node:20-alpine3.20
EXPOSE 3000/tcp
WORKDIR /
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache curl
COPY package.json ./
COPY package-lock.json ./
RUN npm install --f
COPY . .
HEALTHCHECK CMD curl -I --fail http://localhost:3000 || exit 1
ENTRYPOINT npm run socket-server