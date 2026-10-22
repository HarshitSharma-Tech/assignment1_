import { Router } from 'express';
import { LoanController } from '../controllers/loanController';
import { ReceiptController } from '../controllers/receiptController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication to all loan routes
router.use(authenticateToken);

// Financial Summary Endpoint (Must precede /:id)
// Assignment Requirement: An endpoint that returns a summary: total lent, total repaid, overdue amount
router.get('/summary', LoanController.getSummary);

// Core Loan CRUD
router.get('/', LoanController.listLoans);
router.post('/', LoanController.createLoan);
router.get('/:id', LoanController.getLoanById);
router.patch('/:id/repay', LoanController.markAsRepaid);

// Bonus: Upload/Attach a photo of a receipt with a loan
router.patch('/:id/receipt-image', LoanController.uploadReceiptImage);

// Receipt Generation & Preview Endpoints
router.get('/:id/receipt', ReceiptController.getReceiptPdf);
router.get('/:id/receipt/preview', ReceiptController.getReceiptPreview);

export default router;
