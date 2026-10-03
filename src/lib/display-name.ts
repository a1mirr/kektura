// Spec 0024 AC-1: what the database constraint on profiles.display_name enforces (1 to 40 characters once
// trimmed, no control characters). The actions check it first so a bad name never needs a database round trip.
export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 40 && !/[\u0000-\u001f\u007f-\u009f]/.test(name);
}
