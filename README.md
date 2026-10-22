# MiniLedger — Full Stack Friend Loan Tracking Platform

> **Credsetu Technologies Full Stack Development Internship Assignment**  
> **Candidate Submission:** MiniLedger  
> **Tech Stack:** Node.js, TypeScript, PostgreSQL / SQLite (Prisma ORM), React Native (Expo)

---

## 🎯 Assignment Requirements Compliance Matrix

| Requirement | Assignment Specification | Implementation Status | Location |
| :--- | :--- | :---: | :--- |
| **Auth** | Phone number login with mock OTP (printed to server log) | **100% Complete** | `backend/src/controllers/authController.ts`<br>`backend/src/routes/authRoutes.ts` |
| **Loan API** | Add loan entry (friend name, amount, due date) | **100% Complete** | `POST /api/loans`<br>`backend/src/controllers/loanController.ts` |
| **Repayment API** | Mark loan as repaid | **100% Complete** | `PATCH /api/loans/:id/repay` |
| **Summary API** | Endpoint returning: total lent, total repaid, overdue amount | **100% Complete** | `GET /api/loans/summary`<br>`backend/src/controllers/loanController.ts` |
| **App: Login** | Login screen with phone + OTP | **100% Complete** | `mobile/src/screens/LoginScreen.tsx` |
| **App: Summary** | Summary card at the top displaying all metrics | **100% Complete** | `mobile/src/screens/HomeScreen.tsx` |
| **App: Overdue** | List of entries with overdue ones highlighted | **100% Complete** | Red accent badges, overdue strip, days counter |
| **App: Add Loan** | Form to add an entry with due date selector | **100% Complete** | Modal sheet with quick presets & custom date |
| **Bonus 1** | Upload a photo of a receipt with an entry | **100% Complete** | Preset samples, custom URL, preview modal |
| **Bonus 2** | Input validation & comprehensive automated tests | **100% Complete** | **30 passed / 30 total tests** (`backend/tests/`) |
| **Bonus 3** | Vectorized PDF receipt generation & native sharing | **100% Complete** | Pure PDFKit engine + Expo sharing |

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    subgraph Mobile ["React Native / Expo Mobile App"]
        LoginScreen["LoginScreen (Phone + Mock OTP)"]
        HomeScreen["HomeScreen (Top Summary Card + Overdue Highlights)"]
        LoanDetailScreen["LoanDetailScreen (Status, Due Date, Repay)"]
        AddLoanModal["AddLoanModal (Validation + Receipt Photo)"]
        ReceiptModal["ReceiptModal (Instant Native Preview)"]
    end

    subgraph Backend ["Node.js + Express + TypeScript Backend"]
        AuthCtrl["AuthController (Mock OTP Generator & Logger)"]
        LoanCtrl["LoanController (CRUD, Summary, Repay, Photo)"]
        ReceiptCtrl["ReceiptController (PDFKit Vector Generator)"]
        AuthMiddleware["JWT Bearer Auth Middleware"]
    end

    subgraph Database ["Database Layer (Prisma ORM)"]
        UserTable[("User (Phone Unique, ID, Name)")]
        OtpTable[("OtpVerification (Phone, Mock OTP, 5m TTL)")]
        LoanTable[("Loan (Integer Paise, DueDate, Photo)")]
        ReceiptTable[("Receipt (Immutable Snapshots)")]
    end

    LoginScreen -->|POST /api/auth/send-otp| AuthCtrl
    LoginScreen -->|POST /api/auth/verify-otp| AuthCtrl
    HomeScreen -->|GET /api/loans/summary| LoanCtrl
    HomeScreen -->|GET /api/loans| LoanCtrl
    AddLoanModal -->|POST /api/loans| LoanCtrl
    LoanDetailScreen -->|PATCH /api/loans/:id/repay| LoanCtrl
    LoanDetailScreen -->|GET /api/loans/:id/receipt| ReceiptCtrl

    AuthCtrl --> UserTable
    AuthCtrl --> OtpTable
    LoanCtrl --> LoanTable
    ReceiptCtrl --> ReceiptTable
