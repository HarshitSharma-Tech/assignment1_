import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/prisma';

export class LoanController {
  /**
   * GET /api/loans/summary
   * Returns a financial summary for the authenticated user:
   * - Total amount lent
   * - Total amount repaid
   * - Overdue amount (loans past due date and not yet repaid)
   * (Assignment Requirement: An endpoint that returns a summary: total lent, total repaid, overdue amount)
   */
  static async getSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const loans = await prisma.loan.findMany({
        where: { userId },
        select: {
          amountPaise: true,
          status: true,
          dueDate: true,
        },
      });

      const now = new Date();
      let totalLentPaise = 0;
      let totalRepaidPaise = 0;
      let overduePaise = 0;
      let outstandingPaise = 0;

      let totalCount = loans.length;
      let repaidCount = 0;
      let overdueCount = 0;
      let outstandingCount = 0;

      for (const loan of loans) {
        totalLentPaise += loan.amountPaise;

        if (loan.status === 'REPAID') {
          totalRepaidPaise += loan.amountPaise;
          repaidCount++;
        } else {
          // Status is OUTSTANDING
          outstandingPaise += loan.amountPaise;
          outstandingCount++;

          if (loan.dueDate && new Date(loan.dueDate) < now) {
            overduePaise += loan.amountPaise;
            overdueCount++;
          }
        }
      }

