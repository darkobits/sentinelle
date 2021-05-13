<a href="#top" id="top">
  <a href="https://www.linguee.com/english-french/search?source=auto&query=sentinelle"><img src="https://user-images.githubusercontent.com/441546/103064053-dc9a9b80-4567-11eb-8b5c-a7223865acc9.png" style="max-width: 100%;"></a>
</a>
<p align="center">
  <a href="https://www.npmjs.com/package/@darkobits/sentinelle"><img src="https://img.shields.io/npm/v/@darkobits/sentinelle.svg?style=flat-square&color=398AFB"></a>
  <a href="https://github.com/darkobits/sentinelle/actions"><img src="https://img.shields.io/github/workflow/status/darkobits/sentinelle/CI?style=flat-square"></a>
  <a href="https://app.codecov.io/gh/darkobits/sentinelle/branch/master"><img src="https://img.shields.io/codecov/c/github/darkobits/sentinelle/master?style=flat-square&color=brightgreen"></a>
  <img src="https://img.shields.io/depfu/darkobits/sentinelle?style=flat-square">
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/static/v1?label=commits&message=conventional&style=flat-square&color=3073BF"></a>
</p>

A development tool, primarily designed for JavaScript projects, that can be used to watch a set of files and restart a process when they change.

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

<br />
<a href="#top">
  <img src="https://user-images.githubusercontent.com/441546/102322726-5e6d4200-3f34-11eb-89f2-c31624ab7488.png" style="max-width: 100%;">
</a>
