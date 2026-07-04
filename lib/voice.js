import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER; // Your Twilio number
const SERVER_URL = process.env.SERVER_URL; // Your Railway URL

/**
 * Make an outbound call and speak a message
 * @param {string} to - Phone number with country code (e.g. +919876543210)
 * @param {string} message - What Jarvis should say on the call
 * @param {string} recipientName - Name of the person being called
 * @param {object} options - Optional: voice, language, record
 */
export async function makeCall(to, message, recipientName = "", options = {}) {
  const cleanPhone = "+" + to.replace(/[^0-9]/g, "");

  // Encode message for URL
  const params = new URLSearchParams({
    message,
    name: recipientName,
    voice: options.voice || "Polly.Aditi", // Indian English female voice
    lang: options.lang || "en-IN",
  });

  try {
    const call = await client.calls.create({
      to: cleanPhone,
      from: TWILIO_PHONE,
      url: `${SERVER_URL}/voice/speak?${params.toString()}`,
      statusCallback: `${SERVER_URL}/voice/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      // Record the call (optional, useful for verification)
      record: options.record || false,
      timeout: 30, // Ring for 30 seconds max
    });

    console.log(`📞 Call initiated to ${cleanPhone} (SID: ${call.sid})`);
    return {
      success: true,
      callSid: call.sid,
      status: call.status,
    };
  } catch (error) {
    console.error("Twilio call error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Make a call with interactive menu (press 1 to confirm, etc.)
 */
export async function makeInteractiveCall(to, message, recipientName = "", options = {}) {
  const cleanPhone = "+" + to.replace(/[^0-9]/g, "");

  const params = new URLSearchParams({
    message,
    name: recipientName,
    voice: options.voice || "Polly.Aditi",
    lang: options.lang || "en-IN",
    interactive: "true",
    callbackMessage: options.callbackMessage || "Thank you. Your response has been noted.",
  });

  try {
    const call = await client.calls.create({
      to: cleanPhone,
      from: TWILIO_PHONE,
      url: `${SERVER_URL}/voice/speak?${params.toString()}`,
      statusCallback: `${SERVER_URL}/voice/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      timeout: 30,
    });

    console.log(`📞 Interactive call to ${cleanPhone} (SID: ${call.sid})`);
    return { success: true, callSid: call.sid };
  } catch (error) {
    console.error("Twilio call error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate TwiML for speaking a message
 */
export function generateSpeakTwiml(message, voice = "Polly.Aditi", lang = "en-IN", interactive = false, callbackMessage = "") {
  // Use Twilio's built-in TTS (free) — Polly voices sound natural
  if (interactive) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/voice/gather-response" method="POST" timeout="10">
    <Say voice="${voice}" language="${lang}">${escapeXml(message)}</Say>
    <Say voice="${voice}" language="${lang}">Press 1 to confirm. Press 2 to decline. Press 9 to repeat.</Say>
  </Gather>
  <Say voice="${voice}" language="${lang}">No response received. Goodbye.</Say>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${lang}">${escapeXml(message)}</Say>
  <Pause length="1"/>
  <Say voice="${voice}" language="${lang}">This was an automated call from Jarvis. Goodbye.</Say>
</Response>`;
}

/**
 * Generate TwiML for gather response
 */
export function generateGatherResponseTwiml(digit, voice = "Polly.Aditi", lang = "en-IN", originalMessage = "") {
  if (digit === "9") {
    // Repeat
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/voice/gather-response" method="POST" timeout="10">
    <Say voice="${voice}" language="${lang}">${escapeXml(originalMessage)}</Say>
    <Say voice="${voice}" language="${lang}">Press 1 to confirm. Press 2 to decline. Press 9 to repeat.</Say>
  </Gather>
  <Say voice="${voice}" language="${lang}">No response received. Goodbye.</Say>
</Response>`;
  }

  const responses = {
    "1": "Thank you for confirming. This has been noted. Goodbye.",
    "2": "Understood, your decline has been noted. Goodbye.",
  };

  const responseText = responses[digit] || "Thank you for your response. Goodbye.";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${lang}">${escapeXml(responseText)}</Say>
</Response>`;
}

/**
 * Get available Polly voices for Indian languages
 */
export const VOICES = {
  "en-IN": [
    { id: "Polly.Aditi", name: "Aditi (Female, Indian English)" },
    { id: "Polly.Raveena", name: "Raveena (Female, Indian English)" },
  ],
  "hi-IN": [
    { id: "Polly.Aditi", name: "Aditi (Female, Hindi)" },
  ],
  "en-US": [
    { id: "Polly.Matthew", name: "Matthew (Male, US English)" },
    { id: "Polly.Joanna", name: "Joanna (Female, US English)" },
  ],
  "en-GB": [
    { id: "Polly.Brian", name: "Brian (Male, British English)" },
    { id: "Polly.Amy", name: "Amy (Female, British English)" },
  ],
};

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
