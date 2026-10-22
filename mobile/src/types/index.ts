export type LoanStatus = 'OUTSTANDING' | 'REPAID';
export type ReceiptType = 'LOAN' | 'REPAYMENT';

export interface ReceiptSummary {
  id: string;
  receiptNumber: string;
  receiptType: ReceiptType;
  createdAt: string;
}

export interface Loan {
  id: string;
  userId: string;
  friendName: string;
  amountPaise: number;
  currency: string;
  status: LoanStatus;
  loanDate: string;
  dueDate: string | null;
  repaidAt: string | null;
  paymentMethod: string | null;
  paymentVerified: boolean;
  notes: string | null;
  receiptImage?: string | null; // Bonus: Photo of a receipt attached to loan
  isOverdue?: boolean;          // Assignment: Overdue loan indicator
  createdAt: string;
  updatedAt: string;
  receipts?: ReceiptSummary[];
}

export interface LoanSummary {
  totalLent: number;
  totalRepaid: number;
  overdueAmount: number;
  outstandingAmount: number;
  totalLentPaise: number;
  totalRepaidPaise: number;
  overduePaise: number;
  outstandingPaise: number;
  totalCount: number;
  repaidCount: number;
  overdueCount: number;
  outstandingCount: number;
}

export interface ReceiptPreviewData {
  id: string;
  receiptNumber: string;
  loanId: string;
  receiptType: ReceiptType;
  lenderName: string;
  friendName: string;
  amountPaise: number;
  amountFormatted: string;
  amountInWords: string;
  currency: string;
  status: string;
  loanDate: string;
  dueDate: string | null;
  repaidAt: string | null;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  safeFilename: string;
  downloadUrl: string;
}

export interface UserProfile {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}
