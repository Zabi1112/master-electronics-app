const twilio = require("twilio");

let client;

const getClient = () => {
  if (!client) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error(
        "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are not configured"
      );
    }
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return client;
};

// Freeform message body - works in the WhatsApp sandbox and within an open
// 24h customer session. Once a production WhatsApp sender is approved,
// business-initiated sends outside that window will need an approved
// Content Template instead; swap the `body` send for a contentSid/contentVariables
// call here without touching callers.
const sendReceiptWhatsApp = async ({
  toPhone,
  customerName,
  amountPaid,
  remainingBalance,
  pdfUrl,
}) => {
  if (!process.env.TWILIO_WHATSAPP_FROM) {
    throw new Error("TWILIO_WHATSAPP_FROM is not configured");
  }
  if (!toPhone) {
    throw new Error("Customer phone number is missing");
  }

  const body =
    `Hi ${customerName || "there"}, we received your payment of ` +
    `Rs. ${Number(amountPaid || 0).toLocaleString()}. ` +
    `Remaining balance: Rs. ${Number(remainingBalance || 0).toLocaleString()}. ` +
    `Your receipt is attached. - Master Electronics`;

  return getClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${toPhone}`,
    body,
    mediaUrl: [pdfUrl],
  });
};

module.exports = { sendReceiptWhatsApp };
