<a href="#top" id="top">
  <a href="https://www.linguee.com/english-french/search?source=auto&query=sentinelle"><img src="https://user-images.githubusercontent.com/441546/56262918-a7049600-6095-11e9-942c-d5934e79bf50.png" style="max-width: 100%;"></a>
</a>
<p align="center">
  <a href="https://www.npmjs.com/package/@darkobits/sentinelle"><img src="https://img.shields.io/npm/v/@darkobits/sentinelle.svg?style=flat-square"></a>
  <a href="https://github.com/darkobits/sentinelle/actions"><img src="https://img.shields.io/endpoint?url=https://aws.frontlawn.net/ga-shields/darkobits/sentinelle&style=flat-square"></a>
  <a href="https://www.codacy.com/app/darkobits/sentinelle"><img src="https://img.shields.io/codacy/coverage/cb56e2c8b1f744728f4d39ccca0ff4d1.svg?style=flat-square"></a>
  <a href="https://david-dm.org/darkobits/sentinelle"><img src="https://img.shields.io/david/darkobits/sentinelle.svg?style=flat-square"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/conventional%20commits-1.0.0-FB5E85.svg?style=flat-square"></a>
</p>

A development tool, primarily designed for JavaScript projects, that can be used to watch a set of files and restart a process when they change.

Testing.

## Contents

