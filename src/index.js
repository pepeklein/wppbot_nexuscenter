const whatsapp = require('./services/whatsapp.service');
const messageHandler = require('./handlers/message.handler');
const logger = require('./services/logger.service');

/**
 * Main application entry point.
 * Initializes services and starts the WhatsApp client.
 */
async function bootstrap() {
  try {
    logger.info('Starting WhatsApp Chatbot...');

    // Register message handler
    whatsapp.onMessage(async (msg) => {
      try {
        await messageHandler.handle(msg);
      } catch (error) {
        logger.error(error, 'Error handling message');
      }
    });

    // Start client
    await whatsapp.start();

    logger.info('Bootstrap sequence completed.');
  } catch (error) {
    logger.fatal('Failed to bootstrap application:', error);
    process.exit(1);
  }
}

bootstrap();
