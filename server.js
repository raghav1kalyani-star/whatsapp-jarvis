import express from "express";
import { processMessage } from "./lib/claude.js";
import { sendMessage, replyToOwner, markAsRead } from "./lib/whatsapp.js";
import {
  makeCall,
  makeInteractiveCall,
  generateSpeakTwiml,
  generateGatherResponseTwiml,
} from "./lib/voice.js";
import {
  getMemories, addMemory,
  getContacts, findContact, addContact,
  getReminders, addReminder, markReminderDone,
  getTasks, addTask, completeTask,
  addChatMessage, getChatHistory,
  logSentMessage,
  logCall, updateCallStatus, getCallLog,
} from "./lib/storage.js";
import { startScheduler } from "./lib/scheduler.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Twilio sends form-encoded

const PORT = process.env.PORT || 3000;
const OWNER_PHONE = process.env.OWNER_PHONE;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// Track processed message IDs to prevent duplicates
const processedMessages = new Set();

// ════════════════════════════════════════════════════════════
//  WHATSAPP WEBHOOK
// ════════════════════════════════════════════════════════════

// Webhook verification (Meta requires this)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✓ Webhook verified");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Incoming WhatsApp messages
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Always respond 200 immediately

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.[0]) return;

    const msg = value.messages[0];
    const from = msg.from;
    const msgId = msg.id;
    const text = msg.text?.body?.trim();

    if (!text) return;
    if (processedMessages.has(msgId)) return;
    processedMessages.add(msgId);
    if (processedMessages.size > 500) {
      const arr = [...processedMessages];
      arr.slice(0, arr.length - 500).forEach((id) => processedMessages.delete(id));
    }

    // Security: only respond to the owner
    if (from !== OWNER_PHONE) {
      console.log(`⚠ Ignored message from non-owner: ${from}`);
      return;
    }

    console.log(`← You: ${text}`);
    await markAsRead(msgId);
    await addChatMessage("user", text);

    // Load context
    const [memories, reminders, tasks, contacts] = await Promise.all([
      getMemories(),
      getReminders(true),
      getTasks(false),
      getContacts(),
    ]);

    // Process with Claude
    const { reply, commands } = await processMessage(text, memories, reminders, tasks, contacts);

    // Execute commands
    const commandResults = [];
    for (const cmd of commands) {
      try {
        const result = await executeCommand(cmd, contacts);
        if (result) commandResults.push(result);
      } catch (err) {
        console.error(`Command error (${cmd.action}):`, err.message);
      }
    }

    // Build final reply
    let finalReply = reply;
    if (commandResults.length > 0) {
      finalReply += "\n\n" + commandResults.join("\n");
    }

    await replyToOwner(finalReply);
    await addChatMessage("assistant", finalReply);
    console.log(`→ Jarvis: ${finalReply.substring(0, 100)}...`);
  } catch (error) {
    console.error("Webhook processing error:", error);
    await replyToOwner("⚠ Something went wrong processing that. Try again.").catch(() => {});
  }
});

// ════════════════════════════════════════════════════════════
//  VOICE CALL ROUTES (Twilio webhooks)
// ════════════════════════════════════════════════════════════

// Twilio calls this URL when the call connects — tells it what to say
app.get("/voice/speak", (req, res) => {
  const { message, voice, lang, interactive } = req.query;

  const twiml = generateSpeakTwiml(
    message || "Hello, this is Jarvis.",
    voice || "Polly.Aditi",
    lang || "en-IN",
    interactive === "true"
  );

  res.type("text/xml").send(twiml);
});

app.post("/voice/speak", (req, res) => {
  const { message, voice, lang, interactive } = req.query;

  const twiml = generateSpeakTwiml(
    message || "Hello, this is Jarvis.",
    voice || "Polly.Aditi",
    lang || "en-IN",
    interactive === "true"
  );

  res.type("text/xml").send(twiml);
});

// Handle keypress responses from interactive calls
app.post("/voice/gather-response", async (req, res) => {
  const digit = req.body.Digits;
  const callSid = req.body.CallSid;
  const voice = req.query.voice || "Polly.Aditi";
  const lang = req.query.lang || "en-IN";
  const originalMessage = req.query.message || "";

  console.log(`📞 Call ${callSid}: Recipient pressed ${digit}`);

  // Map digit to response
  const responseMap = { "1": "confirmed", "2": "declined", "9": "repeat" };
  const response = responseMap[digit] || `pressed-${digit}`;

  // Update call log
  if (response !== "repeat") {
    await updateCallStatus(callSid, "completed", 0, response);

    // Notify owner on WhatsApp
    const callLog = await getCallLog(callSid);
    const name = callLog?.recipient_name || "Unknown";
    const emoji = response === "confirmed" ? "✅" : "❌";
    await replyToOwner(`${emoji} ${name} ${response} your call.\n\nOriginal message: "${callLog?.message || "N/A"}"`);
  }

  const twiml = generateGatherResponseTwiml(digit, voice, lang, originalMessage);
  res.type("text/xml").send(twiml);
});

