const whatsapp = require('./whatsapp.service');
const flow = require('./flow.service');
const logger = require('./logger.service');

/**
 * Service to manage automatic follow-ups and session auto-closure.
 */
class FollowUpService {
  constructor() {
    /** @type {Map<string, object>} */
    this.timers = new Map();
  }

  /**
   * Schedules a follow-up for a specific user.
   * If a timer already exists, it is reset.
   * @param {string} from - Customer's phone number.
   */
  scheduleFollowUp(from) {
    this.cancelTimer(from);

    // Initial follow-up after 2 hours (2 * 60 * 60 * 1000)
    const twoHours = 2 * 60 * 60 * 1000;

    const timer = setTimeout(async () => {
      await this._sendFollowUp(from);
    }, twoHours);

    this.timers.set(from, timer);
  }

  /**
   * Cancels any pending timer for a user.
   * @param {string} from - Customer's phone number.
   */
  cancelTimer(from) {
    if (this.timers.has(from)) {
      clearTimeout(this.timers.get(from));
      this.timers.delete(from);
    }
  }

  /**
   * Sends a gentle follow-up message and schedules auto-close.
   * @param {string} from - Customer's phone number.
   * @private
   */
  async _sendFollowUp(from) {
    try {
      const session = flow.getSession(from);

      // Only send if still in a flow state
      if (session && session.state !== 'handoff' && session.state !== 'completed') {
        logger.info(`Sending follow-up to ${from}`);

        const message =
          'Olá! Vi que você estava interessado em nossas soluções. Posso te ajudar a concluir sua solicitação? 😊';
        await whatsapp.sendMessage(from, message);

        // Schedule auto-close after 30 minutes
        const thirtyMinutes = 30 * 60 * 1000;
        const timer = setTimeout(async () => {
          await this._autoClose(from);
        }, thirtyMinutes);

        this.timers.set(from, timer);
      }
    } catch (error) {
      logger.error(`Error sending follow-up to ${from}:`, error);
    }
  }

  /**
   * Automatically closes the session after inactivity post-follow-up.
   * @param {string} from - Customer's phone number.
   * @private
   */
  async _autoClose(from) {
    try {
      const session = flow.getSession(from);

      if (session && session.state !== 'handoff' && session.state !== 'completed') {
        logger.info(`Auto-closing session for ${from}`);

        const goodbyeText =
          '✅ *Atendimento Finalizado por inatividade.*\n\nAgradecemos o seu contato! Se precisar de algo mais no futuro, basta nos enviar uma nova mensagem. Tenha um excelente dia! 👋';
        await whatsapp.sendMessage(from, goodbyeText);

        flow.resetSession(from);
      }
      this.timers.delete(from);
    } catch (error) {
      logger.error(`Error auto-closing session for ${from}:`, error);
    }
  }
}

module.exports = new FollowUpService();
