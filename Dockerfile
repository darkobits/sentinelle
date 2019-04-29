# Declare args.
ARG NODE_VERSION=10.14.1
ARG TINI_VERSION=0.18.0

FROM ubuntu:19.04 as base

# Re-import args.
ARG TINI_VERSION
ARG NODE_VERSION

RUN apt-get update && apt-get install --yes curl

# Download Tini.
RUN curl --silent --fail --location --output /bin/tini https://github.com/krallin/tini/releases/download/v$TINI_VERSION/tini && chmod +x /bin/tini

# Download and install Node.
RUN mkdir /nodejs
RUN curl --silent --fail https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz | tar --gunzip --extract --strip-components=1 --directory=/nodejs
ENV PATH  /nodejs/bin:$PATH

WORKDIR /home/node

# Copy manifests.
COPY package.json /home/node/package.json
COPY package-lock.json /home/node/package-lock.json

# Copy build artifacts.
COPY dist /home/node/dist

# Install production dependencies.
RUN npm ci --production --skip-optional --ignore-scripts

FROM gcr.io/distroless/cc

# Re-import args.
ARG NODE_VERSION
ARG TINI_VERSION

# Create labels indicating versions used.
LABEL NODE_VERSION=${NODE_VERSION}
LABEL TINI_VERSION=${TINI_VERSION}

# Set an environment variable we can use to determine when we're in Docker.
ENV IS_DOCKER true

# Copy Tini from base.
COPY --from=base /bin/tini /bin/tini

# Copy Node from base.
COPY --from=base /nodejs /nodejs
ENV PATH /nodejs/bin:$PATH

WORKDIR /home/node

# Copy `sh` and `which`.
COPY --from=base /bin/which /bin/which
COPY --from=base /bin/sh /bin/sh

# Copy all relevant files from base stage.
COPY --from=base /home/node /home/node

WORKDIR /

# Set the container's entrypoint to Tini, which will run Node, which will run
# Sentinelle. It's important we only use ENTRYPOINT here and not CMD, or any
# arguments the user provides via `docker run` will be treated as a replacement
# for CMD, which we don't want.
ENTRYPOINT ["/bin/tini", "--", "/nodejs/bin/node", "/home/node/dist/bin/cli.js"]
