const { createClient } = require("@supabase/supabase-js");

const RECEIPTS_BUCKET = "receipts";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h - plenty for Twilio to fetch it

let client;

const getClient = () => {
  if (!client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are not configured"
      );
    }
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return client;
};

// Uploads a receipt PDF to a private bucket and returns a short-lived signed
// URL - Twilio needs a public URL to fetch the media from when sending.
const uploadReceiptPdf = async (buffer, filename) => {
  const supabase = getClient();

  const { error: uploadError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(filename, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }

  const { data, error: signError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(filename, SIGNED_URL_TTL_SECONDS);

  if (signError) {
    throw new Error(`Supabase signed URL failed: ${signError.message}`);
  }

  return data.signedUrl;
};

module.exports = { uploadReceiptPdf };
