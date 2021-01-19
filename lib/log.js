"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _env2 = _interopRequireDefault(require("@darkobits/env"));

var _log = _interopRequireDefault(require("@darkobits/log"));

var _env;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const level = (0, _env2.default)('NODE_ENV') === 'test' ? 'silent' : (_env = (0, _env2.default)('LOG_LEVEL')) !== null && _env !== void 0 ? _env : 'info';
const log = (0, _log.default)({
  heading: '',
  level
});
log.configure({
  heading: '\u001B[38;5;44ms\u001B[39m\u001B[38;5;44me\u001B[39m\u001B[38;5;44mn\u001B[39m\u001B[38;5;44mt\u001B[39m\u001B[38;5;44mi\u001B[39m\u001B[38;5;43mn\u001B[39m\u001B[38;5;43me\u001B[39m\u001B[38;5;43ml\u001B[39m\u001B[38;5;43ml\u001B[39m\u001B[38;5;43me\u001B[39m',
  style: {
    heading: token => token
  },
  levels: {
    info: {
      style: (token, chalk) => chalk.keyword('mediumseagreen')(token)
    }
  }
});
var _default = log;
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=log.js.map