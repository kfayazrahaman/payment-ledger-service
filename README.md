# 💰 Payment Ledger & Invoice Service

A full-stack fintech application implementing a double-entry accounting ledger system with invoice management and payment processing. Built for a Transportation Management System (TMS) Accounts Payable module.

## 📋 Project Overview

This is a **Mini Payment Ledger & Invoice Service** designed to demonstrate core fintech principles:

### ✅ Part 1: Core Ledger System
- ✓ Double-entry accounting (every debit has a corresponding credit)
- ✓ Account creation and transaction recording
- ✓ Balances derived from transaction logs (never stored as mutable state)
- ✓ Monetary amounts stored in cents to prevent floating-point errors

### ✅ Part 2: Invoice Management
- ✓ Invoice creation with line items
- ✓ Invoice status flow: draft → sent → paid → overdue
- ✓ Partial payment support
- ✓ Overpayment prevention
- ✓ Duplicate payment detection (edge case handled)

### ✅ Part 3: Edge Case Challenge
- **Selected: Duplicate Payment Prevention** - The system detects and prevents duplicate payments within a 5-second window

## 🏗️ Architecture

```
payment-ledger-service/
├── backend/                 # Node.js + Express + GraphQL
│   ├── src/
│   │   ├── index.js                    # Server entry point
│   │   ├── db/
│   │   │   └── database.js             # SQLite setup & queries
│   │   ├── graphql/
│   │   │   ├── schema.js               # GraphQL type definitions
│   │   │   └── resolvers.js            # GraphQL resolvers
│   │   ├── services/
│   │   │   ├── accountService.js       # Account logic
│   │   │   ├── transactionService.js   # Transaction logic
│   │   │   ├── invoiceService.js       # Invoice logic
│   │   │   ├── paymentService.js       # Payment logic
│   │   │   └── refundService.js        # Refund logic
│   │   └── tests/
│   │       └── ledger.test.js          # Ledger logic tests
│   ├── package.json
│   └── .env.example
└── frontend/                # React + Axios
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js                      # Main app component
    │   ├── index.js
    │   ├── index.css                   # Global styles
    │   └── components/
    │       ├── AccountManager.js       # Account UI
    │       ├── TransactionLedger.js    # Ledger UI
    │       └── InvoiceManager.js       # Invoice UI
    └── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ and npm

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start the server
npm start
```

The backend will run on `http://localhost:4000` with GraphQL endpoint at `/graphql`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

The frontend will open at `http://localhost:3000`

## 📊 Key Features

### 1. Double-Entry Ledger
Every transaction involves two accounts:
- **Debit**: Account where money goes out
- **Credit**: Account where money comes in

Example: Recording a $100 payment
```
Debit: Cash Account ($100 out)
Credit: Customer Account ($100 in)
```

### 2. Balance Calculation
Balances are **never stored**. They're calculated on-demand from transaction logs:
```
Balance = Sum(Credits) - Sum(Debits)
```

This ensures 100% accuracy and audit trail integrity.

### 3. Invoice Management
Invoices support:
- Multiple line items with individual amounts
- Status tracking (draft → sent → paid → overdue)
- Partial payments
- Automatic status updates when fully paid

### 4. Payment Validation
- **Overpayment Prevention**: Can't pay more than invoice total
- **Duplicate Prevention**: Detects same amount payments within 5 seconds
- **Partial Payments**: Support for paying invoices in multiple installments

## 🧪 Testing

Run the ledger logic tests:

```bash
cd backend
npm test
```

Tests cover:
- Double-entry transaction creation
- Balance calculation from transaction log
- Money handling in cents (no floating point)
- Overpayment prevention
- Duplicate payment prevention

## 📡 GraphQL API

### Key Queries

```graphql
# Get all accounts
query {
  accounts {
    id
    name
    type
    balance
    createdAt
  }
}

# Get all transactions
query {
  transactions(limit: 50, offset: 0) {
    id
    debitAccount { id name }
    creditAccount { id name }
    amount
    description
    createdAt
  }
}

# Get invoices
query {
  invoices(status: PAID) {
    id
    invoiceNumber
    account { id name }
    status
    total
    paid
    remaining
  }
}
```

### Key Mutations

```graphql
# Create account
mutation {
  createAccount(name: "Cash", type: ASSET) {
    id
    name
    balance
  }
}

# Record transaction (double-entry)
mutation {
  createTransaction(
    debitAccountId: "..."
    creditAccountId: "..."
    amount: 10000
    description: "Payment"
  ) {
    id
    amount
  }
}

# Create invoice
mutation {
  createInvoice(
    invoiceNumber: "INV-001"
    accountId: "..."
    dueDate: "2024-12-31"
    lineItems: [
      { description: "Service", amount: 10000 }
    ]
  ) {
    id
    status
    total
  }
}

# Apply payment
mutation {
  applyPayment(invoiceId: "...", amount: 5000) {
    id
    status
  }
}
```

