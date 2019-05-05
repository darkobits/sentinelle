# Declare args.
ARG NODE_VERSION=10.14.1
ARG TINI_VERSION=0.18.0

FROM ubuntu:19.04 as base

# Re-import args.
ARG TINI_VERSION
ARG NODE_VERSION

# Create labels indicating versions of Node/Tini used.
LABEL NODE_VERSION=${NODE_VERSION}
LABEL TINI_VERSION=${TINI_VERSION}

RUN apt-get update && apt-get install --yes curl

# Download Tini.
RUN curl --silent --fail --location --output /bin/tini https://github.com/krallin/tini/releases/download/v$TINI_VERSION/tini && chmod +x /bin/tini

# Download and install Node.
RUN curl --silent --fail https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz | tar --gunzip --extract --strip-components=1 --directory=/usr/local

# Create / move to Sentinelle install path.
WORKDIR /usr/local/lib/node_modules/@darkobits/sentinelle

# Copy manifests and build artifacts into image.
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY dist dist

# Install production dependencies.
RUN npm ci --production --skip-optional --ignore-scripts

# Symlink Sentinelle into PATH.
RUN ln -s /usr/local/lib/node_modules/@darkobits/sentinelle/dist/bin/cli.js /usr/local/bin/sentinelle

# Set an environment variable we can use to determine when we're in Docker.
ENV IS_DOCKER true

WORKDIR /

# Set the container's entrypoint to Tini, which will run Node, which will run
# Sentinelle. It's important we only use ENTRYPOINT here and not CMD, or any
# arguments the user provides via `docker run` will be treated as a replacement
# for CMD, which we don't want.
ENTRYPOINT ["tini", "--", "sentinelle"]
