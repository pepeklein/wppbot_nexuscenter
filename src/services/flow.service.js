const menuConfig = require('../config/menu.json');
const businessHours = require('./business-hours.service');
const databaseService = require('./database.service');
const logger = require('./logger.service');

/**
 * Service to manage conversation flow and user states.
 */
class FlowService {
  constructor() {
    // Single source of truth is now the database
  }

  /**
   * Normalizes WhatsApp ID to just the number part.
   * @param {string} id - The WhatsApp ID string.
   * @returns {string} Just the number part.
   * @private
   */
  _normalizeId(id) {
    if (!id) return id;
    return id.split('@')[0];
  }

  /**
   * Gets or creates a session for a specific user.
   * @param {string} from - User's phone number.
   * @returns {Promise<object>} The user session.
   */
  async getSession(from) {
    const cleanId = this._normalizeId(from);
    // Try to get from database
    let session = await databaseService.getSession(cleanId);

    // If still not found, create new one
    if (!session) {
      session = { state: 'main', data: {}, isNew: true, retryCount: 0 };
    }

    return session;
  }

  /**
   * Processes an incoming message and determines the response.
   * @param {string} from - Sender's phone number.
   * @param {string} text - Message content.
   * @returns {Promise<string|null>} The response text or null if no response.
   */
  async handleMessage(from, text) {
    const cleanId = this._normalizeId(from);
    const session = await this.getSession(cleanId);
    const isReset = text.trim().toLowerCase().startsWith('/fim') || text.trim().toLowerCase() === 'fim';

    // 1. SILENCE LOGIC
    // Bypass silence for reset commands
    if (isReset) {
      logger.info(`Bypassing silence for reset command from ${cleanId}`);
    } else {
      // If session is in handoff, don't respond (let humans talk)
      if (session.state === 'handoff') {
        logger.info(`Bot is silent for ${cleanId} (State: handoff)`);
        return null;
      }

      // If session was already completed, auto-reset and start over
      if (session.state === 'completed') {
        logger.info(`Session was completed for ${cleanId}. Auto-resetting for new inquiry.`);
        await this.resetSession(cleanId);
        session.state = 'main';
        session.data = {};
        session.isNew = true;
        session.retryCount = 0;
      }
    }

    const currentState = menuConfig[session.state];

    if (!currentState) {
      logger.warn(`Unknown state: ${session.state} for user ${from}. Resetting to main.`);
      session.state = 'main';
      await databaseService.saveSession(from, session);
      return menuConfig.main.text;
    }

    // Check if user wants to go back to main menu
    if (text === '0' && session.state !== 'main') {
      session.isNew = false;
      session.state = 'main';
      session.retryCount = 0;
      await databaseService.saveSession(from, session);
      return menuConfig.main.text;
    }

    // Logic for states with options
    if (currentState.options) {
      const option = currentState.options[text.trim()];
      if (option) {
        session.retryCount = 0; // Reset on success
        session.isNew = false;
        session.state = option.next;

        // If move to completed, it's handled differently (success message)
        if (session.state === 'completed') {
          await databaseService.saveSession(from, session);
          return `✅ *Obrigado!*\n\nSua solicitação sobre *${session.data.selection}* foi confirmada e encaminhada!\n\nEm breve um de nossos consultores falará com você. 😊`;
        }

        const nextState = menuConfig[session.state];
        if (!nextState) return null;

        // If moving to a terminal state (like description request), save selection
        if (nextState.isTerminal) {
          session.data.selection = option.label;
        }

        let responseText = nextState.text;

        // Substitute variables if in confirmation state
        if (session.state === 'confirmation') {
          responseText = responseText
            .replace('{selection}', session.data.selection)
            .replace('{description}', session.data.description);
        }

        await databaseService.saveSession(from, session);
        return responseText;
      }

      // 3-Strike Logic: If user fails 3 times, auto-handoff
      session.retryCount++;
      if (session.retryCount >= 3) {
        session.state = 'handoff';
        await databaseService.saveSession(from, session);
        return 'Parece que estou com dificuldades para entender as opções. 😕\n\nVou chamar um de nossos consultores para te ajudar pessoalmente agora mesmo. Por favor, aguarde um instante!';
      }

      // If it's a new session and no valid option was chosen,
      // just show the menu instead of "Invalid Option"
      if (session.isNew) {
        session.isNew = false;
        await databaseService.saveSession(from, session);

        const isOnline = businessHours.isWithinBusinessHours();
        if (!isOnline) {
          return `🌙 *Olá! No momento nossa equipe está em descanso (atendimento de Seg. a Sex. das 08h às 18h).*\n\nMas não se preocupe! O assistente da *Nexus Center* continua ativo para registrar sua solicitação.\n\n${currentState.text}`;
        }

        return currentState.text;
      }

      await databaseService.saveSession(from, session);
      return `❌ *Opção inválida.*\n\n${currentState.text}`;
    }

    // Logic for terminal state (description collection)
    if (currentState.isTerminal) {
      session.retryCount = 0;
      session.isNew = false;
      session.data.description = text;
      session.state = currentState.next || 'completed';

      // If move to completed, it's handled differently (success message)
      if (session.state === 'completed') {
        await databaseService.saveSession(from, session);
        return `✅ *Obrigado!*\n\nSua solicitação sobre *${session.data.selection}* foi confirmada e encaminhada!\n\nEm breve um de nossos consultores falará com você. 😊`;
      }

      const nextState = menuConfig[session.state];
      if (!nextState) return null;
      let responseText = nextState.text;

      // Substitute variables for confirmation
      if (session.state === 'confirmation') {
        responseText = responseText
          .replace('{selection}', session.data.selection)
          .replace('{description}', session.data.description);
      }

      await databaseService.saveSession(from, session);
      return responseText;
    }

    session.isNew = false;
    await databaseService.saveSession(from, session);
    return null;
  }

  /**
   * Resets a user session.
   * @param {string} from - User's phone number.
   */
  async resetSession(from) {
    const cleanId = this._normalizeId(from);
    logger.info(`Resetting session for ${cleanId}`);
    await databaseService.deleteSession(cleanId);
  }
}

module.exports = new FlowService();
