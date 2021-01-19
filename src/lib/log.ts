import env from '@darkobits/env';
import LogFactory from '@darkobits/log';

const level: string = env('NODE_ENV') === 'test' ? 'silent' : env('LOG_LEVEL') ?? 'info';
const log = LogFactory({heading: '', level});

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

export default log;
