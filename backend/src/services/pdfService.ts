import PDFDocument from 'pdfkit';
import { ReceiptData } from './receiptService';
import { amountPaiseToWords } from '../utils/numberToWords';
import { formatPaiseToINR } from '../utils/formatCurrency';

export class PdfService {
  /**
   * Generates a high-quality, professional PDF receipt stream using PDFKit.
   */
  static generateReceiptPdf(
    receipt: ReceiptData,
    stream: NodeJS.WritableStream
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 44,
          info: {
            Title: `MiniLedger Receipt - ${receipt.receiptNumber}`,
            Author: 'MiniLedger Financial Tracker',
            Subject: `${receipt.receiptType === 'LOAN' ? 'Loan Entry Record' : 'Loan Repayment Confirmation'}`,
            Keywords: 'MiniLedger, Loan, Repayment, Receipt, Personal Finance',
          },
        });

        doc.on('error', (err) => reject(err));
        stream.on('finish', () => resolve());
        doc.pipe(stream);

        // Palettes
        const NAVY = '#0F172A';
        const SLATE = '#475569';
        const LIGHT_SLATE = '#64748B';
        const BORDER_COLOR = '#E2E8F0';
        const PURPLE = '#6366F1';
        const PURPLE_BG = '#F5F3FF';
        const GREEN = '#059669';
        const GREEN_BG = '#ECFDF5';
        const AMBER = '#D97706';
        const AMBER_BG = '#FFFBEB';
        const CARD_BG = '#F8FAFC';

        const isRepayment = receipt.receiptType === 'REPAYMENT';
        const accentColor = isRepayment ? GREEN : PURPLE;
        const accentBg = isRepayment ? GREEN_BG : PURPLE_BG;

        // ----------------------------------------------------
        // 1. BRAND HEADER
        // ----------------------------------------------------
        const startY = 44;
        
        // Logo Monogram Box
        doc.roundedRect(44, startY, 40, 40, 8)
          .fillAndStroke(accentColor, accentColor);

        doc.fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(16)
          .text('ML', 44, startY + 11, { width: 40, align: 'center' });

        // Brand Name and Subtitle
        doc.fillColor(NAVY)
          .font('Helvetica-Bold')
          .fontSize(20)
          .text('MiniLedger', 94, startY + 3);

        doc.fillColor(LIGHT_SLATE)
          .font('Helvetica')
          .fontSize(9)
          .text('Personal Debt & Friend Loan Tracker', 94, startY + 25);

        // Header Right: Receipt Tag and Number
        const headerRightX = 350;
        doc.fillColor(accentColor)
          .font('Helvetica-Bold')
          .fontSize(13)
          .text(
            isRepayment ? 'REPAYMENT RECEIPT' : 'LOAN ENTRY RECEIPT',
            headerRightX,
            startY + 2,
            { width: 200, align: 'right' }
          );

        doc.fillColor(NAVY)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(`No: ${receipt.receiptNumber}`, headerRightX, startY + 18, {
            width: 200,
            align: 'right',
          });

        const genDateStr = new Date(receipt.createdAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        doc.fillColor(LIGHT_SLATE)
          .font('Helvetica')
          .fontSize(8)
          .text(`Generated: ${genDateStr} IST`, headerRightX, startY + 32, {
            width: 200,
            align: 'right',
          });

        // Horizontal Separator
        doc.strokeColor(BORDER_COLOR)
          .lineWidth(1)
          .moveTo(44, startY + 54)
          .lineTo(551, startY + 54)
          .stroke();

        // ----------------------------------------------------
        // 2. HERO AMOUNT CARD
        // ----------------------------------------------------
        const heroY = startY + 68;
        doc.roundedRect(44, heroY, 507, 105, 8)
          .fillAndStroke(CARD_BG, BORDER_COLOR);

        // Subtle left vertical accent bar
        doc.rect(44, heroY, 6, 105)
          .fill(accentColor);

        doc.fillColor(LIGHT_SLATE)
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text('TRANSACTION AMOUNT', 64, heroY + 14);

        // Big formatted Amount in Indian Rupees
        const inrFormatted = formatPaiseToINR(receipt.amountPaise, 'Rs.');
        doc.fillColor(NAVY)
          .font('Helvetica-Bold')
          .fontSize(24)
          .text(inrFormatted, 64, heroY + 28);

        // Amount in Words
        const words = amountPaiseToWords(receipt.amountPaise);
        doc.fillColor(SLATE)
          .font('Helvetica-Oblique')
          .fontSize(9.5)
          .text(words, 64, heroY + 60, { width: 330 });

        // Status Badge Pill on Right of Hero Card
        const badgeX = 410;
        const badgeY = heroY + 24;
        const isRepaid = receipt.status === 'REPAID';
        const badgeBg = isRepaid ? GREEN_BG : AMBER_BG;
        const badgeText = isRepaid ? GREEN : AMBER;
        const badgeLabel = isRepaid ? 'STATUS: REPAID' : 'STATUS: OUTSTANDING';

        doc.roundedRect(badgeX, badgeY, 126, 26, 13)
          .fillAndStroke(badgeBg, isRepaid ? GREEN : AMBER);

        doc.fillColor(badgeText)
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(badgeLabel, badgeX, badgeY + 8, { width: 126, align: 'center' });

        // ----------------------------------------------------
        // 3. TRANSACTION DETAILS (2-COLUMN GRID)
        // ----------------------------------------------------
        const gridY = heroY + 120;
        const col1X = 44;
        const col2X = 305;
        const colW = 240;

        // Section Title
        doc.fillColor(NAVY)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text('Transaction Participants & Dates', col1X, gridY);

        doc.fillColor(NAVY)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text('Reference & Method Details', col2X, gridY);

        // Divider
        doc.strokeColor(BORDER_COLOR)
          .lineWidth(0.5)
          .moveTo(col1X, gridY + 16)
          .lineTo(col1X + colW, gridY + 16)
          .stroke();

        doc.strokeColor(BORDER_COLOR)
          .lineWidth(0.5)
          .moveTo(col2X, gridY + 16)
          .lineTo(col2X + colW, gridY + 16)
          .stroke();

        // Helper for key-value row
        const drawRow = (x: number, y: number, label: string, value: string, isImportant: boolean = false) => {
          doc.fillColor(LIGHT_SLATE)
            .font('Helvetica')
            .fontSize(8.5)
            .text(label, x, y);

          doc.fillColor(isImportant ? NAVY : SLATE)
            .font(isImportant ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(9)
            .text(value, x + 95, y, { width: colW - 95 });
        };

        let rowY = gridY + 25;
        const rowGap = 20;

        // Column 1 Rows
        drawRow(col1X, rowY, 'Lender (Recorded by):', receipt.lenderName || 'MiniLedger User', true);
        drawRow(col2X, rowY, 'Receipt Identifier:', receipt.receiptNumber, true);

        rowY += rowGap;
        drawRow(col1X, rowY, 'Friend (Borrower):', receipt.friendName, true);
        drawRow(col2X, rowY, 'Loan Reference ID:', receipt.loanId.substring(0, 18) + '...');

        rowY += rowGap;
        const loanDateStr = new Date(receipt.loanDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        drawRow(col1X, rowY, 'Loan Creation Date:', loanDateStr);

        const paymentMethodStr = receipt.paymentMethod
          ? `${receipt.paymentMethod} (Verified)`
          : 'Not recorded / Unverified';
        drawRow(col2X, rowY, 'Payment Method:', paymentMethodStr);

        rowY += rowGap;
        if (isRepayment && receipt.repaidAt) {
          const repaidDateStr = new Date(receipt.repaidAt).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          drawRow(col1X, rowY, 'Repayment Date:', `${repaidDateStr} IST`, true);
        } else if (receipt.dueDate) {
          const dueDateStr = new Date(receipt.dueDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          drawRow(col1X, rowY, 'Agreed Due Date:', dueDateStr);
        } else {
          drawRow(col1X, rowY, 'Due Date:', 'Open / Not specified');
        }

        drawRow(col2X, rowY, 'Currency:', `${receipt.currency} (Indian Rupee)`);

        // ----------------------------------------------------
        // 4. NOTES / MEMO SECTION (IF AVAILABLE)
        // ----------------------------------------------------
        let nextSectionY = rowY + 35;
        if (receipt.notes && receipt.notes.trim().length > 0) {
          doc.roundedRect(44, nextSectionY, 507, 44, 6)
            .fillAndStroke('#F1F5F9', BORDER_COLOR);

          doc.fillColor(LIGHT_SLATE)
            .font('Helvetica-Bold')
            .fontSize(8)
            .text('RECORDED NOTES / PURPOSE', 56, nextSectionY + 8);

          doc.fillColor(NAVY)
            .font('Helvetica')
            .fontSize(8.5)
            .text(receipt.notes.trim(), 56, nextSectionY + 22, { width: 480 });

          nextSectionY += 56;
        }

        // ----------------------------------------------------
        // 5. FINANCIAL RECORD DISCLAIMER BOX (Section 2 & 7 compliance)
        // ----------------------------------------------------
        const disclaimerY = nextSectionY + 10;
        doc.roundedRect(44, disclaimerY, 507, 60, 6)
          .fillAndStroke('#F8FAFC', BORDER_COLOR);

        doc.fillColor(accentColor)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text('LEGAL & FINANCIAL RECORD CLARIFICATION', 56, disclaimerY + 8);

        const disclaimerText = isRepayment
          ? 'This receipt confirms that the lender marked this loan entry as repaid in their personal MiniLedger account. This record is generated for mutual tracking between private individuals and does not imply a central banking transaction clearance unless backed by an official bank/UPI reference.'
          : 'This receipt serves as a personal ledger record of money lent between friends as recorded by the lender in MiniLedger. It distinguishes an informal record of money lent from certified bank transfer proof and is intended for mutual transparency and tracking.';

        doc.fillColor(SLATE)
          .font('Helvetica')
          .fontSize(7.5)
          .text(disclaimerText, 56, disclaimerY + 22, { width: 480, lineGap: 2 });

        // ----------------------------------------------------
        // 6. PROFESSIONAL AUDIT FOOTER
        // ----------------------------------------------------
        const footerY = 770;
        doc.strokeColor(BORDER_COLOR)
          .lineWidth(0.5)
          .moveTo(44, footerY)
          .lineTo(551, footerY)
          .stroke();

        doc.fillColor(LIGHT_SLATE)
          .font('Helvetica')
          .fontSize(7.5)
          .text(
            `This receipt is an electronic record generated by MiniLedger | Idempotent Record ID: ${receipt.id}`,
            44,
            footerY + 8,
            { width: 507, align: 'center' }
          );

        doc.fillColor(LIGHT_SLATE)
          .font('Helvetica-Oblique')
          .fontSize(7)
          .text(
            'Keep this receipt for personal records. For questions, contact the lender directly.',
            44,
            footerY + 20,
            { width: 507, align: 'center' }
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
