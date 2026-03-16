const menuConfig = require('../config/menu.json');
const businessHours = require('./business-hours.service');

/**
 * Service to manage conversation flow and user states.
 */
class FlowService {
  constructor() {
    /** @type {Map<string, object>} */
    this.sessions = new Map();
  }

  /**
   * Gets or creates a session for a specific user.
   * @param {string} from - User's phone number.
   * @returns {object} The user session.
   */
  getSession(from) {
    if (!this.sessions.has(from)) {
      this.sessions.set(from, { state: 'main', data: {}, isNew: true, retryCount: 0 });
    }
    return this.sessions.get(from);
  }

  /**
   * Processes an incoming message and determines the response.
   * @param {string} from - Sender's phone number.
   * @param {string} text - Message content.
   * @returns {string|null} The response text or null if no response.
   */
  handleMessage(from, text) {
    const session = this.getSession(from);

    // If session is in handoff, don't respond (let humans talk)
    if (session.state === 'handoff') return null;

    const currentState = menuConfig[session.state];

    // Check if user wants to go back to main menu
    if (text === '0' && session.state !== 'main') {
      session.isNew = false;
      session.state = 'main';
      session.retryCount = 0;
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

        return responseText;
      }

      // 3-Strike Logic: If user fails 3 times, auto-handoff
      session.retryCount++;
      if (session.retryCount >= 3) {
        session.state = 'handoff';
        return 'Parece que estou com dificuldades para entender as opções. 😕\n\nVou chamar um de nossos consultores para te ajudar pessoalmente agora mesmo. Por favor, aguarde um instante!';
      }

      // If it's a new session and no valid option was chosen,
      // just show the menu instead of "Invalid Option"
      if (session.isNew) {
        session.isNew = false;

        const isOnline = businessHours.isWithinBusinessHours();
        if (!isOnline) {
          return `🌙 *Olá! No momento nossa equipe está em descanso (atendimento de Seg. a Sex. das 08h às 18h).*\n\nMas não se preocupe! O assistente da *Nexus Center* continua ativo para registrar sua solicitação.\n\n${currentState.text}`;
        }

        return currentState.text;
      }

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

      return responseText;
    }

    session.isNew = false;
    return null;
  }

  /**
   * Resets a user session.
   * @param {string} from - User's phone number.
   */
  resetSession(from) {
    this.sessions.delete(from);
  }
}

module.exports = new FlowService();