// Call status updates from Twilio
app.post("/voice/status", async (req, res) => {
  res.sendStatus(200);

  const { CallSid, CallStatus, CallDuration } = req.body;
  console.log(`📞 Call ${CallSid}: ${CallStatus} (${CallDuration || 0}s)`);

  try {
    await updateCallStatus(CallSid, CallStatus, parseInt(CallDuration || 0));

    // Notify owner if call failed
    if (["busy", "no-answer", "failed", "canceled"].includes(CallStatus)) {
      const callLog = await getCallLog(CallSid);
      const name = callLog?.recipient_name || "Unknown";
      await replyToOwner(`📞 Call to ${name}: ${CallStatus.replace("-", " ").toUpperCase()}\nI'll try messaging them instead if you want.`);
    }

    // Notify owner when simple (non-interactive) call completes
    if (CallStatus === "completed") {
      const callLog = await getCallLog(CallSid);
      if (callLog && callLog.call_type === "simple" && !callLog.recipient_response) {
        await replyToOwner(`📞 Call to ${callLog.recipient_name} completed (${CallDuration}s).`);
      }
    }
  } catch (err) {
    console.error("Status update error:", err.message);
  }
});

// ════════════════════════════════════════════════════════════
//  COMMAND EXECUTION
// ════════════════════════════════════════════════════════════

async function executeCommand(cmd, existingContacts) {
  switch (cmd.action) {
    case "remember": {
      if (!cmd.text) return null;
      await addMemory(cmd.text, cmd.category || "general");
      return "✓ Remembered.";
    }

    case "remind": {
      if (!cmd.text || !cmd.due) return null;
      await addReminder(cmd.text, cmd.due);
      const dueDate = new Date(cmd.due).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
      return `✓ Reminder set for ${dueDate}`;
    }

    case "add_task": {
      if (!cmd.text) return null;
      await addTask(cmd.text);
      return "✓ Task added.";
    }

    case "complete_task": {
      if (!cmd.task_id) return null;
      await completeTask(cmd.task_id);
      return "✓ Task completed.";
    }

    case "mark_reminder_done": {
      if (!cmd.reminder_id) return null;
      await markReminderDone(cmd.reminder_id);
      return "✓ Reminder marked done.";
    }

    case "add_contact": {
      if (!cmd.name || !cmd.phone) return null;
      await addContact(cmd.name, cmd.phone, cmd.label || "");
      return `✓ Contact saved: ${cmd.name} (${cmd.phone})`;
    }

    case "send_message": {
      if (!cmd.contact_name || !cmd.message) return null;

      const matches = await findContact(cmd.contact_name);
      if (matches.length === 0) {
        return `⚠ Contact "${cmd.contact_name}" not found. Add them first: "add contact ${cmd.contact_name} 91XXXXXXXXXX"`;
      }

      const contact = matches[0];
      const result = await sendMessage(contact.phone, cmd.message);

      if (result.success) {
        await logSentMessage(contact.name, contact.phone, cmd.message, "sent");
        return `✓ Message sent to ${contact.name}`;
      } else {
        await logSentMessage(contact.name, contact.phone, cmd.message, "failed");
        return `⚠ Failed to send to ${contact.name}: ${result.error}`;
      }
    }

    case "call": {
      if (!cmd.contact_name || !cmd.message) return null;

      const matches = await findContact(cmd.contact_name);
      if (matches.length === 0) {
        return `⚠ Contact "${cmd.contact_name}" not found. Add them first: "add contact ${cmd.contact_name} 91XXXXXXXXXX"`;
      }

      const contact = matches[0];
      const isInteractive = cmd.interactive === true;

      let result;
      if (isInteractive) {
        result = await makeInteractiveCall(contact.phone, cmd.message, contact.name);
      } else {
        result = await makeCall(contact.phone, cmd.message, contact.name);
      }

      if (result.success) {
        await logCall(result.callSid, contact.name, contact.phone, cmd.message, isInteractive ? "interactive" : "simple");
        return `📞 Calling ${contact.name}...`;
      } else {
        return `⚠ Failed to call ${contact.name}: ${result.error}`;
      }
    }

    default:
      return null;
  }
}

// ════════════════════════════════════════════════════════════
//  UTILITY ROUTES
// ════════════════════════════════════════════════════════════

app.get("/", (req, res) => {
  res.json({
    status: "running",
    name: "Jarvis WhatsApp + Voice Assistant",
    uptime: Math.floor(process.uptime()) + "s",
    capabilities: ["chat", "memory", "reminders", "tasks", "messaging", "voice-calls"],
  });
});

app.get("/status", async (req, res) => {
  try {
    const [memories, reminders, tasks, contacts] = await Promise.all([
      getMemories(),
      getReminders(true),
      getTasks(false),
      getContacts(),
    ]);
    res.json({
      memories: memories.length,
      activeReminders: reminders.length,
      pendingTasks: tasks.length,
      contacts: contacts.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🤖 JARVIS — WhatsApp + Voice Assistant     ║
║   Port: ${PORT}                                  ║
║   Owner: ${OWNER_PHONE || "NOT SET"}                  ║
║   Capabilities:                              ║
║     ✓ Chat + Memory + Reminders + Tasks      ║
║     ✓ WhatsApp messaging on your behalf      ║
║     ✓ Voice calls on your behalf             ║
╚══════════════════════════════════════════════╝
  `);
  startScheduler();
});
