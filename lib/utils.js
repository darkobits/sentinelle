"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isNumerical = isNumerical;
exports.parseTime = parseTime;
exports.ensureBin = ensureBin;
exports.ensureFile = ensureFile;
exports.ensureArray = ensureArray;
exports.getPackageVersion = getPackageVersion;
exports.randomArrayElement = randomArrayElement;

var _child_process = require("child_process");

var _fs = _interopRequireDefault(require("fs"));

var _os = _interopRequireDefault(require("os"));

var _path = _interopRequireDefault(require("path"));

var _ms = _interopRequireDefault(require("ms"));

var _readPkgUp = _interopRequireDefault(require("read-pkg-up"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isNumerical(value) {
  return !/\D/g.test(String(value));
}

function parseTime(value) {
  if (!value && !isNumerical(value)) {
    return;
  }

  if (typeof value === 'string') {
    if (isNumerical(value)) {
      return Number.parseInt(value, 10);
    }

    return (0, _ms.default)(value);
  }

  return value;
}

function ensureBin(name) {
  const binFinder = _os.default.platform() === 'win32' ? 'where' : 'which';

  try {
    return (0, _child_process.execSync)(`${binFinder} ${name}`, {
      encoding: 'utf8'
    }).trim();
  } catch (err) {
    if (err !== null && err !== void 0 && err.message && err.message.toLowerCase().includes('command failed')) {
      throw new Error(`The binary "${name}" was not found on your system.`);
    }

    throw err;
  }
}

function ensureFile(name) {
  const absPath = _path.default.resolve(name);

  try {
    _fs.default.accessSync(absPath, _fs.default.constants.R_OK);

    return absPath;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`The file "${absPath}" could not be found.`);
    }

    if (err.code === 'EACCES') {
      throw new Error(`The file "${absPath}" could not be read; permission denied.`);
    }

    throw err;
  }
}

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
}

async function getPackageVersion() {
  const pkgInfo = await (0, _readPkgUp.default)({
    cwd: __dirname
  });

  if (!pkgInfo) {
    throw new Error('Unable to locate a package.json for Senintlle.');
  }

  return pkgInfo.packageJson.version;
}

function randomArrayElement(xs) {
  return xs[Math.floor(Math.random() * xs.length)];
}
//# sourceMappingURL=utils.js.map