      res.status(200).json({
        success: true,
        summary: {
          // Rupee floating amounts for easy display
          totalLent: totalLentPaise / 100,
          totalRepaid: totalRepaidPaise / 100,
          overdueAmount: overduePaise / 100,
          outstandingAmount: outstandingPaise / 100,

          // Integer paise values for exact arithmetic precision
          totalLentPaise,
          totalRepaidPaise,
          overduePaise,
          outstandingPaise,

          // Transaction counts
          totalCount,
          repaidCount,
          overdueCount,
          outstandingCount,
        },
      });
    } catch (error) {
      console.error('Get Summary Error:', error);
      res.status(500).json({ error: 'Failed to compute financial summary' });
    }
  }

  /**
   * GET /api/loans
   * Lists all loans belonging to the authenticated user with overdue status and receipts.
   */
  static async listLoans(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const loans = await prisma.loan.findMany({
        where: { userId },
        include: {
          receipts: {
            select: {
              id: true,
              receiptNumber: true,
              receiptType: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const now = new Date();
      const enrichedLoans = loans.map((loan) => ({
        ...loan,
        isOverdue:
          loan.status === 'OUTSTANDING' && Boolean(loan.dueDate && new Date(loan.dueDate) < now),
      }));

      res.status(200).json({ success: true, loans: enrichedLoans });
    } catch (error) {
      console.error('List Loans Error:', error);
      res.status(500).json({ error: 'Failed to retrieve loans' });
    }
  }

  /**
   * GET /api/loans/:id
   * Retrieves single loan with ownership verification.
   */
  static async getLoanById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const loan = await prisma.loan.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          receipts: true,
        },
      });

      if (!loan) {
        res.status(404).json({ error: 'Not Found', message: 'Loan not found' });
        return;
      }

      if (loan.userId !== userId) {
        res.status(403).json({ error: 'Forbidden', message: 'Access denied to this loan record' });
        return;
      }

      const isOverdue =
        loan.status === 'OUTSTANDING' && Boolean(loan.dueDate && new Date(loan.dueDate) < new Date());

      res.status(200).json({ success: true, loan: { ...loan, isOverdue } });
    } catch (error) {
      console.error('Get Loan Error:', error);
      res.status(500).json({ error: 'Failed to retrieve loan' });
    }
  }

  /**
   * POST /api/loans
   * Creates a new loan entry (friend name, amount, due date). Amount is stored in integer paise.
   * Bonus: Supports attaching a receipt image.
   */
  static async createLoan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        friendName,
        amountRupees,
        amountPaise,
        dueDate,
        notes,
        paymentMethod,
        paymentVerified,
        receiptImage,
      } = req.body;

      if (!friendName || typeof friendName !== 'string' || !friendName.trim()) {
        res.status(400).json({ error: 'Bad Request', message: "Friend's name is required" });
        return;
      }

      // Convert rupees to paise if rupees provided, or use direct integer paise
      let finalPaise: number;
      if (typeof amountPaise === 'number' && Number.isInteger(amountPaise)) {
        finalPaise = amountPaise;
      } else if (typeof amountRupees === 'number' && !isNaN(amountRupees)) {
        finalPaise = Math.round(amountRupees * 100);
      } else {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Valid monetary amount (amountPaise or amountRupees) is required',
        });
        return;
      }

      if (finalPaise <= 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Loan amount must be greater than zero',
        });
        return;
      }

      let parsedDueDate: Date | null = null;
      if (dueDate) {
        parsedDueDate = new Date(dueDate);
        if (isNaN(parsedDueDate.getTime())) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid due date format. Please provide a valid date string.',
          });
          return;
        }
      }

      const newLoan = await prisma.loan.create({
        data: {
          userId,
          friendName: friendName.trim(),
          amountPaise: finalPaise,
          currency: 'INR',
          status: 'OUTSTANDING',
          dueDate: parsedDueDate,
          notes: notes?.trim() || null,
          paymentMethod: paymentMethod?.trim() || null,
          paymentVerified: Boolean(paymentVerified),
          receiptImage: receiptImage && typeof receiptImage === 'string' ? receiptImage.trim() : null,
        },
      });

      const isOverdue =
        newLoan.status === 'OUTSTANDING' &&
        Boolean(newLoan.dueDate && new Date(newLoan.dueDate) < new Date());

      res.status(201).json({ success: true, loan: { ...newLoan, isOverdue } });
    } catch (error) {
      console.error('Create Loan Error:', error);
      res.status(500).json({ error: 'Failed to create loan' });
    }
  }

  /**
   * PATCH /api/loans/:id/repay
   * Marks an outstanding loan as repaid with verified timestamp and method.
   */
  static async markAsRepaid(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { paymentMethod, repaidAt } = req.body;

      const loan = await prisma.loan.findUnique({ where: { id } });

      if (!loan) {
        res.status(404).json({ error: 'Not Found', message: 'Loan not found' });
        return;
      }

      if (loan.userId !== userId) {
        res.status(403).json({ error: 'Forbidden', message: 'Access denied to this loan record' });
        return;
      }

      if (loan.status === 'REPAID') {
        res.status(400).json({ error: 'Bad Request', message: 'Loan is already marked as repaid' });
        return;
      }

      const updated = await prisma.loan.update({
        where: { id },
        data: {
          status: 'REPAID',
          repaidAt: repaidAt ? new Date(repaidAt) : new Date(),
          paymentMethod: paymentMethod || loan.paymentMethod || 'UPI',
          paymentVerified: true,
        },
      });

      res.status(200).json({ success: true, loan: { ...updated, isOverdue: false } });
    } catch (error) {
      console.error('Mark Repaid Error:', error);
      res.status(500).json({ error: 'Failed to mark loan as repaid' });
    }
  }

  /**
   * PATCH /api/loans/:id/receipt-image
   * Attaches or updates a photo of a receipt for a loan (Bonus Feature).
   */
  static async uploadReceiptImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { receiptImage } = req.body;

      if (!receiptImage || typeof receiptImage !== 'string') {
        res.status(400).json({ error: 'Bad Request', message: 'receiptImage is required' });
        return;
      }

      const loan = await prisma.loan.findUnique({ where: { id } });
      if (!loan) {
        res.status(404).json({ error: 'Not Found', message: 'Loan not found' });
        return;
      }

      if (loan.userId !== userId) {
        res.status(403).json({ error: 'Forbidden', message: 'Access denied to this loan record' });
        return;
      }

      const updated = await prisma.loan.update({
        where: { id },
        data: { receiptImage: receiptImage.trim() },
      });

      res.status(200).json({
        success: true,
        message: 'Receipt photo attached successfully',
        loan: updated,
      });
    } catch (error) {
      console.error('Upload Receipt Photo Error:', error);
      res.status(500).json({ error: 'Failed to attach receipt photo' });
    }
  }
}
