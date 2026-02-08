/**
 * Parsed email address representation.
 */
export interface ParsedEmailAddress {
  name: string | null;
  address: string;
}

/**
 * Parse email address with optional display name.
 */
export function parseEmailAddress(
  emailString: string | null | undefined
): ParsedEmailAddress | null {
  if (!emailString || typeof emailString !== 'string') {
    return null;
  }

  const normalizedEmail = emailString.trim();

  const nameEmailMatch = normalizedEmail.match(/^(.+?)\s*<([^>]+)>$/);
  if (nameEmailMatch) {
    const name = nameEmailMatch[1].replace(/^["']|["']$/g, '').trim();
    const address = nameEmailMatch[2].trim();
    return { name, address };
  }

  const emailMatch = normalizedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  if (emailMatch) {
    return { name: null, address: normalizedEmail };
  }

  return null;
}

/**
 * Format email address with optional display name.
 */
export function formatEmailAddress(
  address: string | null | undefined,
  name: string | null = null
): string {
  if (!address) {
    return '';
  }

  if (name) {
    return `${name} <${address}>`;
  }

  return address;
}

/**
 * Parse multiple addresses from comma or semicolon separated list.
 */
export function parseEmailList(
  emailListString: string | null | undefined
): ParsedEmailAddress[] {
  if (!emailListString) {
    return [];
  }

  const emails = emailListString
    .split(/[,;]/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  return emails
    .map((email) => parseEmailAddress(email))
    .filter((email): email is ParsedEmailAddress => email !== null);
}
