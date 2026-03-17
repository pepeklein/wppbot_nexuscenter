const whatsapp = require('../services/whatsapp.service');
const flow = require('../services/flow.service');
const followUp = require('../services/follow-up.service');
const database = require('../services/database.service');
const logger = require('../services/logger.service');
const staffConfig = require('../config/staff.json');
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
    const from = msg.from;
    const to = msg.to;
    const cleanFrom = from.split('@')[0];
    const cleanTo = to ? to.split('@')[0] : null;

    logger.info(`[INCOMING] From: ${cleanFrom}, Body: "${body}"`);

    const isStatus = msg.isStatus || false;
    const fromMe = msg.fromMe || false;

    if (isStatus || !body) return;

    // Build staff list from config and env safely
    const rawStaffList = [
      ...(staffConfig.numbers || []),
      staffConfig.admin?.notificationNumber,
      process.env.ADMIN_TARGET_NUMBER
    ].filter(Boolean);

    const staffNumbers = [...new Set(rawStaffList.map((n) => n.split('@')[0]))];
    const isReset = body.trim().toLowerCase().startsWith('/fim') || 
                    body.trim().toLowerCase() === 'fim' ||
                    body.includes('Atendimento Finalizado pela Nexus Center');
    const isDebug = body.trim().toLowerCase() === '/debug';

    // The target of the reset/session is the customer
    const cleanTargetId = fromMe ? cleanTo : cleanFrom;

    // 1. Logic for reset command (/fim) - PRIORITIZED
    if (isReset) {
      const manualCommand = body.trim().toLowerCase().startsWith('/fim') || body.trim().toLowerCase() === 'fim';

      logger.info(`🚨 RESET detected from ${cleanFrom} for ${cleanTargetId} (Manual: ${manualCommand})`);
      
      // Only send goodbye if it was a manual command
      // Avoids infinite loop when bot sees its own goodbye message
      if (manualCommand) {
        try {
          const goodbyeText =
            '✅ *Atendimento Finalizado pela Nexus Center.*\n\nAgradecemos o seu contato! Se precisar de algo mais no futuro, basta nos enviar uma nova mensagem. Tenha um excelente dia! 👋';

          await whatsapp.sendMessage(fromMe ? to : from, goodbyeText);
        } catch (err) {
          logger.error(err, 'Failed to send goodbye message during reset');
        }
      }

      await flow.resetSession(cleanTargetId);
      followUp.cancelTimer(cleanTargetId);

      try {
        if (fromMe && manualCommand) await msg.delete(true);
      } catch (e) {
        // Ignore
      }
      return;
    }

    // Cancel any pending follow-up (standard activity)
    followUp.cancelTimer(cleanTargetId);

    // 2. Logic for consultant messages (Auto-Silence) - DISABLED
    // We previously had logic here to set 'handoff' if a human spoke from this account.
    // It was catching the bot's own messages and silencing it prematurely.
    if (fromMe) return;

    // 3. Logic for customers
    await this._handleCustomerFlow(msg, cleanFrom);
  }

  /**
   * Handles the automated customer menu flow.
   * @param {object} msg - The message object.
   * @private
   */
  async _handleCustomerFlow(msg, cleanFrom) {
    const response = await flow.handleMessage(cleanFrom, msg.body);

    if (response) {
      const from = msg.from;
      // 1. Show "typing..." status
      await whatsapp.sendTyping(from);

      // 2. Wait for 2 seconds (human-like delay)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 3. Send the message
      await whatsapp.sendMessage(from, response);

      // 4. Schedule follow-up if conversation is still active
      const session = await flow.getSession(cleanFrom);
      if (session.state !== 'completed' && session.state !== 'handoff') {
        followUp.scheduleFollowUp(cleanFrom);
      }

      // If the session just finished (description provided), notify admin
      if (session.state === 'completed' && process.env.ADMIN_TARGET_NUMBER) {
        // Fetch contact details for a professional notification
        const contact = await msg.getContact();
        const contactName = contact.pushname || 'Cliente';
        const contactNumber = contact.number;

        // Save Lead to Supabase
        await database.saveLead({
          name: contactName,
          phone: cleanFrom,
          department: session.data.selection,
          description: session.data.description
        });

        const adminMsg = `🆕 *Nova Solicitação*\n\n*Nome:* ${contactName}\n*Telefone:* +${contactNumber}\n*Departamento:* ${session.data.selection}\n*Descrição:* ${session.data.description}`;

        let adminTarget = process.env.ADMIN_TARGET_NUMBER || staffConfig.admin?.notificationNumber;
        if (adminTarget && !adminTarget.includes('@')) {
          adminTarget = `${adminTarget}@c.us`;
        }

        if (adminTarget) {
          try {
            logger.info(`Attempting admin notification to ${adminTarget}`);
            
            // 1. Resolve correct format (@c.us or @lid)
            const numberId = await whatsapp.client.getNumberId(adminTarget);
            const target = numberId ? numberId._serialized : adminTarget;

            // 2. Clear any cached "No LID" error by using the resolved ID
            const chat = await whatsapp.client.getChatById(target);
            await chat.sendMessage(adminMsg);
            
            logger.info(`✅ Admin notification sent successfully to ${target}`);
          } catch (err) {
            logger.error(`Failed admin notification: ${err.message}`);
            // Last ditch: try raw send if everything else failed
            try {
              await whatsapp.client.sendMessage(adminTarget, adminMsg);
            } catch (ignore) {}
          }
        }

        // Transition to 'handoff' so bot remains silent for manual consultant follow-up
        session.state = 'handoff';
        await database.saveSession(cleanFrom, session);
      }
    }
  }
}

module.exports = new MessageHandler();
