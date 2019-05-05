#!/usr/bin/env node

const env = require('@darkobits/env').default;
const execa = require('execa');
const bytes = require('bytes');
const IS_CI = require('is-ci');


/**
 * Run the provided command, routing output to standard out.
 */
const run = (cmd, inherit = true) => {
  const [bin, ...args] = cmd.split(' ');
  return execa.sync(bin, args, {stdio: inherit ? 'inherit' : false, cwd: process.cwd()}).stdout || '';
}


/**
 * If a single Git tag points at the current HEAD, returns it. If zero tags or
 * multiple tags point at the current HEAD, returns `false`.
 */
function tagAtHead() {
  const results = run('git tag --points-at=HEAD', false).split('\n');

  if (!results) {
    const err = new Error(`Multiple tags point to the current HEAD: ${results.join(', ')}`);
    err.code = 'EMULTAGS';
    throw err;
  }

  if (results.length > 1) {
    const err = new Error('No tags point to the current HEAD.');
    err.code = 'ENOTAG';
    throw err;
  }

  if (!results || results.length !== 1) {
    return false;
  }

  return results[0];
}


/**
 * Provided an image name, returns its size.
 */
function getImageSize(name) {
  return bytes(JSON.parse(run(`docker inspect ${name}`, false))[0].Size);
}


/**
 * If there is a Git tag pointing to the current HEAD, builds Docker images and
 * pushes them to Docker Hub.
 */
function buildAndPushImage() {
  const gitTag = tagAtHead();

  if (IS_CI && !gitTag) {
    console.log('[build-image] No tags at HEAD; skipping.');
    return;
  }

  // Log-in to Docker Hub.
  if (IS_CI) {
    run(`echo ${env('DOCKER_PASSWORD', true)} | docker login --username ${env('DOCKER_USERNAME', true)} --password-stdin`);
  }

  // Compute base and versioned image names.
  const baseImageName = 'darkobits/sentinelle';
  const tags = [baseImageName];

  if (IS_CI) {
    tags.push(`${baseImageName}:${gitTag}`);
  }

  // Build base image. This will apply the `latest` tag by default.
  run(`docker build . --tag=${baseImageName}`);

  // Tag and push images.
  tags.forEach(tag => {
    run(`docker tag ${baseImageName} ${tag}`);

    console.log(`[build-image] Successfully tagged ${tag} (${getImageSize(tag)})`);

    if (IS_CI) {
      run(`docker push ${tag}`);
      console.log(`[build-image] Successfully pushed ${tag}`);
    }
  });
}


module.exports = buildAndPushImage();
