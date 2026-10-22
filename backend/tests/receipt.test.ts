import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { formatPaiseToINR } from '../src/utils/formatCurrency';
import { amountPaiseToWords } from '../src/utils/numberToWords';

const JWT_SECRET = process.env.JWT_SECRET || 'miniledger_super_secret_jwt_key_2026_receipts';

describe('MiniLedger Receipt Generation & Security Test Suite', () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  let outstandingLoanId: string;
  let repaidLoanId: string;
  let user2LoanId: string;

  beforeAll(async () => {
    // Reset test database
    await prisma.receipt.deleteMany();
    await prisma.loan.deleteMany();
    await prisma.user.deleteMany();
    await prisma.sequenceTracker.deleteMany();

    const passwordHash = await bcrypt.hash('secret123', 8);

    // Create User 1 (Primary Lender)
    const user1 = await prisma.user.create({
      data: {
        name: 'Rahul Sharma',
        email: 'rahul.test@miniledger.com',
        passwordHash,
      },
    });
    user1Id = user1.id;
    user1Token = jwt.sign({ id: user1.id, email: user1.email, name: user1.name }, JWT_SECRET);

    // Create User 2 (Separate User for Isolation testing)
    const user2 = await prisma.user.create({
      data: {
        name: 'Sneha Reddy',
        email: 'sneha.test@miniledger.com',
        passwordHash,
      },
    });
    user2Id = user2.id;
    user2Token = jwt.sign({ id: user2.id, email: user2.email, name: user2.name }, JWT_SECRET);

    // Outstanding Loan for User 1 (150000 paise = ₹1,500.00)
    const loan1 = await prisma.loan.create({
      data: {
        userId: user1Id,
        friendName: 'Priya Patel',
        amountPaise: 150000,
        currency: 'INR',
        status: 'OUTSTANDING',
        loanDate: new Date('2026-10-15T10:00:00Z'),
        dueDate: new Date('2026-11-01T18:00:00Z'),
        paymentMethod: 'UPI',
        paymentVerified: true,
        notes: 'Concert & dinner share',
      },
    });
    outstandingLoanId = loan1.id;

    // Repaid Loan for User 1 (450000 paise = ₹4,500.00)
    const loan2 = await prisma.loan.create({
      data: {
        userId: user1Id,
        friendName: 'Amit Verma',
        amountPaise: 450000,
        currency: 'INR',
        status: 'REPAID',
        loanDate: new Date('2026-10-01T09:00:00Z'),
        dueDate: new Date('2026-10-15T18:00:00Z'),
        repaidAt: new Date('2026-10-14T14:30:00Z'),
        paymentMethod: 'Bank Transfer',
        paymentVerified: true,
        notes: 'Goa trip villa share',
      },
    });
    repaidLoanId = loan2.id;

    // Loan belonging to User 2
    const loan3 = await prisma.loan.create({
      data: {
        userId: user2Id,
        friendName: 'Karan Mehra',
        amountPaise: 250000,
        currency: 'INR',
        status: 'OUTSTANDING',
      },
    });
    user2LoanId = loan3.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------
  // 1. Successful loan receipt generation
  // ---------------------------------------------------------
  describe('1. Successful loan receipt generation', () => {
    it('generates a valid PDF loan receipt with 200 status and correct headers', async () => {
      const res = await request(app)
        .get(`/api/loans/${outstandingLoanId}/receipt?type=loan`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="MiniLedger-Loan-ML-LN-\d+\.pdf"/);
      expect(res.headers['x-receipt-number']).toMatch(/^ML-LN-\d{6}$/);
      expect(res.headers['x-receipt-type']).toBe('LOAN');

      // Verify binary PDF magic number (%PDF-)
      const buffer = res.body;
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
    });

    it('returns structured receipt preview metadata', async () => {
      const res = await request(app)
        .get(`/api/loans/${outstandingLoanId}/receipt/preview?type=loan`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.receipt.receiptType).toBe('LOAN');
      expect(res.body.receipt.friendName).toBe('Priya Patel');
      expect(res.body.receipt.amountPaise).toBe(150000);
      expect(res.body.receipt.amountFormatted).toBe('₹1,500.00');
      expect(res.body.receipt.amountInWords).toBe('One Thousand Five Hundred Rupees Only');
      expect(res.body.receipt.receiptNumber).toMatch(/^ML-LN-\d{6}$/);
    });
  });

  // ---------------------------------------------------------
  // 2. Successful repayment receipt generation
  // ---------------------------------------------------------
  describe('2. Successful repayment receipt generation', () => {
    it('generates a repayment receipt for a genuinely repaid loan', async () => {
      const res = await request(app)
        .get(`/api/loans/${repaidLoanId}/receipt?type=repayment`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="MiniLedger-Repayment-ML-RP-\d+\.pdf"/);
      expect(res.headers['x-receipt-number']).toMatch(/^ML-RP-\d{6}$/);
      expect(res.headers['x-receipt-type']).toBe('REPAYMENT');

      const buffer = res.body;
      expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
    });
  });

  // ---------------------------------------------------------
  // 3. Rejection of repayment receipts for outstanding loans
  // ---------------------------------------------------------
  describe('3. Rejection of repayment receipts for outstanding loans', () => {
    it('returns 400 Bad Request when trying to generate a repayment receipt for an outstanding loan', async () => {
      const res = await request(app)
        .get(`/api/loans/${outstandingLoanId}/receipt?type=repayment`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toMatch(/Cannot generate a repayment receipt for an outstanding loan/i);
    });
  });

  // ---------------------------------------------------------
  // 4. Invalid receipt types
  // ---------------------------------------------------------
  describe('4. Invalid receipt types', () => {
    it('returns 400 Bad Request for unsupported receipt type', async () => {
      const res = await request(app)
        .get(`/api/loans/${outstandingLoanId}/receipt?type=cryptocurrency_invoice`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toMatch(/Invalid receipt type/i);
    });
  });

  // ---------------------------------------------------------
  // 5. Nonexistent loan IDs
  // ---------------------------------------------------------
  describe('5. Nonexistent loan IDs', () => {
    it('returns 404 Not Found for nonexistent loan ID', async () => {
      const nonExistentId = '11111111-2222-3333-4444-555555555555';
      const res = await request(app)
        .get(`/api/loans/${nonExistentId}/receipt?type=loan`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  // ---------------------------------------------------------
  // 6. Unauthorized access
  // ---------------------------------------------------------
  describe('6. Unauthorized access', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .get(`/api/loans/${outstandingLoanId}/receipt?type=loan`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 401 when an invalid/expired token is provided', async () => {
      const res = await request(app)
        .get(`/api/loans/${outstandingLoanId}/receipt?type=loan`)
        .set('Authorization', 'Bearer invalid_garbage_token_123');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });
  });

  // ---------------------------------------------------------
  // 7. Access to another user\'s loan
  // ---------------------------------------------------------
  describe('7. Cross-user isolation: Access to another user loan', () => {
    it('returns 403 Forbidden when User 2 attempts to generate receipt for User 1 loan', async () => {
      const res = await request(app)
        .get(`/api/loans/${outstandingLoanId}/receipt?type=loan`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.message).toMatch(/You do not have permission/i);
    });

    it('returns 403 Forbidden when User 1 attempts to fetch User 2 loan preview', async () => {
      const res = await request(app)
        .get(`/api/loans/${user2LoanId}/receipt/preview?type=loan`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  // ---------------------------------------------------------
  // 8. Unique and stable receipt numbering (Idempotency)
  // ---------------------------------------------------------
  describe('8. Unique and stable receipt numbering (Idempotency)', () => {
    it('retains the identical receipt number on repeated downloads/previews', async () => {
      const firstCall = await request(app)
        .get(`/api/loans/${outstandingLoanId}/receipt/preview?type=loan`)
        .set('Authorization', `Bearer ${user1Token}`);

      const firstReceiptNumber = firstCall.body.receipt.receiptNumber;

      const secondCall = await request(app)
        .get(`/api/loans/${outstandingLoanId}/receipt/preview?type=loan`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(secondCall.body.receipt.receiptNumber).toBe(firstReceiptNumber);

      // Verify in DB that only one record exists for this loan and receipt type
      const receiptCount = await prisma.receipt.count({
        where: { loanId: outstandingLoanId, receiptType: 'LOAN' },
      });
      expect(receiptCount).toBe(1);
    });

    it('assigns distinct receipt numbers across different loans or types', async () => {
      const loanRes = await request(app)
        .get(`/api/loans/${repaidLoanId}/receipt/preview?type=repayment`)
        .set('Authorization', `Bearer ${user1Token}`);

      const loan1Receipt = await prisma.receipt.findFirst({
        where: { loanId: outstandingLoanId, receiptType: 'LOAN' },
      });

      expect(loanRes.body.receipt.receiptNumber).not.toBe(loan1Receipt?.receiptNumber);
    });
  });

  // ---------------------------------------------------------
  // 9. Correct INR formatting & Words conversion
  // ---------------------------------------------------------
  describe('9. Correct INR formatting and Amount in Words', () => {
    it('formats paise to INR currency strings accurately without floating point flaws', () => {
      expect(formatPaiseToINR(150000)).toBe('₹1,500.00');
      expect(formatPaiseToINR(450000)).toBe('₹4,500.00');
      expect(formatPaiseToINR(10000000)).toBe('₹1,00,000.00');
      expect(formatPaiseToINR(7550)).toBe('₹75.50');
      expect(formatPaiseToINR(0)).toBe('₹0.00');
    });

    it('converts amounts in paise to formal Indian Rupee words', () => {
      expect(amountPaiseToWords(150000)).toBe('One Thousand Five Hundred Rupees Only');
      expect(amountPaiseToWords(450000)).toBe('Four Thousand Five Hundred Rupees Only');
      expect(amountPaiseToWords(10000000)).toBe('One Lakh Rupees Only');
      expect(amountPaiseToWords(1000000000)).toBe('One Crore Rupees Only');
      expect(amountPaiseToWords(2550)).toBe('Twenty-Five Rupees and Fifty Paise Only');
      expect(amountPaiseToWords(100)).toBe('One Rupee Only');
      expect(amountPaiseToWords(0)).toBe('Zero Rupees Only');
    });
  });

  // ---------------------------------------------------------
  // 10. Correct PDF response headers and safety
  // ---------------------------------------------------------
  describe('10. PDF response headers and safe filenames', () => {
    it('includes safe filename adhering to MiniLedger specification', async () => {
      const res = await request(app)
        .get(`/api/loans/${outstandingLoanId}/receipt?type=loan`)
        .set('Authorization', `Bearer ${user1Token}`);

      const disposition = res.headers['content-disposition'];
      expect(disposition).toContain('MiniLedger-Loan-ML-LN-');
      expect(disposition).toContain('.pdf');
      
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      expect(filenameMatch).not.toBeNull();
      const filename = filenameMatch![1];
      // Filename must not contain directory traversal or invalid OS characters
      expect(filename).not.toMatch(/[\\\/:\*\?"<>\|]/);
    });
  });
});
