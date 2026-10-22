import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding MiniLedger Database ---');

  // Clean existing records
  await prisma.receipt.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.otpVerification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.sequenceTracker.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Primary User (Lender) with Phone Number for OTP login
  const userRahul = await prisma.user.create({
    data: {
      name: 'Rahul Sharma',
      phone: '+919876543210',
      email: 'rahul@miniledger.com',
      passwordHash,
    },
  });
  console.log(`Created primary user: ${userRahul.name} (${userRahul.phone} / ${userRahul.email})`);

  // 2. Secondary User (for testing isolation)
  const userSneha = await prisma.user.create({
    data: {
      name: 'Sneha Reddy',
      phone: '+919876543211',
      email: 'sneha@miniledger.com',
      passwordHash,
    },
  });
  console.log(`Created secondary user: ${userSneha.name} (${userSneha.phone} / ${userSneha.email})`);

  // 3. Outstanding On-Time Loan (₹1,500.00)
  const loan1 = await prisma.loan.create({
    data: {
      userId: userRahul.id,
      friendName: 'Priya Patel',
      amountPaise: 150000,
      currency: 'INR',
      status: 'OUTSTANDING',
      loanDate: new Date('2026-10-15T10:30:00Z'),
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // Due in 10 days
      notes: 'Concert passes & dinner cab share',
      paymentMethod: 'UPI',
      paymentVerified: true,
      receiptImage: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    },
  });
  console.log(`Created Outstanding Loan for ${loan1.friendName} (₹${loan1.amountPaise / 100})`);

  // 4. Overdue Loan (₹2,000.00) - Due 5 days ago to demonstrate overdue highlighting & summary
  const loanOverdue = await prisma.loan.create({
    data: {
      userId: userRahul.id,
      friendName: 'Rohan Kapoor',
      amountPaise: 200000,
      currency: 'INR',
      status: 'OUTSTANDING',
      loanDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // Lent 15 days ago
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Due 5 days ago (OVERDUE!)
      notes: 'Emergency laptop charger replacement & books',
      paymentMethod: 'UPI',
      paymentVerified: true,
    },
  });
  console.log(`Created Overdue Loan for ${loanOverdue.friendName} (₹${loanOverdue.amountPaise / 100}) [OVERDUE]`);

  // 5. Repaid Loan (₹4,500.00)
  const loan2 = await prisma.loan.create({
    data: {
      userId: userRahul.id,
      friendName: 'Amit Verma',
      amountPaise: 450000,
      currency: 'INR',
      status: 'REPAID',
      loanDate: new Date('2026-10-01T09:00:00Z'),
      dueDate: new Date('2026-10-15T18:00:00Z'),
      repaidAt: new Date('2026-10-14T14:45:00Z'),
      notes: 'Weekend trip Airbnb booking',
      paymentMethod: 'Bank Transfer',
      paymentVerified: true,
    },
  });
  console.log(`Created Repaid Loan for ${loan2.friendName} (₹${loan2.amountPaise / 100})`);

  // 6. Loan belonging to Sneha (Isolation check)
  const loanSneha = await prisma.loan.create({
    data: {
      userId: userSneha.id,
      friendName: 'Karan Mehra',
      amountPaise: 250000,
      currency: 'INR',
      status: 'OUTSTANDING',
      notes: 'Sneha private loan',
    },
  });
  console.log(`Created private loan for Sneha: ID ${loanSneha.id}`);

  console.log('--- Database Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
