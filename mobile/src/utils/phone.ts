export function normalizePhone(input: string) {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/\s/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("94")) return `+${digits}`;
  if (digits.startsWith("0")) return `+94${digits.slice(1)}`;
  return trimmed;
}
