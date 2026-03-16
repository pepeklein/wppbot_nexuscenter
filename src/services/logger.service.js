const pino = require('pino');
require('dotenv').config();

/**
 * Professional logger service using Pino.
 * Provides high-performance structured logging with pretty printing in development.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
});

module.exports = logger;
