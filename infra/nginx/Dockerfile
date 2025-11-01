########################################
# 1) Build the dashboard frontend with Vite.
#    Produces the dashboard static bundle.
########################################
FROM node:20-alpine AS build-dashboard

# Install dependencies and build from the repository root.
WORKDIR /app

# Copy root dependency manifests first for Docker layer caching.
COPY package.json package-lock.json ./

# Install dependencies required for the dashboard build.
RUN npm ci --legacy-peer-deps

# Copy the dashboard sources and plugin widgets the build references.
COPY front/apps/dashboard front/apps/dashboard
COPY front/apps/plugins front/apps/plugins

# Produce the static dashboard bundle under /app/front/apps/dashboard/dist.
RUN npm run build


########################################
# 2) Build the collector SDK with Rollup.
#    Produces the collector bundle served via nginx.
########################################
FROM node:20-alpine AS build-collector

WORKDIR /app/collector

# Copy package metadata to install dependencies.
COPY front/apps/collector-js/package.json ./
COPY front/apps/collector-js/package-lock.json ./

# Install dependencies for the collector SDK.
RUN npm ci --legacy-peer-deps

# Copy the collector source tree and configuration files.
COPY front/apps/collector-js ./

# Run the Rollup build to populate /app/collector/dist.
RUN npm run build


########################################
# 3) Assemble the runtime nginx image.
#    Serves the dashboard and collector assets.
########################################
FROM nginx:alpine AS runtime

# Prepare the public directories that host static assets.
RUN mkdir -p /usr/share/nginx/html \
    && mkdir -p /usr/share/nginx/html/apilog \
    && rm /etc/nginx/conf.d/default.conf

# Copy the dashboard SPA into the nginx html root.
COPY --from=build-dashboard /app/front/apps/dashboard/dist /usr/share/nginx/html

# Copy the collector bundle under /apilog for script tag delivery.
COPY --from=build-collector /app/collector/dist /usr/share/nginx/html/apilog

# Provide the custom nginx configuration tailored to the project.
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf

# Expose port 80 for downstream services.
EXPOSE 80

# nginx:alpine default CMD remains (nginx -g 'daemon off;')
