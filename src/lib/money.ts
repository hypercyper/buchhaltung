// Money helpers. Amounts are integer cents everywhere.

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const plain = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Parses German amount input: "45", "45,5", "45,50", "1.234,56", "1234.56", "45 €".
 * Returns cents (> 0) or null if invalid.
 */
export function parseAmount(input: string): number | null {
  let s = input.replace(/€|\s/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0) {
    // Comma is the decimal separator, dots are thousands separators.
    if (lastDot > lastComma) return null;
    if (!/^\d{1,3}(\.\d{3})*,\d{0,2}$|^\d+,\d{0,2}$/.test(s)) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    // Only dots: "1.234" = thousands, "12.5" / "12.50" = decimal.
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else if (!/^\d+\.\d{1,2}$/.test(s)) return null;
  }

  const [whole, frac = ''] = s.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}

/** "45,50" – for prefilling input fields. */
export function centsToInput(cents: number): string {
  return plain.format(cents / 100).replace(/\./g, '');
}

/** Signed display: "+45,00 €" / "−12,00 €". */
export function formatSigned(cents: number, type: 'einnahme' | 'ausgabe'): string {
  return `${type === 'einnahme' ? '+' : '−'}${formatEuro(cents)}`;
}
