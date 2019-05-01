<a href="#top" id="top">
  <a href="https://www.linguee.com/english-french/search?source=auto&query=sentinelle"><img src="https://user-images.githubusercontent.com/441546/56262918-a7049600-6095-11e9-942c-d5934e79bf50.png" style="max-width: 100%;"></a>
</a>
<p align="center">
  <a href="https://www.npmjs.com/package/@darkobits/sentinelle"><img src="https://img.shields.io/npm/v/@darkobits/sentinelle.svg?style=flat-square"></a>
  <a href="https://travis-ci.org/darkobits/sentinelle"><img src="https://img.shields.io/travis/darkobits/sentinelle.svg?style=flat-square"></a>
  <a href="https://www.codacy.com/app/darkobits/sentinelle"><img src="https://img.shields.io/codacy/coverage/cb56e2c8b1f744728f4d39ccca0ff4d1.svg?style=flat-square"></a>
  <a href="https://david-dm.org/darkobits/sentinelle"><img src="https://img.shields.io/david/darkobits/sentinelle.svg?style=flat-square"></a>
  <a href="https://github.com/conventional-changelog/standard-version"><img src="https://img.shields.io/badge/conventional%20commits-1.0.0-027dc6.svg?style=flat-square"></a>
  <a href="https://github.com/sindresorhus/xo"><img src="https://img.shields.io/badge/code_style-XO-e271a5.svg?style=flat-square"></a>
</p>

A development tool, primarily designed for JavaScript projects, that can be used to watch a set of files and restart a process when they change.

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

The Sentinelle CLI expects a single positional argument which should be the path to your application's entrypoint. It also accepts the following named arguments, all of which are optional:

### `--bin`

Default: `node`

Allows Sentinelle to be used with different languages/runtimes. For example:

```
sentinelle --bin python ./server.py
```

### `--watch`

By default, Sentinelle always watches the directory containing the entrypoint file. However, if you need to watch additional directories or files, you may use this argument.

```
sentinelle --watch ./other-file.js --watch ./other-directory ./server.js
```

### `--kill`

Default: `SIGUSR2`

Instructs Sentinelle to use a different signal when restarting an application. By default, processes will receive the `SIGUSR2` signal when Sentinelle needs them to shut-down due to a file change or because the user issued a `SIGINT` (via CTRL+C, for example).

### `--quiet`

Default: `false`

Suppress all log messages from Sentinelle except warnings and errors. Equivalent to setting `LOG_LEVEL=warn`.

### Passing Additional Arguments

In some cases you may want to pass additional arguments to your application or to the executable that runs it. For example, if we had an entrypoint of `./server.js` that expects a `--port` argument, and we additionally wanted to debug this application by passing the `--inspect` argument to Node, _and_ we wanted to suppress non-critical logging from Sentinelle, we could do so thusly:

```
sentinelle --quiet "./server.js --port=8080" -- --inspect
```

By wrapping the entrypoint in quotes, we can easily pass any positional or named arguments to the entrypoint. Additionally, any arguments that appear after `--` will not be parsed by Sentinelle and will instead be provided as arguments to Node (or the program indicated with a `--bin` argument).

Therefore, the above invocation will cause Sentinelle to run our server by calling the following command:

```
node --inspect ./server.js --port=8080
```

## Node API

Sentinelle's default export is a factory function that accepts a single options object and returns an object with several methods.

The following options are supported:

### `entry`

**This option is required.**

Type: `string`

Path to the entrypoint file Sentinelle will run.

### `entryArgs`

Type: `Array<string>`

Additional arguments to pass to `entry`.

### `bin`

Type: `string`
Default: `node`

Alternative binary to use to execute `entry`. Sentinelle will use the `which` utility on -nix machines and the `where` utility on Windows machines to locate the binary.

### `binArgs`

Type: `Array<string>`

Additional arguments to pass to `bin`.

### `watch`

Type: `Array<string>`

Additional files and/or directories to watch in addition to the directory containing `entry`.

### `processShutdownGracePeriod`

Type: `string | number`
Default: `'4 seconds'`

Amount of time Sentinelle will wait after issuing a kill signal before forcefully killing a process. If a number is provided, it will be assumed to be the number of milliseconds to wait. If a string is provided, it will be parsed using the [`ms`](https://github.com/zeit/ms) package. Therefore, strings such as `'5 seconds'` are valid.

### `processShutdownSignal`

Type: `string`
Default: `SIGUSR2`

[POSIX signal](https://en.wikipedia.org/wiki/Signal_(IPC)#POSIX_signals) to send to a process to indicate that it needs to shut down.

### `stdio`

Type: `string | Array<string>`
Default: `pipe`

[Input/output configuration](https://nodejs.org/api/child_process.html#child_process_options_stdio) for the spawned process.

---

The object returned has the following methods:

### `start()`

Starts the process and initializes file watchers. Returns a Promise that resolves when this operation is complete.

### `restart(signal?: string)`

Restarts the process. By default, the configured `processShutdownSignal` is sent to the process. However, this may be overridden by providing an optional `signal` argument to this function. Returns a Promise that resolves when this operation is complete.

### `stop(signal?: string)`

Stops the current process if one is running and closes all file watchers. By default, the configured `processShutdownSignal` is sent to the process. However, this may be overridden by providing an optional `signal` argument to this function. Returns a Promise that resolves when this operation is complete.

# Debugging

Sentinelle respects the `LOG_LEVEL` environment variable, which may be set to any [valid NPM log level](https://github.com/npm/npmlog/blob/master/log.js#L296-L304). To produce additional output, you may set `LOG_LEVEL` to `verbose` or `silly`:

```
LOG_LEVEL=silly sentinelle ./server.js`
```

## &nbsp;
<p align="center">
  <br>
  <img width="22" height="22" src="https://cloud.githubusercontent.com/assets/441546/25318539/db2f4cf2-2845-11e7-8e10-ef97d91cd538.png">
</p>
