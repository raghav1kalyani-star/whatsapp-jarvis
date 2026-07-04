import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── Memories ──
export async function getMemories(limit = 50) {
  const { data } = await supabase
    .from("memories")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export async function addMemory(text, category = "general") {
  const { data, error } = await supabase
    .from("memories")
    .insert({ text, category })
    .select()
    .single();
  if (error) console.error("addMemory error:", error.message);
  return data;
}

export async function deleteMemory(id) {
  await supabase.from("memories").delete().eq("id", id);
}

// ── Contacts ──
export async function getContacts() {
  const { data } = await supabase
    .from("contacts")
    .select("*")
    .order("name");
  return data || [];
}

export async function findContact(name) {
  const { data } = await supabase
    .from("contacts")
    .select("*")
    .ilike("name", `%${name}%`)
    .limit(3);
  return data || [];
}

export async function addContact(name, phone, label = "") {
  // Normalize phone: ensure country code, digits only
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const { data, error } = await supabase
    .from("contacts")
    .insert({ name, phone: cleanPhone, label })
    .select()
    .single();
  if (error) console.error("addContact error:", error.message);
  return data;
}

export async function deleteContact(id) {
  await supabase.from("contacts").delete().eq("id", id);
}

// ── Reminders ──
export async function getReminders(onlyPending = true) {
  let query = supabase
    .from("reminders")
    .select("*")
    .order("due_at", { ascending: true });
  if (onlyPending) query = query.eq("done", false);
  const { data } = await query.limit(50);
  return data || [];
}

export async function addReminder(text, dueAt) {
  const { data, error } = await supabase
    .from("reminders")
    .insert({ text, due_at: dueAt })
    .select()
    .single();
  if (error) console.error("addReminder error:", error.message);
  return data;
}

export async function markReminderDone(id) {
  await supabase
    .from("reminders")
    .update({ done: true, notified: true })
    .eq("id", id);
}

export async function getDueReminders() {
  const { data } = await supabase
    .from("reminders")
    .select("*")
    .eq("done", false)
    .eq("notified", false)
    .lte("due_at", new Date().toISOString());
  return data || [];
}

export async function markNotified(id) {
  await supabase
    .from("reminders")
    .update({ notified: true })
    .eq("id", id);
}

// ── Tasks ──
export async function getTasks(includeCompleted = false) {
  let query = supabase.from("tasks").select("*").order("created_at");
  if (!includeCompleted) query = query.eq("done", false);
  const { data } = await query.limit(50);
  return data || [];
}

export async function addTask(text) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ text })
    .select()
    .single();
  if (error) console.error("addTask error:", error.message);
  return data;
}

export async function completeTask(id) {
  await supabase.from("tasks").update({ done: true }).eq("id", id);
}

export async function deleteTask(id) {
  await supabase.from("tasks").delete().eq("id", id);
}

// ── Chat History ──
export async function getChatHistory(limit = 20) {
  const { data } = await supabase
    .from("chat_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).reverse();
}

export async function addChatMessage(role, content) {
  await supabase.from("chat_history").insert({ role, content });
  // Prune old messages (keep last 100)
  const { data } = await supabase
    .from("chat_history")
    .select("id")
    .order("created_at", { ascending: false })
    .range(100, 10000);
  if (data && data.length > 0) {
    const ids = data.map((d) => d.id);
    await supabase.from("chat_history").delete().in("id", ids);
  }
}

// ── Sent Messages Log ──
export async function logSentMessage(recipientName, recipientPhone, message, status = "sent") {
  await supabase
    .from("sent_messages")
    .insert({ recipient_name: recipientName, recipient_phone: recipientPhone, message, status });
}

// ── Call Logs ──
export async function logCall(callSid, recipientName, recipientPhone, message, callType = "simple") {
  const { data, error } = await supabase
    .from("call_logs")
    .insert({
      call_sid: callSid,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      message,
      call_type: callType,
      status: "initiated",
    })
    .select()
    .single();
  if (error) console.error("logCall error:", error.message);
  return data;
}

export async function updateCallStatus(callSid, status, duration = 0, recipientResponse = null) {
  const update = { status, duration_seconds: duration };
  if (recipientResponse) update.recipient_response = recipientResponse;
  await supabase.from("call_logs").update(update).eq("call_sid", callSid);
}

export async function getCallLog(callSid) {
  const { data } = await supabase
    .from("call_logs")
    .select("*")
    .eq("call_sid", callSid)
    .single();
  return data;
}

export async function getRecentCalls(limit = 10) {
  const { data } = await supabase
    .from("call_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export default supabase;
