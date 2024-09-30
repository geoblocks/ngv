FROM debian:bookworm-slim AS builder


WORKDIR /app

RUN apt-get update && apt-get -y install --no-install-recommends \
  npm

COPY package.json package-lock.json /app/
RUN npm ci

COPY . /app/
RUN npm run build # && npm run doc

FROM nginxinc/nginx-unprivileged:1.27-bookworm-perl AS server

LABEL org.opencontainers.image.source = "https://github.com/geoblocks/ngv"

COPY --from=builder /app/dist /usr/share/nginx/html

# The nginx.conf.template file is used to configure the nginx server.
# In the entrypoint, the environment variables are automatically replaced.
# See docs for more information: https://hub.docker.com/_/nginx
COPY docker/*.conf.template /etc/nginx/templates/

# Hooks for the entrypoint
# env files are executed, envsh files are sources
COPY docker/*.envsh docker/*.sh /docker-entrypoint.d/
