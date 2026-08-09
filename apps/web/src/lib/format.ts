const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrCompactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Full INR amount with Indian digit grouping, e.g. ₹1,20,00,000. */
export function formatInr(amount: number): string {
  return inrFormatter.format(amount);
}

/** Compact INR for chart axes, e.g. ₹1.2 Cr. */
export function formatInrCompact(amount: number): string {
  return inrCompactFormatter.format(amount);
}
