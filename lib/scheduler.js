import cron from "node-cron";
import { getDueReminders, markNotified } from "./storage.js";
import { replyToOwner } from "./whatsapp.js";

/**
 * Start the reminder checker — runs every minute
 */
export function startScheduler() {
  console.log("⏰ Reminder scheduler started (checks every 60s)");

  cron.schedule("* * * * *", async () => {
    try {
      const dueReminders = await getDueReminders();

      for (const reminder of dueReminders) {
        const msg = `⏰ REMINDER\n\n${reminder.text}\n\n(Set on ${new Date(reminder.created_at).toLocaleDateString("en-IN")})`;

        const result = await replyToOwner(msg);

        if (result.success) {
          await markNotified(reminder.id);
          console.log(`✓ Reminder sent: "${reminder.text}"`);
        } else {
          console.error(`✗ Failed to send reminder: ${result.error}`);
        }
      }
    } catch (error) {
      console.error("Scheduler error:", error.message);
    }
  });
}
