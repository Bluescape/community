const config = require('./config');

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[config.logging.level] ?? LOG_LEVELS.info;

class Logger {
  constructor() {
    this.timestamp = () => new Date().toISOString();
  }

  debug(message, data = {}) {
    if (LOG_LEVELS.debug >= currentLevel) {
      console.log(`[${this.timestamp()}] [DEBUG] ${message}`, data);
    }
  }

  info(message, data = {}) {
    if (LOG_LEVELS.info >= currentLevel) {
      console.log(`[${this.timestamp()}] [INFO] ${message}`, data);
    }
  }

  warn(message, data = {}) {
    if (LOG_LEVELS.warn >= currentLevel) {
      console.warn(`[${this.timestamp()}] [WARN] ${message}`, data);
    }
  }

  error(message, error = null) {
    if (LOG_LEVELS.error >= currentLevel) {
      if (error instanceof Error) {
        console.error(`[${this.timestamp()}] [ERROR] ${message}`, {
          message: error.message,
          stack: error.stack,
        });
      } else {
        console.error(`[${this.timestamp()}] [ERROR] ${message}`, error);
      }
    }
  }
}

module.exports = new Logger();
