import { Platform } from 'react-native';
import { Loan, LoanSummary, ReceiptPreviewData, UserProfile } from '../types';

// Web dynamically adapts to current hostname; physical phones connect via LAN IP
const getBackendUrl = (): string => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:4000`;
  }
  return Platform.OS === 'web' ? 'http://localhost:4000' : 'http://192.168.29.18:4000';
};

export const BACKEND_URL = getBackendUrl();

export class ApiService {
  /**
   * Request a mock OTP for phone number login
   * (The OTP is printed to the Node.js backend server console log)
   */
  static async sendOtp(phone: string): Promise<{ success: boolean; message: string; phone: string; mockOtp?: string }> {
    const res = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Failed to send OTP');
    return data;
  }

  /**
   * Verify mock OTP code and receive JWT authentication token
   */
  static async verifyOtp(
    phone: string,
    otp: string,
    name?: string
  ): Promise<{ success: boolean; token: string; user: UserProfile }> {
    const res = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Failed to verify OTP');
    return data;
  }

  /**
   * Email/password login (legacy fallback)
   */
  static async login(email: string, password: string) {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Login failed');
    return data;
  }

  /**
   * Fetch financial summary: total lent, total repaid, overdue amount
   * (Assignment requirement endpoint)
   */
  static async fetchSummary(token: string): Promise<LoanSummary> {
    const res = await fetch(`${BACKEND_URL}/api/loans/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch loan summary');
    return data.summary;
  }

  /**
   * Fetch all loans belonging to authenticated user
   */
  static async fetchLoans(token: string): Promise<Loan[]> {
    const res = await fetch(`${BACKEND_URL}/api/loans`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch loans');
    return data.loans;
  }

  /**
   * Fetch single loan details
   */
  static async fetchLoanDetails(id: string, token: string): Promise<Loan> {
    const res = await fetch(`${BACKEND_URL}/api/loans/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch loan details');
    return data.loan;
  }

  /**
   * Create a new loan entry (friend name, amount, due date, receipt image)
   */
  static async createLoan(
    payload: {
      friendName: string;
      amountRupees: number;
      dueDate?: string | null;
      notes?: string;
      paymentMethod?: string;
      paymentVerified?: boolean;
      receiptImage?: string | null;
    },
    token: string
  ): Promise<Loan> {
    const res = await fetch(`${BACKEND_URL}/api/loans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to create loan');
    return data.loan;
  }

  /**
   * Mark a loan as settled / repaid
   */
  static async markLoanRepaid(id: string, paymentMethod: string, token: string): Promise<Loan> {
    const res = await fetch(`${BACKEND_URL}/api/loans/${id}/repay`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ paymentMethod, repaidAt: new Date().toISOString() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to mark loan as repaid');
    return data.loan;
  }

  /**
   * Attach/update a photo of a receipt on an existing loan (Bonus feature)
   */
  static async uploadReceiptPhoto(loanId: string, receiptImage: string, token: string): Promise<Loan> {
    const res = await fetch(`${BACKEND_URL}/api/loans/${loanId}/receipt-image`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ receiptImage }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to attach receipt photo');
    return data.loan;
  }

  /**
   * Fetch receipt preview metadata for native modal preview
   */
  static async fetchReceiptPreview(
    loanId: string,
    type: 'loan' | 'repayment',
    token: string
  ): Promise<ReceiptPreviewData> {
    const res = await fetch(`${BACKEND_URL}/api/loans/${loanId}/receipt/preview?type=${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to generate receipt preview');
    return data.receipt;
  }
}
