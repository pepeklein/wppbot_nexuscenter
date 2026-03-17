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
   * Schedules a follow-up for a specific user.
   * If a timer already exists, it is reset.
   * @param {string} from - Customer's phone number.
   */
  scheduleFollowUp(from) {
    const cleanId = this._normalizeId(from);
    this.cancelTimer(cleanId);

    // Initial follow-up after 2 hours (2 * 60 * 1000 for testing, change to 2 * 60 * 60 * 1000 for prod)
    const delay = 2 * 60 * 60 * 1000;

    const timer = setTimeout(async () => {
      await this._sendFollowUp(cleanId);
    }, delay);

    this.timers.set(cleanId, timer);
  }

  /**
   * Cancels any pending timer for a user.
   * @param {string} from - Customer's phone number.
   */
  cancelTimer(from) {
    const cleanId = this._normalizeId(from);
    if (this.timers.has(cleanId)) {
      clearTimeout(this.timers.get(cleanId));
      this.timers.delete(cleanId);
    }
  }

  /**
   * Sends a gentle follow-up message and schedules auto-close.
   * @param {string} from - Customer's phone number.
   * @private
   */
  async _sendFollowUp(from) {
    const cleanId = this._normalizeId(from);
    try {
      const session = await flow.getSession(cleanId);

      // Only send if still in a flow state
      if (session && session.state !== 'handoff' && session.state !== 'completed') {
        logger.info(`Sending follow-up to ${cleanId}`);

        const message =
          'Olá! Vi que você estava interessado em nossas soluções. Posso te ajudar a concluir sua solicitação? 😊';
        // Need to reconstruct the WhatsApp ID for sending
        await whatsapp.sendMessage(`${cleanId}@c.us`, message);

        // Schedule auto-close after 30 minutes
        const thirtyMinutes = 30 * 60 * 1000;
        const timer = setTimeout(async () => {
          await this._autoClose(cleanId);
        }, thirtyMinutes);

        this.timers.set(cleanId, timer);
      }
    } catch (error) {
      logger.error(`Error sending follow-up to ${cleanId}:`, error);
    }
  }

  /**
   * Automatically closes the session after inactivity post-follow-up.
   * @param {string} from - Customer's phone number.
   * @private
   */
  async _autoClose(from) {
    const cleanId = this._normalizeId(from);
    try {
      const session = await flow.getSession(cleanId);

      if (session && session.state !== 'handoff' && session.state !== 'completed') {
        logger.info(`Auto-closing session for ${cleanId}`);

        const goodbyeText =
          '✅ *Atendimento Finalizado por inatividade.*\n\nAgradecemos o seu contato! Se precisar de algo mais no futuro, basta nos enviar uma nova mensagem. Tenha um excelente dia! 👋';
        await whatsapp.sendMessage(`${cleanId}@c.us`, goodbyeText);

        await flow.resetSession(cleanId);
      }
      this.timers.delete(cleanId);
    } catch (error) {
      logger.error(`Error auto-closing session for ${cleanId}:`, error);
    }
  }
}

module.exports = new FollowUpService();
