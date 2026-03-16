/**
 * Service to manage business hours logic.
 */
class BusinessHoursService {
  /**
   * Checks if current time is within business hours (08:00 - 18:00, Mon-Fri).
   * @returns {boolean}
   */
  isWithinBusinessHours() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();

    // Check if it's weekend
    if (day === 0 || day === 6) {
      return false;
    }

    // Check if it's between 08:00 and 18:00
    if (hour < 8 || hour >= 18) {
      return false;
    }

    return true;
  }
}

module.exports = new BusinessHoursService();
