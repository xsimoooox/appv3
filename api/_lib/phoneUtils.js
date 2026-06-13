export function normalizePhoneNumber(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  
  // Extract only digits
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (trimmed.startsWith('+')) {
    // Strip leading zero after known country codes
    if (digits.startsWith('2120') && digits.length >= 12) {
      digits = '212' + digits.slice(4);
    } else if (digits.startsWith('330') && digits.length >= 11) {
      digits = '33' + digits.slice(3);
    } else if (digits.startsWith('2130') && digits.length >= 12) {
      digits = '213' + digits.slice(4);
    } else if (digits.startsWith('2160') && digits.length >= 12) {
      digits = '216' + digits.slice(4);
    } else if (digits.startsWith('9660') && digits.length >= 12) {
      digits = '966' + digits.slice(4);
    } else if (digits.startsWith('9710') && digits.length >= 12) {
      digits = '971' + digits.slice(4);
    } else if (digits.startsWith('440') && digits.length >= 11) {
      digits = '44' + digits.slice(3);
    }
    return `+${digits}`;
  }

  // Handle formats without '+' prefix
  if (digits.startsWith('212')) {
    if (digits.startsWith('2120') && digits.length >= 12) {
      return `+212${digits.slice(4)}`;
    }
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length >= 9) {
    return `+212${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `+212${digits}`;
  }
  return `+${digits}`;
}
