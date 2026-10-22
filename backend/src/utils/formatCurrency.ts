/**
 * Formats an amount in paise to standard Indian Rupee (INR) representation.
 * Example: 150000 paise -> "₹1,500.00"
 */
export function formatPaiseToINR(
  amountPaise: number,
  symbol: '₹' | 'Rs.' | 'INR' | 'none' = '₹'
): string {
  const rupees = amountPaise / 100;
  
  // Format using Indian Numbering System (e.g. 1,00,000.00)
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);

  if (symbol === 'none') return formatted;
  if (symbol === 'Rs.') return `Rs. ${formatted}`;
  if (symbol === 'INR') return `INR ${formatted}`;
  return `₹${formatted}`;
}
