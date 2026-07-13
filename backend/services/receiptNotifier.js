const { Installment, Sale, Customer, Product } = require("../models");
const logActivity = require("../utils/activityLogger");
const { generateInstallmentReceiptPdf } = require("./receiptPdfService");
const { uploadReceiptPdf } = require("./supabaseStorage");
const { sendReceiptWhatsApp } = require("./whatsappService");
const { toE164 } = require("../utils/phone");

// Sends the installment/advance receipt to the customer's WhatsApp. Never
// throws - a Twilio/Supabase failure must not affect the payment that
// already succeeded and committed. Callers get back { sent, error } so the
// UI can surface a retry.
const sendInstallmentReceiptWhatsApp = async (installmentId, { req } = {}) => {
  try {
    const installment = await Installment.findByPk(installmentId, {
      include: [
        {
          model: Sale,
          as: "sale",
          include: [{ model: Product, as: "product" }],
        },
        { model: Customer, as: "customer" },
      ],
    });

    if (!installment) {
      return { sent: false, error: "Installment not found" };
    }

    const customer = installment.customer;
    if (!customer?.phone) {
      return { sent: false, error: "Customer has no phone number on file" };
    }

    const toPhone = toE164(customer.phone);

    const allInstallments = await Installment.findAll({
      where: { saleId: installment.saleId },
      raw: true,
    });

    const pdfBuffer = await generateInstallmentReceiptPdf({
      installment,
      sale: installment.sale,
      customer,
      allInstallments,
    });

    const pdfUrl = await uploadReceiptPdf(
      pdfBuffer,
      `receipt-${installment.id}-${Date.now()}.pdf`
    );

    await sendReceiptWhatsApp({
      toPhone,
      customerName: customer.name,
      amountPaid: installment.paidAmount,
      remainingBalance: installment.sale?.remainingAmount,
      pdfUrl,
    });

    if (req) {
      await logActivity({
        req,
        action: "whatsapp_receipt",
        module: "installments",
        recordId: installment.id,
        description: `Sent WhatsApp receipt to ${customer.phone}`,
      });
    }

    return { sent: true };
  } catch (error) {
    console.error("WhatsApp receipt send failed:", error.message);
    return { sent: false, error: error.message };
  }
};

module.exports = { sendInstallmentReceiptWhatsApp };
