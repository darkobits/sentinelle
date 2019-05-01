import env from '@darkobits/env';
import LogFactory from '@darkobits/log';

const level = env('NODE_ENV') === 'test' ? 'silent' : env('LOG_LEVEL') || 'info';

const log = LogFactory('', level);

log.heading = '\u001b[38;5;44ms\u001b[39m\u001b[38;5;44me\u001b[39m\u001b[38;5;44mn\u001b[39m\u001b[38;5;44mt\u001b[39m\u001b[38;5;44mi\u001b[39m\u001b[38;5;43mn\u001b[39m\u001b[38;5;43me\u001b[39m\u001b[38;5;43ml\u001b[39m\u001b[38;5;43ml\u001b[39m\u001b[38;5;43me\u001b[39m';
Reflect.deleteProperty(log.headingStyle, 'bg');

// Enable color in Docker.
if (env('IS_DOCKER')) {
  log.enableColor();
  log.chalk.enabled = true;
  log.chalk.level = 2;
}


export default log;
