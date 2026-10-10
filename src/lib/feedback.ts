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

// The address carries a stamp code and nothing else; the stamp's name comes from the seed on the server, so no link
// can put words into the form.
const STAMP_CODE = /^OKTPH_[0-9A-Za-z_]+$/;

export const parseStampCode = (raw: unknown): string | null => (typeof raw === "string" && STAMP_CODE.test(raw) ? raw : null);

export const stampPrefix = (stamp: { code: string; name: string }) => `Stamp: ${stamp.name} (${stamp.code})\n\n`;

export const messageLimit = (stamp?: { code: string; name: string } | null) => FEEDBACK_MAX - (stamp ? [...stampPrefix(stamp)].length : 0);
