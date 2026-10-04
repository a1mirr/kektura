// The decisions of the uptime check (spec 0066): when a failed run is worth a message, and what the message says.

/** A run that counts as down. A cancelled or skipped run says nothing about the site. */
const failed = (conclusion) => conclusion === "failure" || conclusion === "timed_out";

/**
 * Whether the run that just failed is the second failure in a row, so the owner is told once per outage: not for a
 * single failed run (a blip), and not again while an outage that was already announced goes on.
 *
 * `previous` is the conclusions of the completed runs before this one, newest first, comma separated (the shell's
 * `gh run list ... | join(",")`), or `unknown` when they could not be read. Not knowing is a reason to tell, not to
 * keep quiet: a message that was not needed costs less than an outage nobody heard about.
 * @param {string | undefined} previous
 */
export function shouldAlert(previous) {
  const text = (previous ?? "unknown").trim();
  if (text === "") return false; // no earlier run: this is the first failure
  if (text === "unknown") return true;
  const [last, before] = text.split(",").map((conclusion) => conclusion.trim());
  return failed(last) && !failed(before);
}

/** The message. It names only the run: no URL of the site's checks, no token. */
export function alertMessage({ runUrl }) {
  return `Production looks down: the uptime check failed on two runs in a row (about 15 minutes apart). What failed is in the run's log: ${runUrl}`;
}
