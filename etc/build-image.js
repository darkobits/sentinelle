#!/usr/bin/env node

const {execSync} = require('child_process');
const env = require('@darkobits/env').default;


/**
 * Run the provided command, routing output to standard out.
 */
const run = cmd => execSync(cmd, {stdio: 'inherit', cwd: process.cwd()});


/**
 * If a single Git tag points at the current HEAD, returns it. If zero tags or
 * multiple tags point at the current HEAD, returns `false`.
 */
function tagAtHead() {
  const results = execSync('git tag --points-at=HEAD', {
    encoding: 'utf8',
    cwd: process.cwd()
  }).trim().split('\n');

  if (!results || results.length !== 1) {
    return false;
  }

  return results[1];
}


/**
 * If there is a Git tag pointing to the current HEAD, builds Docker images and
 * pushes them to Docker Hub.
 */
function buildAndPushImage() {
  const gitTag = tagAtHead();

  if (!gitTag) {
    console.log('[build-image] No tags at HEAD; skipping.');
    return;
  }

  // Log-in to Docker Hub.
  run(`echo ${env('DOCKER_PASSWORD', true)} | docker login --username ${env('DOCKER_USERNAME', true)} --password-stdin`);

  // Compute base image and versioned image names.
  const baseImageName = 'darkobits/sentinelle';
  const gitTagImageName = `${baseImageName}:${gitTag}`;
  const tags = [baseImageName, gitTagImageName];

  // Build base image.
  run(`docker build . --tag=${baseImageName}`);

  // Tag and push images.
  tagsToPush.forEach(tag => {
    run(`docker tag ${baseImageName} ${tag}`);
    console.log(`[build-image] Successfully tagged ${tag}`);
    run(`docker push ${tag}`);
    console.log(`[build-image] Successfully pushed ${tag}`);
  });
}


module.exports = buildAndPushImage();