* [Install](#install)
* [Use](#use)
  * [CLI](#cli)
  * [Node API](#node-api)
  * [Docker Image](#docker-image)
* [Node Debugger & I/O Configuration](#node-debugger--io-configuration)
* [Debugging](#debugging)

# Install

In most cases, Sentinelle should be installed as a [development dependency](https://docs.npmjs.com/files/package.json#devdependencies) in your project:

```
npm i -D @darkobits/sentinelle
```

If you wish to install Sentinelle globally on your system:

```
npm i -g @darkobits/sentinelle
```

# Use

Sentinelle consists of a CLI (`sentinelle`) and a Node API. Most users will find it more convenient to use the CLI.

## CLI

The Sentinelle CLI expects a single positional argument which should be the path to your application's entrypoint:

```
sentinelle ./server.js
```

If you need to pass arguments to your entrypoint, this argument should be wrapped in quotation marks:

```
sentinelle "./server.js --port=8080"
```

Sentinelle also accepts the following named arguments, all of which are optional:

### `--bin`

Specify a custom runtime to use for executing the provided entrypoint. By default, Sentinelle assumes your entrypoint has executable permissions and contains a [shebang](https://en.wikipedia.org/wiki/Shebang_(Unix)), and will execute the script directly. If this is not the case, or if you need to pass custom arguments to the runtime, this option can be used.

For example, if we needed to run our Node app `server.js` with the `--inspect` flag:

```
sentinelle --bin="node --inspect" ./server.js
```

### `--watch`

By default, Sentinelle always watches the directory containing the entrypoint file and any of its children. However, if you need to watch additional directories or files, you may use this argument.

```
sentinelle --watch ../other-file.js --watch ../other-directory ./server.js
```

### `--kill`

Default: `SIGINT`

Instructs Sentinelle to use a different signal when restarting an application. By default, processes will receive the `SIGINT` signal when Sentinelle needs them to shut-down due to a file change or because the user issued a `SIGINT` (via CTRL+C, for example).

### `--quiet`

Default: `false`

Suppress all log messages from Sentinelle except warnings and errors. Equivalent to setting `LOG_LEVEL=warn`.

## Node API

Sentinelle's default export is a factory function that accepts a single options object and returns an object with several methods.

The following options are supported:

### `entry`

**This option is required.**

Type: `string`

Path to the entrypoint file Sentinelle will run, as well as any additional arguments to pass to it.

### `bin`

Type: `string`

Explicitly specify a runtime (`node`, `python`, etc.) to use to invoke `entry`. This option may also contain any custom arguments you may need to pass to the runtime itself.

### `watch`

Type: `Array<string>`

Additional files and/or directories to watch in addition to the directory containing `entry`.

### `processShutdownGracePeriod`

Type: `string | number`

Default: `'4 seconds'`

Amount of time Sentinelle will wait after issuing a kill signal before forcefully killing a process. If a number is provided, it will be assumed to be the number of milliseconds to wait. If a string is provided, it will be parsed using the [`ms`](https://github.com/zeit/ms) package. Therefore, strings such as `'5 seconds'` are valid.

### `processShutdownSignal`

Type: `string`

Default: `SIGINT`

[POSIX signal](https://en.wikipedia.org/wiki/Signal_(IPC)#POSIX_signals) to send to a process to indicate that it needs to shut down.

### `stdio`

Type: `string | Array<string>`

Default: `['inherit', 'inherit', 'pipe']`

[Input/output configuration](https://nodejs.org/api/child_process.html#child_process_options_stdio) for the spawned process.

---

The object returned has the following methods:

### `start()`

Starts the process and initializes file watchers. Returns a Promise that resolves when this operation is complete.

### `restart(signal?: string)`

Restarts the process. By default, the configured `processShutdownSignal` is sent to the process. However, this may be overridden by providing an optional `signal` argument to this function. Returns a Promise that resolves when this operation is complete.

### `stop(signal?: string)`

Stops the current process if one is running and closes all file watchers. By default, the configured `processShutdownSignal` is sent to the process. However, this may be overridden by providing an optional `signal` argument to this function. Returns a Promise that resolves when this operation is complete.


## Docker Image

Many modern development workflows involve the use of Docker to achieve a more production-like environment. For convenience, Sentinelle is also distributed as a Docker image. This section will walk you through how to download and use it. Working knowledge of Docker and a Docker installation on your machine are assumed.

The Sentinelle Docker image uses Node 10.14.1, and is based on the [`ubuntu:19.04`](https://hub.docker.com/_/ubuntu) image.

### Pull

To pull the latest available version:

`docker pull darkobits/sentinelle:latest`

However, using `latest` is Considered Harmful, as it will not protect you against future breaking changes. Therefore, you should select a specific version to use instead. Every [Git tag in this repository](https://github.com/darkobits/sentinelle/releases) has a [corresponding Docker image tag](https://hub.docker.com/r/darkobits/sentinelle/tags):

`docker pull darkobits/sentinelle:v0.5.0`

### Run

When running the image, everything after the `<image name>` positional argument will be treated as Sentinelle arguments, which are parsed just like the CLI. Remember that environment variables need to be set with the `-e` argument and you will need to volume-mount the directory containing your entrypoint and the files you want to watch.

For completeness, here is a command illustrating setting an environment variable, passing arguments to Docker, to Sentinelle, to the entrypoint, and to Node:

```shell
docker run \
  --rm \
  --tty \
  --interactive \
  -e LOG_LEVEL=silly \
  --volume $(pwd)/src:/app/src \
  --volume $(pwd)/node_modules:/app/node_modules \
  darkobits/sentinelle:0.6.3 --bin="node --inspect" "/app/src/server.js --port=80"
```

This assumes we are in our project's root directory, that our source files are in `src`, and our entrypoint is `src/server.js`.

If the project requires transpilation using a tool like Babel, you would instead want to mount the project's `dist` (or equivalent) folder and use `dist/server.js` as your entrypoint while running Babel in watch mode in another terminal. This will allow you to change source files locally and have Sentinelle restart the application in the Docker container whenever Babel re-transpiles them.

## Node Debugger & I/O Configuration

The Node debugger can make Sentinelle's job harder than it otherwise would be. Nevertheless, debugging is a critical part of development, so Sentinelle tries to work around some of these quirks as best it can.

By default, standard input and standard output are set to `inherit`, which results in the highest quality output and best user experience. However, Sentinelle sets up standard error using `pipe`. You will still see output from standard error, but it may not have full color support.

Sentinelle then monitors standard error, which is where Node writes messages about debuggers, and keeps track of when debuggers connect and disconnect from the child process. By doing this, it can take appropriate action when one of the following scenarios occur:

* **Hanging Debugger**: This happens when a process starts, a debugger attaches, then at some later point the process naturally exits and the debugger is not paused on any breakpoint. When this happens, Node will keep the process alive and write something like `Waiting for the debugger to disconnect...` to standard error. When Sentinelle detects this, it will force-kill the process so that it can cleanly re-start it on the next file change.

* **Paused Debugger**: This happens when a process such as a web-server (which keeps the JavaScript event loop running indefinitely) starts, a debugger attaches, pauses on a breakpoint or `debugger;` statement, and then Sentinelle detects a file change and now needs to shut-down and re-start the process. When this happens, Node will keep the process alive even if the process receives a `SIGINT`. When Sentinelle detects this, it will wait for the configured grace period and then send a `SIGKILL` to the process, which is the only signal that will actually cause Node to release the debugger and allow the process to exit. Note that because the debugger has paused execution, your process will not run any shutdown handlers, resulting in a potentially un-clean exit. To avoid this scenario, ensure execution is resumed before saving any files.

## Debugging

Sentinelle respects the `LOG_LEVEL` environment variable, which may be set to any [valid NPM log level](https://github.com/npm/npmlog/blob/master/log.js#L296-L304). To produce additional output, you may set `LOG_LEVEL` to `verbose` or `silly`:

```
LOG_LEVEL=silly sentinelle ./server.js
```

## &nbsp;
<p align="center">
  <br>
  <img width="22" height="22" src="https://cloud.githubusercontent.com/assets/441546/25318539/db2f4cf2-2845-11e7-8e10-ef97d91cd538.png">
</p>
