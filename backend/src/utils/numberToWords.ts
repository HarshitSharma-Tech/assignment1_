/**
 * Converts monetary amount in paise to formal Indian Rupee words.
 * Handles Crores, Lakhs, Thousands, Hundreds, and Paise.
 */

const ONES: string[] = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS: string[] = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n > 0) {
    if (n < 20) {
      str += ONES[n] + ' ';
    } else {
      str += TENS[Math.floor(n / 10)];
      if (n % 10 > 0) {
        str += '-' + ONES[n % 10];
      }
      str += ' ';
    }
  }
  return str.trim();
}

export function amountPaiseToWords(amountPaise: number): string {
  if (amountPaise === 0) {
    return 'Zero Rupees Only';
  }

  const isNegative = amountPaise < 0;
  const absPaise = Math.abs(amountPaise);
  const rupees = Math.floor(absPaise / 100);
  const paise = absPaise % 100;

  let words = '';

  if (rupees > 0) {
    let remaining = rupees;

    // Crores (1 Crore = 10,000,000)
    const crores = Math.floor(remaining / 10000000);
    if (crores > 0) {
      words += convertBelowThousand(crores) + ' Crore ';
      remaining %= 10000000;
    }

    // Lakhs (1 Lakh = 100,000)
    const lakhs = Math.floor(remaining / 100000);
    if (lakhs > 0) {
      words += convertBelowThousand(lakhs) + ' Lakh ';
      remaining %= 100000;
    }

    // Thousands (1 Thousand = 1,000)
    const thousands = Math.floor(remaining / 1000);
    if (thousands > 0) {
      words += convertBelowThousand(thousands) + ' Thousand ';
      remaining %= 1000;
    }

    // Hundreds and below
    if (remaining > 0) {
      words += convertBelowThousand(remaining) + ' ';
    }

    words = words.trim() + (rupees === 1 ? ' Rupee' : ' Rupees');
  }

  if (paise > 0) {
    const paiseWords = convertBelowThousand(paise);
    if (rupees > 0) {
      words += ' and ' + paiseWords + ' Paise';
    } else {
      words += paiseWords + ' Paise';
    }
  }

  const result = (isNegative ? 'Minus ' : '') + words.trim() + ' Only';
  return result;
}
