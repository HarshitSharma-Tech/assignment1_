import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ReceiptService, ReceiptServiceError } from '../services/receiptService';
import { PdfService } from '../services/pdfService';
import { formatPaiseToINR } from '../utils/formatCurrency';
import { amountPaiseToWords } from '../utils/numberToWords';

export class ReceiptController {
  /**
   * GET /api/loans/:id/receipt?type=loan|repayment
   * Generates and downloads an authoritative, professional PDF receipt.
   */
  static async getReceiptPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const loanId = req.params.id;
      const typeParam = (req.query.type as string) || 'loan';
      const disposition = (req.query.disposition as string) || 'attachment';
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User context is missing.' });
        return;
      }

      // Authoritative lookup, verification, and idempotent retrieval/generation
      const receipt = await ReceiptService.getOrCreateReceipt(loanId, userId, typeParam);

      // Safe filename generation according to specification
      const filename = ReceiptService.getSafeFilename(receipt);

      // Set authoritative HTTP headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${disposition === 'inline' ? 'inline' : 'attachment'}; filename="${filename}"`);
      res.setHeader('X-Receipt-Number', receipt.receiptNumber);
      res.setHeader('X-Receipt-Type', receipt.receiptType);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

      // Stream PDF directly to client response
      await PdfService.generateReceiptPdf(receipt, res);
    } catch (error: any) {
      if (error instanceof ReceiptServiceError) {
        res.status(error.statusCode).json({
          error: error.statusCode === 404 ? 'Not Found' : error.statusCode === 403 ? 'Forbidden' : 'Bad Request',
          message: error.message,
        });
        return;
      }

      console.error('Unhandled Receipt PDF Generation Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while generating the receipt PDF.',
      });
    }
  }

  /**
   * GET /api/loans/:id/receipt/preview?type=loan|repayment
   * Returns authoritative metadata & snapshots for instant mobile preview.
   */
  static async getReceiptPreview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const loanId = req.params.id;
      const typeParam = (req.query.type as string) || 'loan';
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User context is missing.' });
        return;
      }

      const receipt = await ReceiptService.getOrCreateReceipt(loanId, userId, typeParam);

      const inrFormatted = formatPaiseToINR(receipt.amountPaise);
      const amountInWords = amountPaiseToWords(receipt.amountPaise);
      const filename = ReceiptService.getSafeFilename(receipt);

      res.status(200).json({
        success: true,
        receipt: {
          ...receipt,
          amountFormatted: inrFormatted,
          amountInWords,
          safeFilename: filename,
          downloadUrl: `/api/loans/${loanId}/receipt?type=${receipt.receiptType.toLowerCase()}`,
        },
      });
    } catch (error: any) {
      if (error instanceof ReceiptServiceError) {
        res.status(error.statusCode).json({
          error: error.statusCode === 404 ? 'Not Found' : error.statusCode === 403 ? 'Forbidden' : 'Bad Request',
          message: error.message,
        });
        return;
      }

      console.error('Unhandled Receipt Preview Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while retrieving the receipt preview.',
      });
    }
  }
}
