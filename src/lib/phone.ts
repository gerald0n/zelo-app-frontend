/** Normaliza celular brasileiro para E.164 (`+55…`). */
export function toPhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+${digits}`;
  }
  if (digits.length === 11 || digits.length === 10) {
    return `+55${digits}`;
  }
  if (digits.length === 12 || digits.length === 13) {
    return `+${digits}`;
  }
  return null;
}

export function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const national = digits.startsWith('55') ? digits.slice(2) : digits;
  const local = national.slice(0, 11);
  if (local.length <= 2) return local;
  if (local.length <= 7) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
}