## 🏦 Database Schema

### Accounts
```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  balance_cents INTEGER DEFAULT 0,
  created_at DATETIME
)
```

### Transactions (Double-Entry Ledger)
```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  debit_account_id TEXT NOT NULL,
  credit_account_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT,
  created_at DATETIME
)
```

### Invoices
```sql
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  total_cents INTEGER NOT NULL,
  paid_cents INTEGER DEFAULT 0,
  created_at DATETIME
)
```

## 🎯 Edge Cases Handled

### ✅ Duplicate Payment Prevention
- Tracks payments within a 5-second window
- Prevents identical amount payments from being recorded twice
- Useful for webhook retry scenarios

### ✅ Overpayment Prevention
- Validates payment amount against remaining balance
- Throws error if attempting to pay more than owed

### ✅ Money Precision
- All amounts stored in cents (integers)
- Prevents floating-point arithmetic errors
- Example: $123.45 stored as 12345 cents

### ✅ Transaction Atomicity
- All double-entry transactions are atomic
- Debit and credit always match exactly

## 🔄 Data Flow

1. **Create Accounts**: Set up asset, liability, revenue accounts
2. **Record Transactions**: Every transaction creates balanced debit/credit entries
3. **Create Invoices**: Generate invoices with line items and customer accounts
4. **Apply Payments**: Mark payments with validation and prevent duplicates
5. **Query Balances**: Balances calculated on-demand from transaction log

## 📈 Example Workflow

```
1. Create Accounts:
   - Cash (ASSET)
   - Customer A (LIABILITY)
   - Revenue (REVENUE)

2. Record Transaction:
   Debit: Cash +$100
   Credit: Customer A -$100 (they owe us)

3. Create Invoice:
   Invoice #INV-001 for Customer A
   Line Item: Service A - $100
   Total: $100

4. Apply Payment:
   Payment: $100
   Invoice Status: PAID

5. Query Balance:
   Cash: +$100
   Customer A: -$100 (all paid)
```

## ⚡ Performance & Scalability

- **SQLite**: In-memory database for rapid testing, can be switched to PostgreSQL
- **GraphQL**: Efficient querying with only needed fields
- **Indexes**: Transaction queries indexed on account IDs
- **Balance Caching**: Can be added at resolver level for frequently accessed accounts

## 📝 Design Decisions

| Decision | Reason |
|----------|--------|
| Double-Entry Ledger | Industry standard for accounting, ensures balance |
| Amounts in Cents | Eliminates floating-point errors in financial calculations |
| Balance Calculation | On-demand from logs ensures audit trail integrity |
| SQLite | Quick setup, easy to test locally, can scale to PostgreSQL |
| GraphQL | Type-safe, efficient queries, reduces over-fetching |
| React Frontend | Modern UI, real-time updates, component reusability |

## 🚫 What Was Prioritized Over Completeness

Given the 4-5 hour time limit, the following were prioritized:
- ✓ Core ledger logic (double-entry, balance calculation)
- ✓ Payment validation (overpayment, duplicate prevention)
- ✓ UI for all main features
- ✓ Tests for ledger logic

**Not implemented (but documented in comments)**:
- ❌ Authentication/Authorization
- ❌ Multi-currency support (edge case placeholder in code)
- ❌ Concurrent payment race condition handling (using simple timestamp window)
- ❌ Comprehensive error logging
- ❌ Production deployment configuration
- ❌ API rate limiting
- ❌ Full test coverage (only core ledger tested)

## 🔐 Security Notes

This is a demonstration project. For production:
- Add authentication/authorization
- Validate all user inputs server-side
- Add rate limiting and DDoS protection
- Use environment variables for secrets
- Add CORS policies
- Implement audit logging
- Add transaction signing/verification

## 📦 Deployment

To deploy this application:

1. **Backend**: Deploy Node.js server to hosting (Heroku, AWS, DigitalOcean)
2. **Frontend**: Build and deploy to CDN (Vercel, Netlify, AWS S3 + CloudFront)
3. **Database**: Migrate to PostgreSQL for production
4. **API**: Add rate limiting and CORS configuration

## 🐛 Troubleshooting

### Port already in use
```bash
# Kill process on port 4000 (backend)
npx kill-port 4000

# Frontend uses 3000 by default, can configure in .env
```

### Database errors
```bash
# Reset database
rm data/ledger.db

# Backend will recreate on next start
```

### CORS issues
Ensure backend is running on port 4000 before starting frontend.

## 📚 Resources

- [Double-Entry Accounting](https://en.wikipedia.org/wiki/Double-entry_bookkeeping)
- [GraphQL Documentation](https://graphql.org/learn/)
- [React Documentation](https://react.dev/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

## 👤 Author

Created as a Fintech Skill Test for TMS Project

## 📄 License

MIT

---

**Note**: This is a skill test project demonstrating core fintech accounting principles. For production use, add comprehensive error handling, security measures, and comprehensive test coverage.
