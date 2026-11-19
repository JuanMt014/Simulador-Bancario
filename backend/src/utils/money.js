function decimalToCents(value) {
  const decimal = typeof value === 'number' ? String(value) : value;
  if (typeof decimal !== 'string') return null;
  const normalized = decimal.trim();
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(`${whole}${fraction.padEnd(2, '0')}`);
}

function normalizePositiveAmount(value) {
  const cents = decimalToCents(value);
  if (cents === null || cents <= 0n) return null;

  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, '0');
  return `${whole}.${fraction}`;
}

function addAmounts(left, right) {
  const cents = decimalToCents(left) + decimalToCents(right);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

function subtractAmounts(left, right) {
  const cents = decimalToCents(left) - decimalToCents(right);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

module.exports = { decimalToCents, normalizePositiveAmount, addAmounts, subtractAmounts };
