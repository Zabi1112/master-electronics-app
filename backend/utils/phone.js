// Normalizes a stored customer phone number to E.164 for WhatsApp/Twilio.
// Customer numbers are entered in local Pakistani format (03XXXXXXXXX);
// numbers already in international format are passed through unchanged.
const toE164 = (phone) => {
  if (!phone) return null;

  const digits = String(phone).replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `+92${digits.slice(1)}`;
  }

  if (digits.startsWith("92")) {
    return `+${digits}`;
  }

  return `+92${digits}`;
};

module.exports = { toE164 };
