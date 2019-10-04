import env from '@darkobits/env';
import LogFactory from '@darkobits/log';

const level: string = env('NODE_ENV') === 'test' ? 'silent' : env('LOG_LEVEL') || 'info';
const log = LogFactory({heading: '', level});

log.configure({
  heading: '\u001b[38;5;44ms\u001b[39m\u001b[38;5;44me\u001b[39m\u001b[38;5;44mn\u001b[39m\u001b[38;5;44mt\u001b[39m\u001b[38;5;44mi\u001b[39m\u001b[38;5;43mn\u001b[39m\u001b[38;5;43me\u001b[39m\u001b[38;5;43ml\u001b[39m\u001b[38;5;43ml\u001b[39m\u001b[38;5;43me\u001b[39m',
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