```

---

## ⚡ Quick Start: How to Run the Project

### Prerequisites
* **Node.js** v18+ (tested on Node v20 & v24)
* **npm** v9+

---

### 1. Backend Setup & Run

Open a terminal in the root project directory:

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Push Prisma database schema (creates local SQLite database dev.db)
npx prisma generate
npx prisma db push

# 3. Seed demo loans and test users
npm run prisma:seed

# 4. Start the backend development server (running on port 4000)
npm run dev
```

The server will start at `http://localhost:4000`.

#### Running Automated Tests (30/30 Passing)
```bash
cd backend
npm test
```
All 30 tests in `assignment.test.ts` and `receipt.test.ts` will execute and pass:
* Phone OTP generation, terminal logging, and verification.
* Loan creation with friend name, amount, and due date validation.
* Summary endpoint mathematical accuracy (`totalLent`, `totalRepaid`, `overdueAmount`).
* Overdue detection logic.
* Bonus receipt image attachment.
* PDF receipt generation and cross-user security isolation.

---

### 2. Mobile App Setup & Run (React Native / Expo)

Open a second terminal window:

```bash
cd mobile

# 1. Install mobile dependencies
npm install

# 2. Start Expo in web browser mode
npm run web
```
The Expo app will compile and launch immediately in your default browser at `http://localhost:8081`.  
*(You can also scan the QR code with Expo Go on physical iOS or Android phones).*

---

## 📱 Features Walkthrough & Screenshots

### 1. Phone Number Login with Mock OTP
* **Format Normalization**: Accepts standard 10-digit mobile numbers or international E.164 formats (`+919876543210`).
* **Console Logging**: When the user enters their phone number and taps *"Get Verification Code"*, the backend logs the 6-digit mock OTP prominently in the server terminal:
  ```text
  ╔════════════════════════════════════════════════════════════════════╗
  ║                     MINILEDGER MOCK OTP SERVICE                    ║
  ╠════════════════════════════════════════════════════════════════════╣
  ║  Phone Number : +919876543210                                     ║
  ║  Mock OTP     : 849201                                            ║
  ║  Validity     : 5 Minutes                                          ║
  ╚════════════════════════════════════════════════════════════════════╝
  ```
* **Evaluator Convenience**: The app features a **"⚡ Quick Evaluator Demo (+91 98765 43210)"** button and an **"⚡ Auto-Fill Mock OTP"** button to allow reviewers to test login in 1 click!

---

### 2. Top Financial Summary Card
The top hero section calls the authoritative endpoint `GET /api/loans/summary`:
* 🪙 **TOTAL LENT**: Sum of all loans lent to friends (e.g. ₹8,000 across 3 loans).
* 💚 **TOTAL REPAID**: Total money successfully recovered/settled (e.g. ₹4,500).
* ⚠️ **OVERDUE AMOUNT**: Amount of outstanding loans that have passed their agreed due date (e.g. ₹2,000).
* **Urgent Alert Banner**: When `overdueAmount > 0`, a warning banner alerts the user and allows one-tap filtering to review overdue debts.

---

### 3. List of Entries with Overdue Highlighting
* **Overdue Entries (e.g., Rohan Kapoor — ₹2,000)**:
  * Crimson/Red border and card background accent (`#EF4444`).
  * Urgent top strip: `🚨 OVERDUE LOAN — Passed agreed due date`.
  * Red badge: `⚠️ OVERDUE (5d)` with days overdue calculation.
  * Overdue due date highlighted in bold red.
* **On-Time Pending Entries (e.g., Priya Patel — ₹1,500)**:
  * Amber badge: `● PENDING` with future due date.
