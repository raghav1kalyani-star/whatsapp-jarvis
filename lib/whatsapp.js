const WA_API = "https://graph.facebook.com/v21.0";

/**
 * Send a text message via WhatsApp Cloud API
 */
export async function sendMessage(to, text) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;

  // Ensure phone has country code, no + prefix
  const cleanPhone = to.replace(/[^0-9]/g, "");

  const res = await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "text",
      text: { body: text },
    }),
  });

  const data = await res.json();

  if (data.error) {
    console.error("WhatsApp send error:", data.error);
    return { success: false, error: data.error.message };
  }

  console.log(`✓ Message sent to ${cleanPhone}`);
  return { success: true, messageId: data.messages?.[0]?.id };
}

/**
 * Send a reply to the owner (yourself)
 */
export async function replyToOwner(text) {
  return sendMessage(process.env.OWNER_PHONE, text);
}

/**
 * Mark a message as read
 */
export async function markAsRead(messageId) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;

  await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  }).catch(() => {}); // Non-critical
}
