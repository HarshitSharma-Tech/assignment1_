import { prisma } from '../config/prisma';

export type ReceiptType = 'LOAN' | 'REPAYMENT';

export class ReceiptServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ReceiptServiceError.prototype);
  }
}

export interface ReceiptData {
  id: string;
  receiptNumber: string;
  loanId: string;
  receiptType: ReceiptType;
  lenderName: string;
  friendName: string;
  amountPaise: number;
  currency: string;
  status: string;
  loanDate: Date;
  dueDate: Date | null;
  repaidAt: Date | null;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: Date;
}

export class ReceiptService {
  /**
   * Retrieves an existing receipt or idempotently creates a new one with an
   * authoritative immutable snapshot and a concurrency-safe unique receipt number.
   */
  static async getOrCreateReceipt(
    loanId: string,
    userId: string,
    typeParam: string
  ): Promise<ReceiptData> {
    const normalizedType = (typeParam || '').toUpperCase().trim();
    if (normalizedType !== 'LOAN' && normalizedType !== 'REPAYMENT') {
      throw new ReceiptServiceError(
        `Invalid receipt type "${typeParam}". Supported types are "loan" and "repayment".`,
        400
      );
    }
    const receiptType = normalizedType as ReceiptType;

    // 1. Authoritative Loan Lookup & Access Verification
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { user: true },
    });

    if (!loan) {
      throw new ReceiptServiceError(`Loan with ID "${loanId}" not found.`, 404);
    }

    if (loan.userId !== userId) {
      throw new ReceiptServiceError(
        'Unauthorized: You do not have permission to access receipts for this loan.',
        403
      );
    }

    // 2. Business Rule Validation: Repayment Receipts require genuinely repaid loans
    if (receiptType === 'REPAYMENT') {
      if (loan.status !== 'REPAID') {
        throw new ReceiptServiceError(
          'Cannot generate a repayment receipt for an outstanding loan. The loan must be marked as repaid first.',
          400
        );
      }
      if (!loan.repaidAt) {
        throw new ReceiptServiceError(
          'Repayment timestamp is missing for this repaid loan record.',
          400
        );
      }
    }

    // 3. Idempotency Check: Retrieve existing receipt if already generated
    const existing = await prisma.receipt.findUnique({
      where: {
        loanId_receiptType: {
          loanId: loan.id,
          receiptType,
        },
      },
    });

    if (existing) {
      return {
        id: existing.id,
        receiptNumber: existing.receiptNumber,
        loanId: existing.loanId,
        receiptType: existing.receiptType as ReceiptType,
        lenderName: existing.snapshotLenderName,
        friendName: existing.snapshotFriendName,
        amountPaise: existing.snapshotAmountPaise,
        currency: existing.snapshotCurrency,
        status: existing.snapshotStatus,
        loanDate: existing.snapshotLoanDate,
        dueDate: existing.snapshotDueDate,
        repaidAt: existing.snapshotRepaidAt,
        paymentMethod: existing.snapshotPaymentMethod,
        notes: existing.snapshotNotes,
        createdAt: existing.createdAt,
      };
    }

    // 4. Concurrency-Safe Receipt Generation using Atomic Sequence and Snapshotting
    const createdReceipt = await prisma.$transaction(async (tx) => {
      // Re-verify existence inside transaction to avoid race conditions
      const raceExisting = await tx.receipt.findUnique({
        where: {
          loanId_receiptType: {
            loanId: loan.id,
            receiptType,
          },
        },
      });
      if (raceExisting) {
        return raceExisting;
      }

      // Atomic Sequence increment
      const sequence = await tx.sequenceTracker.upsert({
        where: { name: 'RECEIPT_SEQ' },
        update: { lastValue: { increment: 1 } },
        create: { name: 'RECEIPT_SEQ', lastValue: 1 },
      });

      const prefix = receiptType === 'LOAN' ? 'ML-LN' : 'ML-RP';
      const paddedSeq = String(sequence.lastValue).padStart(6, '0');
      const receiptNumber = `${prefix}-${paddedSeq}`;

      return tx.receipt.create({
        data: {
          receiptNumber,
          loanId: loan.id,
          receiptType,
          snapshotLenderName: loan.user.name || 'MiniLedger User',
          snapshotFriendName: loan.friendName,
          snapshotAmountPaise: loan.amountPaise,
          snapshotCurrency: loan.currency || 'INR',
          snapshotStatus: loan.status,
          snapshotLoanDate: loan.loanDate,
          snapshotDueDate: loan.dueDate,
          snapshotRepaidAt: loan.repaidAt,
          snapshotPaymentMethod: loan.paymentVerified ? loan.paymentMethod : null,
          snapshotNotes: loan.notes,
        },
      });
    });

    return {
      id: createdReceipt.id,
      receiptNumber: createdReceipt.receiptNumber,
      loanId: createdReceipt.loanId,
      receiptType: createdReceipt.receiptType as ReceiptType,
      lenderName: createdReceipt.snapshotLenderName,
      friendName: createdReceipt.snapshotFriendName,
      amountPaise: createdReceipt.snapshotAmountPaise,
      currency: createdReceipt.snapshotCurrency,
      status: createdReceipt.snapshotStatus,
      loanDate: createdReceipt.snapshotLoanDate,
      dueDate: createdReceipt.snapshotDueDate,
      repaidAt: createdReceipt.snapshotRepaidAt,
      paymentMethod: createdReceipt.snapshotPaymentMethod,
      notes: createdReceipt.snapshotNotes,
      createdAt: createdReceipt.createdAt,
    };
  }

  /**
   * Generates a safe, sanitized filename according to Section 4.
   * Example: MiniLedger-Loan-ML-LN-000001.pdf or MiniLedger-Repayment-ML-RP-000002.pdf
   */
  static getSafeFilename(receipt: ReceiptData): string {
    const typeLabel = receipt.receiptType === 'LOAN' ? 'Loan' : 'Repayment';
    const cleanNumber = receipt.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '');
    return `MiniLedger-${typeLabel}-${cleanNumber}.pdf`;
  }
}