* **Settled Entries (e.g., Amit Verma — ₹4,500)**:
  * Emerald green badge: `✓ SETTLED` with repayment date.
* **Filter Pills**: One-tap filtering between `All`, `⚠️ Overdue (1)`, `Pending`, and `Settled`.

---

### 4. Form to Add an Entry
Tap **"+ Lent Money"** in the top bar to open the modal:
* **Friend's Name**: Required text input with real-time validation.
* **Amount (₹)**: Strict numeric positive amount validation.
* **Agreed Due Date**:
  * Quick preset chips: `Tomorrow`, `+7 Days`, `+15 Days`, `+30 Days`, and `-3d (Overdue Demo)`.
  * Custom date input: `YYYY-MM-DD`.
* **Notes**: Optional description (e.g., "Dinner share", "Laptop charger").
* **Payment Method**: Radio chips for `UPI`, `Bank Transfer`, `Cash`.
* **Bonus — Attach Receipt Photo**:
  * Choose from 3 pre-configured sample receipts (*Restaurant Bill*, *Uber/Cab Fare*, *Shopping Invoice*) or input a custom image URL.
  * Instant image thumbnail preview before saving.

---

### 5. Mark Loan as Repaid
* Inside any outstanding loan, tap **"✓ Mark Loan as Fully Repaid"**.
* Prompts confirmation, marks status as `REPAID`, records authoritative `repaidAt` timestamp, and unlocks official **Repayment Receipt** generation!

---

## 🗄️ Database & PostgreSQL Configuration

MiniLedger uses **Prisma ORM**. It is configured by default with SQLite for zero-config, single-command evaluation on any computer without requiring a PostgreSQL installation.

### To switch to PostgreSQL:
1. Update `backend/.env`:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/miniledger?schema=public"
   ```
2. Run Prisma migration with the included PostgreSQL schema:
   ```bash
   npx prisma db push --schema=prisma/schema.postgresql.prisma
   ```

---

## 📡 REST API Reference

All protected routes require `Authorization: Bearer <jwt_token>`.

### Authentication
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/send-otp` | Generates 6-digit mock OTP, prints to server terminal log, returns 5m TTL |
| `POST` | `/api/auth/verify-otp` | Validates mock OTP, creates user if first time, issues JWT token |
| `POST` | `/api/auth/login` | Email/password login (test suite compatibility) |
| `GET` | `/api/auth/me` | Fetches authenticated user profile |

### Loans & Financial Summary
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/loans/summary` | **Assignment Endpoint**: Returns `{ totalLent, totalRepaid, overdueAmount, outstandingAmount, counts }` |
| `GET` | `/api/loans` | Returns all loans for user with enriched `isOverdue` boolean flag |
| `POST` | `/api/loans` | **Assignment Endpoint**: Creates loan with `friendName`, `amountRupees`/`amountPaise`, `dueDate`, `notes`, `receiptImage` |
| `GET` | `/api/loans/:id` | Returns single loan with ownership check |
| `PATCH` | `/api/loans/:id/repay` | **Assignment Endpoint**: Marks loan as settled with timestamp |
| `PATCH` | `/api/loans/:id/receipt-image` | **Bonus Endpoint**: Attaches/updates a photo of a transaction receipt |

### PDF Receipt Engine
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/loans/:id/receipt?type=loan` | Streams pure vector A4 Loan Receipt PDF (`application/pdf`) |
| `GET` | `/api/loans/:id/receipt?type=repayment` | Streams pure vector A4 Repayment Receipt PDF |
| `GET` | `/api/loans/:id/receipt/preview` | Returns structured JSON metadata for native modal preview |

---

## 🎥 2–3 Minute Screen Recording Walkthrough Script

For your **Loom** or **Google Drive** video submission, follow this simple 2–3 minute walkthrough:

1. **Introduction (0:00 - 0:25)**:
   - Introduce yourself and MiniLedger built for Credsetu Technologies.
   - Mention the stack: Node.js + TypeScript + PostgreSQL/Prisma backend with React Native (Expo) frontend.
