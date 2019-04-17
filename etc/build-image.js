#!/usr/bin/env node

const {execSync} = require('child_process');
const env = require('@darkobits/env').default;


/**
 * Run the provided command, routing output to standard out.
 */
function run(cmd) {
  return execSync(cmd, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
}


/**
 * If a single Git tag points at the current HEAD, outputs it. If zero tags or
 * multiple tags point at the current HEAD, exits with code 1.
 */
function tagAtHead() {
  const resultLines = execSync('git tag --points-at=HEAD', {
    encoding: 'utf8',
    cwd: process.cwd()
  }).trim();

  if (!resultLines) {
    return false;
  }

  const results = resultLines.split('\n');

  if (results.length !== 1) {
    return false;
  }

  return results[0];
}


function buildAndPushImage() {
  run(`echo ${env('DOCKER_PASSWORD')} | docker login --username ${env('DOCKER_USERNAME')} --password-stdin`);

  const tagsToPush = [];

  const baseImageName = 'darkobits/sentinelle';

  run(`docker build . --tag=${baseImageName}`);

  tagsToPush.push(baseImageName);

  const gitTag = tagAtHead();

  if (gitTag) {
    const gitTagImageName = `darkobits/sentinelle:${gitTag}`;
    run(`docker tag darkobits/sentinelle:latest ${gitTagImageName}`);
    console.log(`Successfully tagged ${gitTagImageName}`);
    tagsToPush.push(gitTagImageName);
  }

  tagsToPush.forEach(tag => {
    run(`docker push ${tag}`);
  });
}


module.exports = buildAndPushImage();
