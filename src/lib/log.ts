import env from '@darkobits/env';
import LogFactory from '@darkobits/log';
import {randomArrayElement} from 'lib/utils';


const log = LogFactory('', env('NODE_ENV') === 'test' ? 'silent' : env('LOG_LEVEL') || 'info');

const headings = [
  '\u001b[38;5;38ms\u001b[39m\u001b[38;5;38me\u001b[39m\u001b[38;5;44mn\u001b[39m\u001b[38;5;44mt\u001b[39m\u001b[38;5;43mi\u001b[39m\u001b[38;5;43mn\u001b[39m\u001b[38;5;49me\u001b[39m\u001b[38;5;48ml\u001b[39m\u001b[38;5;84ml\u001b[39m\u001b[38;5;84me\u001b[39m',
  '\u001b[38;5;44ms\u001b[39m\u001b[38;5;43me\u001b[39m\u001b[38;5;43mn\u001b[39m\u001b[38;5;49mt\u001b[39m\u001b[38;5;84mi\u001b[39m\u001b[38;5;84mn\u001b[39m\u001b[38;5;84me\u001b[39m\u001b[38;5;83ml\u001b[39m\u001b[38;5;119ml\u001b[39m\u001b[38;5;119me\u001b[39m',
  '\u001b[38;5;39ms\u001b[39m\u001b[38;5;38me\u001b[39m\u001b[38;5;38mn\u001b[39m\u001b[38;5;44mt\u001b[39m\u001b[38;5;44mi\u001b[39m\u001b[38;5;43mn\u001b[39m\u001b[38;5;43me\u001b[39m\u001b[38;5;49ml\u001b[39m\u001b[38;5;48ml\u001b[39m\u001b[38;5;84me\u001b[39m',
];

// Set heading.
log.heading = randomArrayElement(headings);
Reflect.deleteProperty(log.headingStyle, 'bg');

// Enable color in Docker.
if (env('IS_DOCKER')) {
  log.enableColor();
  log.chalk.enabled = true;
  log.chalk.level = 2;
}


export default log;
