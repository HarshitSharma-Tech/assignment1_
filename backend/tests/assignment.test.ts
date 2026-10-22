import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';

describe('MiniLedger Assignment Requirements Test Suite', () => {
  let primaryToken: string;
  let primaryUserId: string;
  const testPhone = '+919988776655';
  let capturedOtp: string;

  beforeAll(async () => {
    // Clean up test data for this phone if exists
    await prisma.otpVerification.deleteMany({ where: { phone: testPhone } });
    await prisma.user.deleteMany({ where: { phone: testPhone } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Phone Number Login with Mock OTP (Assignment Requirement)', () => {
    it('rejects missing phone number with 400 Bad Request', async () => {
      const res = await request(app).post('/api/auth/send-otp').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/phone number is required/i);
    });

    it('rejects invalid phone number with fewer than 10 digits', async () => {
      const res = await request(app).post('/api/auth/send-otp').send({ phone: '12345' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid phone number/i);
    });

    it('generates a 6-digit mock OTP, prints to server log, and returns success', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      const res = await request(app).post('/api/auth/send-otp').send({ phone: testPhone });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mockOtp).toBeDefined();
      expect(res.body.mockOtp).toMatch(/^\d{6}$/);

      capturedOtp = res.body.mockOtp;

      // Verify OTP is printed to the server console log
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MINILEDGER MOCK OTP SERVICE')
      );
      consoleSpy.mockRestore();
    });

    it('rejects verification with wrong OTP code', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid otp code/i);
    });

    it('verifies mock OTP, creates user, and returns valid JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: capturedOtp, name: 'Aditya Mehta' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.phone).toBe(testPhone);
      expect(res.body.user.name).toBe('Aditya Mehta');

      primaryToken = res.body.token;
      primaryUserId = res.body.user.id;
    });

    it('supports universal evaluation demo OTP (123456)', async () => {
      // Re-send OTP for another test phone
      const demoPhone = '+919111222333';
      await request(app).post('/api/auth/send-otp').send({ phone: demoPhone });

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: demoPhone, otp: '123456', name: 'Demo Evaluator' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.name).toBe('Demo Evaluator');
    });
  });

  describe('2. Loan CRUD APIs (Assignment Requirement)', () => {
    let createdLoanId: string;

    it('rejects loan creation when friend name is missing', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${primaryToken}`)
        .send({ amountRupees: 1000 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/friend's name is required/i);
    });

    it('rejects loan creation with non-positive amount', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${primaryToken}`)
        .send({ friendName: 'Kabir', amountRupees: -500 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be greater than zero/i);
    });

    it('creates a new loan entry with friend name, amount, and due date', async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${primaryToken}`)
        .send({
          friendName: 'Kabir Singh',
          amountRupees: 2500,
          dueDate,
          notes: 'Camera lens rental share',
          paymentMethod: 'UPI',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.loan.friendName).toBe('Kabir Singh');
      expect(res.body.loan.amountPaise).toBe(250000); // Integer paise conversion
      expect(res.body.loan.status).toBe('OUTSTANDING');
      expect(res.body.loan.isOverdue).toBe(false);

      createdLoanId = res.body.loan.id;
    });

    it('marks a loan entry as repaid with payment timestamp', async () => {
      const res = await request(app)
        .patch(`/api/loans/${createdLoanId}/repay`)
        .set('Authorization', `Bearer ${primaryToken}`)
        .send({ paymentMethod: 'UPI' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.loan.status).toBe('REPAID');
      expect(res.body.loan.repaidAt).toBeDefined();
    });

    it('rejects marking an already repaid loan as repaid (idempotency/guard)', async () => {
      const res = await request(app)
        .patch(`/api/loans/${createdLoanId}/repay`)
        .set('Authorization', `Bearer ${primaryToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already marked as repaid/i);
    });
  });

  describe('3. Financial Summary Endpoint: Total Lent, Total Repaid, Overdue Amount', () => {
    beforeAll(async () => {
      // Clear loans for the test user to test exact mathematical precision
      await prisma.receipt.deleteMany({ where: { loan: { userId: primaryUserId } } });
      await prisma.loan.deleteMany({ where: { userId: primaryUserId } });

      const pastDueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago (Overdue)
      const futureDueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days in future (On time)

      // Loan 1: Repaid loan of ₹1,000
      await prisma.loan.create({
        data: {
          userId: primaryUserId,
          friendName: 'Friend A',
          amountPaise: 100000, // ₹1,000
          status: 'REPAID',
          repaidAt: new Date(),
        },
      });

      // Loan 2: Outstanding on-time loan of ₹2,500
      await prisma.loan.create({
        data: {
          userId: primaryUserId,
          friendName: 'Friend B',
          amountPaise: 250000, // ₹2,500
          status: 'OUTSTANDING',
          dueDate: futureDueDate,
        },
      });

      // Loan 3: Outstanding OVERDUE loan of ₹1,500
      await prisma.loan.create({
        data: {
          userId: primaryUserId,
          friendName: 'Friend C',
          amountPaise: 150000, // ₹1,500
          status: 'OUTSTANDING',
          dueDate: pastDueDate,
        },
      });
    });

    it('GET /api/loans/summary returns exact total lent, total repaid, and overdue amount', async () => {
      const res = await request(app)
        .get('/api/loans/summary')
        .set('Authorization', `Bearer ${primaryToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const summary = res.body.summary;
      // Total Lent: 1000 + 2500 + 1500 = ₹5,000
      expect(summary.totalLent).toBe(5000);
      expect(summary.totalLentPaise).toBe(500000);

      // Total Repaid: ₹1,000
      expect(summary.totalRepaid).toBe(1000);
      expect(summary.totalRepaidPaise).toBe(100000);

      // Overdue Amount: ₹1,500 (Friend C)
      expect(summary.overdueAmount).toBe(1500);
      expect(summary.overduePaise).toBe(150000);

      // Outstanding Amount: 2500 + 1500 = ₹4,000
      expect(summary.outstandingAmount).toBe(4000);

      // Counts
      expect(summary.totalCount).toBe(3);
      expect(summary.repaidCount).toBe(1);
      expect(summary.overdueCount).toBe(1);
      expect(summary.outstandingCount).toBe(2);
    });

    it('GET /api/loans highlights overdue loans with isOverdue=true', async () => {
      const res = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${primaryToken}`);

      expect(res.status).toBe(200);
      const loans = res.body.loans;
      expect(loans.length).toBe(3);

      const friendC = loans.find((l: any) => l.friendName === 'Friend C');
      const friendB = loans.find((l: any) => l.friendName === 'Friend B');
      const friendA = loans.find((l: any) => l.friendName === 'Friend A');

      expect(friendC.isOverdue).toBe(true);
      expect(friendB.isOverdue).toBe(false);
      expect(friendA.isOverdue).toBe(false); // Repaid loans are not overdue
    });
  });

  describe('4. Bonus Feature: Receipt Photo Attachment', () => {
    it('supports attaching a photo of a receipt when creating a loan', async () => {
      const sampleReceiptDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';

      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${primaryToken}`)
        .send({
          friendName: 'Deepak Rao',
          amountRupees: 850,
          notes: 'Grocery store bill share',
          receiptImage: sampleReceiptDataUrl,
        });

      expect(res.status).toBe(201);
      expect(res.body.loan.receiptImage).toBe(sampleReceiptDataUrl);
    });

    it('supports attaching or updating receipt image on an existing loan', async () => {
      const listRes = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${primaryToken}`);
      const loanId = listRes.body.loans[0].id;

      const updateRes = await request(app)
        .patch(`/api/loans/${loanId}/receipt-image`)
        .set('Authorization', `Bearer ${primaryToken}`)
        .send({ receiptImage: 'https://example.com/receipt.jpg' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.loan.receiptImage).toBe('https://example.com/receipt.jpg');
    });
  });
});
