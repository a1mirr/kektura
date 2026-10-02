// Feedback rules shared by the form, the server action and their tests (spec 0017).

export const FEEDBACK_MAX = 2000; // characters; the same limit is a check constraint in the database

export type FeedbackValidation =
  | { ok: true; message: string }
  | { ok: false; reason: "invalid" | "empty" | "too_long" };

// Trimmed text with \n line endings. Length is counted in characters (code points), like Postgres'
// char_length, so an emoji counts once.
export function validateFeedback(raw: unknown): FeedbackValidation {
  if (typeof raw !== "string") return { ok: false, reason: "invalid" };
  const message = raw.replace(/\r\n?/g, "\n").trim();
  if (message === "") return { ok: false, reason: "empty" };
  if ([...message].length > FEEDBACK_MAX) return { ok: false, reason: "too_long" };
  return { ok: true, message };
}

export const characterCount = (text: string) => [...text.trim()].length;

// What the developer reads in Telegram: plain text, the page language, who sent it, then the message.
export function formatFeedbackNotification({
  message,
  locale,
  senderEmail,
}: {
  message: string;
  locale: string;
  senderEmail?: string | null;
}): string {
  return `New feedback (${locale})\nFrom: ${senderEmail || "anonymous"}\n\n${message}`;
}
