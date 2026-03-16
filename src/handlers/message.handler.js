const whatsapp = require('../services/whatsapp.service');
const flow = require('../services/flow.service');
const followUp = require('../services/follow-up.service');
require('dotenv').config();

/**
 * Main handler for incoming WhatsApp messages.
 */
class MessageHandler {
  /**
   * Processes an incoming message.
   * @param {object} msg - The WhatsApp message object.
   * @returns {Promise<void>}
   */
  async handle(msg) {
    const body = msg.body;
    const isStatus = msg.isStatus || false;
    const fromMe = msg.fromMe || false;

    if (isStatus || !body) return;

    // Cancel any pending follow-up as the user reacted
    const customerId = fromMe ? msg.to : msg.from;
    followUp.cancelTimer(customerId);

    // If message is from the consultant (fromMe)
    if (fromMe) {
      const customerId = msg.to; // In fromMe messages, 'to' is the customer
      const session = flow.getSession(customerId);

      // Trigger to end conversation professionally
      if (body.trim().toLowerCase() === '/fim') {
        const goodbyeText =
          '✅ *Atendimento Finalizado pela Nexus Center.*\n\nAgradecemos o seu contato! Se precisar de algo mais no futuro, basta nos enviar uma nova mensagem. Tenha um excelente dia! 👋';
        await whatsapp.sendMessage(customerId, goodbyeText);

        flow.resetSession(customerId);
        followUp.cancelTimer(customerId);

        try {
          await msg.delete(true);
        } catch (e) {
          // Ignore
        }
        return;
      }

      // AUTO-SILENCE: If a human sends any message, set bot to handoff
      if (session.state !== 'handoff') {
        session.state = 'handoff';
      }
      return;
    }

    // Handle customer flow
    await this._handleCustomerFlow(msg);
  }

  /**
   * Handles the automated customer menu flow.
   * @param {object} msg - The message object.
   * @private
   */
  async _handleCustomerFlow(msg) {
    const response = flow.handleMessage(msg.from, msg.body);

    if (response) {
      // 1. Show "typing..." status
      await whatsapp.sendTyping(msg.from);

      // 2. Wait for 2 seconds (human-like delay)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 3. Send the message
      await whatsapp.sendMessage(msg.from, response);

      // 4. Schedule follow-up if conversation is still active
      const session = flow.getSession(msg.from);
      if (session.state !== 'completed' && session.state !== 'handoff') {
        followUp.scheduleFollowUp(msg.from);
      }

      // If the session just finished (description provided), notify admin
      if (session.state === 'completed' && process.env.ADMIN_TARGET_NUMBER) {
        // Fetch contact details for a professional notification
        const contact = await msg.getContact();
        const contactName = contact.pushname || 'Cliente';
        const contactNumber = contact.number;

        const adminMsg = `🆕 *Nova Solicitação*\n\n*Nome:* ${contactName}\n*Telefone:* +${contactNumber}\n*Departamento:* ${session.data.selection}\n*Descrição:* ${session.data.description}`;
        await whatsapp.sendMessage(process.env.ADMIN_TARGET_NUMBER, adminMsg);

        // Set to handoff so the bot stays silent for this customer from now on
        session.state = 'handoff';
      }
    }
  }
}

module.exports = new MessageHandler();