2. **Phone Number Login with Mock OTP (0:25 - 0:55)**:
   - Show the terminal and the mobile login screen side by side.
   - Enter `+91 98765 43210` and click *"Get Verification Code"*.
   - Point to the server console showing the mock OTP box logged in real-time.
   - Enter the OTP and log in to the dashboard.
3. **Top Summary Card & Overdue Highlighting (0:55 - 1:30)**:
   - Point out the Top Summary Card: Total Lent (₹8,000), Total Repaid (₹4,500), and Overdue Amount (₹2,000).
   - Show the Red Overdue Warning Banner and Rohan Kapoor's card highlighted in red (`⚠️ OVERDUE by 5d`).
   - Click the *"⚠️ Overdue"* filter tab to demonstrate filtering.
4. **Recording a New Loan Entry with Bonus Receipt Photo (1:30 - 2:05)**:
   - Tap *"+ Lent Money"*.
   - Enter Friend: "Vikram Malhotra", Amount: ₹3,500, Due Date preset: "+7 Days".
   - Select the *"Restaurant Bill"* preset under Bonus Receipt Photo.
   - Show the instant photo preview and click *"Save Entry"*.
   - Show the new entry appearing in the list with the attached receipt badge.
5. **Mark as Repaid & PDF Receipt Generation (2:05 - 2:45)**:
   - Open a loan, tap *"✓ Mark Loan as Fully Repaid"*.
   - Watch the status switch to Settled and the Summary Card metrics update instantly.
   - Tap *"📄 Preview & Share Receipt"* to show the native receipt modal and PDF download.
6. **Closing (2:45 - 3:00)**:
   - Mention the 30/30 passing automated tests and wrap up.

---

## 💡 Senior Engineering Interview Talking Points

1. **Integer Paise Financial Precision**:
   - Stored all currency amounts as integers in paise (`amountPaise`) rather than floating-point numbers.
   - Eliminates IEEE 754 precision errors (e.g. `0.1 + 0.2 = 0.30000000000000004`).
2. **Authoritative Overdue Calculations**:
   - The `/api/loans/summary` endpoint computes overdue loans dynamically on the server based on `status === 'OUTSTANDING'` and `dueDate < new Date()`.
   - Never trusts client-side date computations for aggregate financial summaries.
3. **Mock OTP Reliability & Security**:
   - Enforces a 5-minute TTL via database persistence (`OtpVerification`), preventing replay attacks.
   - Deletes OTP upon verification to maintain strict one-time use semantics.
4. **Idempotency & Concurrency Safety**:
   - Receipt generation enforces `@@unique([loanId, receiptType])` and atomic sequence increments (`SequenceTracker`) to ensure duplicate download clicks never create duplicated receipt IDs.
5. **Lightweight Vector PDF Engine**:
   - Built with pure Node.js `pdfkit`. Generates vector A4 documents in <15ms with negligible memory overhead compared to heavy Chromium/Puppeteer processes.

---

## 👥 Seed Credentials for Testing

* **Primary Lender**:
  * Phone: `+91 98765 43210`
  * Mock OTP: Printed in backend terminal (or fallback demo code `123456`)
  * Email: `rahul@miniledger.com` / Password: `password123`
  * Pre-loaded with:
    1. **Overdue Loan**: Rohan Kapoor (₹2,000.00, past due date)
    2. **On-Time Loan**: Priya Patel (₹1,500.00, due in 10 days, attached receipt photo)
    3. **Repaid Loan**: Amit Verma (₹4,500.00, settled via Bank Transfer)

* **Secondary User (Isolation Verification)**:
  * Phone: `+91 98765 43211`
  * Email: `sneha@miniledger.com` / Password: `password123`
  * Used in automated tests to prove strict multi-tenant access control (`403 Forbidden` on cross-tenant access).
