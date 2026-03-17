const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const logger = require('./logger.service');

/**
 * Service to manage WhatsApp client connectivity and events.
 */
class WhatsAppService {
  /**
   * Initializes the WhatsApp client with local authentication.
   */
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // <- this one is key for low-memory environments
          '--disable-gpu'
        ],
        // When running in Docker, we use the pre-installed chromium
        executablePath: process.env.NODE_ENV === 'production' ? '/usr/bin/chromium' : undefined,
      },
    });

    this._initializeEvents();
  }

  /**
   * Sets up event listeners for the WhatsApp client.
   * @private
   */
  _initializeEvents() {
    this.client.on('qr', async (qr) => {
      logger.info('QR Code received!');
      
      // 1. Generate a clickable URL (Best for Cloud/Railway)
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
      logger.info('--------------------------------------------------');
      logger.info('🔗 CLIQUE NO LINK ABAIXO PARA ESCANEAR O QR CODE:');
      logger.info(qrImageUrl);
      logger.info('--------------------------------------------------');

      // 2. Terminal Fallback
      try {
        const qrString = await QRCode.toString(qr, { type: 'terminal', small: true });
        console.log(qrString);
      } catch (err) {
        logger.error('Failed to generate terminal QR Code:', err);
      }
    });

    this.client.on('ready', () => {
      logger.info('WhatsApp Client is ready!');
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp Client authenticated successfully.');
    });

    this.client.on('auth_failure', (msg) => {
      logger.error(`Authentication failure: ${msg}`);
    });
  }

  /**
   * Starts the WhatsApp client.
   * @returns {Promise<void>}
   */
  async start() {
    try {
      await this.client.initialize();
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
      throw error;
    }
  }

  /**
   * Registers a callback for incoming messages.
   * @param {Function} callback - Function to execute on message.
   */
  onMessage(callback) {
    this.client.on('message_create', callback);
  }

  /**
   * Sends a message to a specific number.
   * @param {string} to - Recipient phone number.
   * @param {string} message - Content to send.
   * @returns {Promise<object>}
   */
  async sendMessage(to, message) {
    return this.client.sendMessage(to, message);
  }

  /**
   * Triggers the "typing..." status for a specific contact.
   * @param {string} to - Recipient phone number.
   * @returns {Promise<void>}
   */
  async sendTyping(to) {
    const chat = await this.client.getChatById(to);
    await chat.sendStateTyping();
  }
}

module.exports = new WhatsAppService();
