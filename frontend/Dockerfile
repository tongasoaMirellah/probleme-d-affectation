FROM node:22-alpine@sha256:a98e6fda54fdbb22d4238054cca9a2a113bcd1191c09193a535aae22f400aa8e AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci 

COPY . .
RUN npm run build

FROM nginx:1.30.6-alpine-slim@sha256:4c41e2d0a3a55b325ed572cd0200bdb72af1433c3daa2bca6ef8eea68ce504a2
COPY --from=builder  /app/dist /usr/share/nginx/html

EXPOSE 80
CMD [ "nginx", "-g", "daemon off;"]