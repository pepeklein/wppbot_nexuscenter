const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger.service');

/**
 * Service to handle Supabase database operations.
 */
class DatabaseService {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase credentials missing in environment variables');
      this.client = null;
    } else {
      this.client = createClient(supabaseUrl, supabaseKey);
      logger.info('Supabase client initialized');
    }
  }

  /**
   * Normalizes WhatsApp ID to just the number part.
   * Helps with @lid vs @c.us consistency.
   * @param {string} id - The WhatsApp ID string.
   * @returns {string} Just the number part.
   * @private
   */
  _normalizeId(id) {
    if (!id) return id;
    return id.split('@')[0];
  }

  /**
   * Saves or updates a user session in the database.
   * @param {string} phone - User's phone number.
   * @param {object} session - Session data to save.
   * @returns {Promise<void>}
   */
  async saveSession(phone, session) {
    if (!this.client) return;
    const cleanId = this._normalizeId(phone);

    try {
      const { error } = await this.client
        .from('sessions')
        .upsert({
          id: cleanId,
          state: session.state,
          data: session.data,
          retry_count: session.retryCount,
          updated_at: new Date()
        });

      if (error) throw error;
      logger.info(`DB: Session saved for ${cleanId} (State: ${session.state})`);
    } catch (err) {
      logger.error(`DB ERROR saving session for ${cleanId}: ${err.message}`);
    }
  }

  /**
   * Retrieves a user session from the database.
   * @param {string} phone - User's phone number.
   * @returns {Promise<object|null>} The session or null if not found.
   */
  async getSession(phone) {
    if (!this.client) return null;
    const cleanId = this._normalizeId(phone);

    try {
      const { data, error } = await this.client
        .from('sessions')
        .select('*')
        .eq('id', cleanId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        logger.info(`DB: Session found for ${cleanId} (State: ${data.state})`);
        return {
          state: data.state,
          data: data.data,
          retryCount: data.retry_count,
          isNew: false
        };
      }
      logger.info(`DB: No session found for ${cleanId}`);
      return null;
    } catch (err) {
      logger.error(`DB ERROR getting session for ${cleanId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Deletes a user session from the database.
   * @param {string} phone - User's phone number.
   * @returns {Promise<void>}
   */
  async deleteSession(phone) {
    if (!this.client) return;
    const cleanId = this._normalizeId(phone);

    try {
      // More robust delete: matches exact ID OR ID with any suffix (@c.us, @lid, etc.)
      const { data, error } = await this.client
        .from('sessions')
        .delete()
        .or(`id.eq.${cleanId},id.ilike.${cleanId}@%`)
        .select();

      if (error) throw error;
      logger.info(`DB: Session(s) deleted for ${cleanId}. Rows affected: ${data?.length || 0}`);
    } catch (err) {
      logger.error(`DB ERROR deleting session for ${cleanId}: ${err.message}`);
    }
  }

  /**
   * Saves a completed lead into the leads table.
   * @param {object} leadData - The lead information.
   * @returns {Promise<void>}
   */
  async saveLead(leadData) {
    if (!this.client) return;
    const cleanPhone = this._normalizeId(leadData.phone);

    try {
      const { error } = await this.client
        .from('leads')
        .insert({
          customer_name: leadData.name || 'Cliente',
          customer_phone: cleanPhone,
          department: leadData.department || 'Geral',
          description: leadData.description || '[Sem descrição]'
        });

      if (error) throw error;
    } catch (err) {
      logger.error(`Error saving lead for ${cleanPhone}: ${err.message}`);
    }
  }
}

module.exports = new DatabaseService();
