import type { Allowed } from "./accessibility";

// The accessibility violations that exist today (spec 0006 AC-12): each is a rule that axe reports with the impact
// "serious" or "critical" on a page. The list can only shrink: a test fails when an entry no longer fires, so it has to be
// deleted, and a violation that is not listed fails its test. Never add an entry to make a new violation pass: fix it.
export const ALLOWED: readonly Allowed[] = [];
