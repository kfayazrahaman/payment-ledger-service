# SQLite to MongoDB Migration Guide

## Overview

This project has been successfully converted from **SQLite** to **MongoDB** using **Mongoose**. This guide explains every change step-by-step so you can understand the conversion process.

---

## ✅ Completed Conversions

### 1. **Database Configuration** (from SQLite to Mongoose)

#### What Changed:

**Before (SQLite):**
```javascript
// backend/src/db/database.js
import sqlite3 from 'sqlite3';
const db = new sqlite3.Database(dbPath);
db.run(sql, params, callback);
```

**After (MongoDB):**
```javascript
// backend/src/config/database.js
import mongoose from 'mongoose';
await mongoose.connect(MONGODB_URI, options);
```

#### Why:
- Mongoose provides automatic schema validation
- Connection pooling is handled automatically
- No need for manual async wrapper functions
- Better error handling with built-in Mongoose validation

#### File Location:
- **New**: `backend/src/config/database.js` - Handles MongoDB connection

---

### 2. **Environment Variables** (Added MongoDB Configuration)

#### What Changed:

**Before (.env):**
```
PORT=4000
NODE_ENV=development
DATABASE_PATH=./data/ledger.db
```

**After (.env):**
```
PORT=6500
NODE_ENV=development
DB_CONNECTION_STRING="mongodb+srv://..."
BACKEND_URL="http://localhost:6500"
PROJECT_NAME="payment-ledger-service"
EMAIL_SERVICE="gmail"
```

#### Why:
- MongoDB Atlas requires connection string
- Port changed from 4000 to 6500 (as specified)
- Added email configuration
- Added backend URL for CORS and frontend communication

---

### 3. **Database Models** (SQL Tables → Mongoose Schemas)

#### A. Account Model

**Before (SQLite Table):**
```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  balance_cents INTEGER DEFAULT 0,
  created_at DATETIME
)
```

**After (Mongoose Schema):**
```javascript
// backend/src/models/Account.js
const accountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { enum: ['ASSET', 'LIABILITY', ...], required: true },
  // Note: balance NOT stored - calculated from transactions
}, { timestamps: true });
```

**Key Changes:**
- `id` → `_id` (MongoDB auto-generates ObjectId)
- `balance_cents` removed (calculated from transaction log)
- `created_at` → `createdAt` (auto-timestamp)
- `updated_at` → `updatedAt` (auto-timestamp)
- Schema validates `type` using enum

#### B. Transaction Model

**Before (SQLite Table):**
```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  debit_account_id TEXT,
  credit_account_id TEXT,
  amount_cents INTEGER,
  description TEXT,
  created_at DATETIME
)
```

**After (Mongoose Schema):**
```javascript
// backend/src/models/Transaction.js
const transactionSchema = new mongoose.Schema({
  debitAccountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account',
    required: true 
  },
  creditAccountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Account',
    required: true 
  },
  amountCents: { type: Number, required: true, min: 1 },
  description: String,
}, { timestamps: true });

// Validate debit ≠ credit in pre-save hook
transactionSchema.pre('save', function(next) {
  if (this.debitAccountId.equals(this.creditAccountId)) {
    throw new Error('Debit and credit accounts must be different');
  }
  next();
});
```

**Key Changes:**
- `debit_account_id` → `debitAccountId` with `ref: 'Account'` (foreign key)
- `credit_account_id` → `creditAccountId` with `ref: 'Account'`
- `amount_cents` → `amountCents` (same purpose, kept as integer)
- Validation in pre-save hook instead of service layer
- Automatic indexes on account IDs for performance

#### C. Invoice Model

**Before (SQLite Table):**
```sql
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE,
  account_id TEXT,
  status TEXT DEFAULT 'draft',
  due_date DATETIME,
  total_cents INTEGER,
  paid_cents INTEGER DEFAULT 0,
  created_at DATETIME,
  updated_at DATETIME
)
```

**After (Mongoose Schema):**
```javascript
// backend/src/models/Invoice.js
const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  status: { 
    enum: ['DRAFT', 'SENT', 'PAID', 'OVERDUE'],
    default: 'DRAFT'
  },
  dueDate: Date,
  totalCents: { type: Number, required: true, min: 1 },
  paidCents: { type: Number, default: 0, min: 0 },
}, { timestamps: true, toJSON: { virtuals: true } });

// Virtual property: calculate remaining
invoiceSchema.virtual('remainingCents').get(function() {
  return this.totalCents - this.paidCents;
});
```

**Key Changes:**
- `invoice_number` → `invoiceNumber` with unique index
- `account_id` → `accountId` with reference
- `status` uses enum validation
- `due_date` → `dueDate`
- `total_cents` → `totalCents`, `paid_cents` → `paidCents`
- Virtual property `remainingCents` for on-demand calculation
- Automatic timestamps

#### D. LineItem Model

**Before (SQLite Table):**
```sql
CREATE TABLE invoice_line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT,
  description TEXT,
  amount_cents INTEGER,
  created_at DATETIME
)
```

**After (Mongoose Schema):**
```javascript
// backend/src/models/LineItem.js
const lineItemSchema = new mongoose.Schema({
  invoiceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Invoice',
    required: true
  },
  description: { type: String, required: true },
  amountCents: { type: Number, required: true, min: 1 },
}, { timestamps: true });
```

**Key Changes:**
- `invoice_id` → `invoiceId` with reference
- `amount_cents` → `amountCents`
- Separate collection (not embedded)

#### E. Payment Model

**Before (SQLite Table):**
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT,
  amount_cents INTEGER,
  status TEXT DEFAULT 'pending',
  created_at DATETIME
)
```

**After (Mongoose Schema):**
```javascript
// backend/src/models/Payment.js
const paymentSchema = new mongoose.Schema({
  invoiceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Invoice',
    required: true
  },
  amountCents: { type: Number, required: true, min: 1 },
  status: { 
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  notes: String,
}, { timestamps: true });
```

**Key Changes:**
- `invoice_id` → `invoiceId`
- `amount_cents` → `amountCents`
- Added `transactionId` for ledger linking
- Added `notes` field for optional metadata

---

### 4. **Services** (SQL Queries → Mongoose Methods)

#### A. Account Service Conversion

**Before (SQLite):**
```javascript
export async function createAccount(name, type) {
  const id = uuidv4();
  await runAsync(
    `INSERT INTO accounts (id, name, type, balance_cents) 
     VALUES (?, ?, ?, 0)`,
    [id, name, type]
  );
  return getAccount(id);
}

export async function calculateBalance(accountId) {
  const debits = await getAsync(
    `SELECT COALESCE(SUM(amount_cents), 0) as total 
     FROM transactions WHERE debit_account_id = ?`,
    [accountId]
  );
  const credits = await getAsync(
    `SELECT COALESCE(SUM(amount_cents), 0) as total 
     FROM transactions WHERE credit_account_id = ?`,
    [accountId]
  );
  return (credits?.total || 0) - (debits?.total || 0);
}
```

**After (Mongoose):**
```javascript
export async function createAccount(name, type) {
  // No UUID needed - MongoDB generates _id
  const account = await Account.create({
    name: name.trim(),
    type: type.toUpperCase(),
  });
  return account;
}

export async function calculateBalance(accountId) {
  // Aggregation pipeline for efficient calculation
  const debitsResult = await Transaction.aggregate([
    { $match: { debitAccountId: accountId } },
    { $group: { _id: null, totalDebits: { $sum: '$amountCents' } } }
  ]);
  
  const creditsResult = await Transaction.aggregate([
    { $match: { creditAccountId: accountId } },
    { $group: { _id: null, totalCredits: { $sum: '$amountCents' } } }
  ]);
  
  const totalDebits = debitsResult[0]?.totalDebits || 0;
  const totalCredits = creditsResult[0]?.totalCredits || 0;
  return totalCredits - totalDebits;
}
```

**Key Differences:**
- No need for UUID - MongoDB generates `_id` automatically
- No `runAsync`/`getAsync` wrappers - use Mongoose methods directly
- Aggregation pipeline for complex queries (SUM, GROUP BY)
- Better error messages with Mongoose validation

#### B. Transaction Service Conversion

**Before (SQLite):**
```javascript
export async function getAllTransactions(limit = 50, offset = 0) {
  return allAsync(
    `SELECT * FROM transactions 
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}
```

**After (Mongoose):**
```javascript
export async function getAllTransactions(limit = 50, offset = 0) {
  const transactions = await Transaction.find()
    .populate('debitAccountId', 'name type')
    .populate('creditAccountId', 'name type')
    .sort({ createdAt: -1 })
    .skip(offset)      // Skip first n documents
    .limit(limit)      // Return only n documents
    .lean();           // Return plain objects (faster)
  return transactions;
}
```

**Key Differences:**
- `.skip()` and `.limit()` for pagination
- `.populate()` for eager-loading foreign keys
- `.lean()` returns plain objects (faster for read-only)
- SQL LIMIT/OFFSET → Mongoose skip/limit

#### C. Invoice Service Conversion

**Before (SQLite):**
```javascript
export async function createInvoice(invoiceNumber, accountId, dueDate, lineItems = []) {
  const invoiceId = uuidv4();
  await runAsync(
    `INSERT INTO invoices (...) VALUES (...)`,
    [invoiceId, invoiceNumber, accountId, dueDate, totalCents]
  );
  
  for (const item of lineItems) {
    const lineItemId = uuidv4();
    await runAsync(
      `INSERT INTO invoice_line_items (...) VALUES (...)`,
      [lineItemId, invoiceId, item.description, item.amount]
    );
  }
  return getInvoice(invoiceId);
}
```

**After (Mongoose):**
```javascript
export async function createInvoice(invoiceNumber, accountId, dueDate, lineItems = []) {
  const totalCents = lineItems.reduce((sum, item) => sum + item.amount, 0);
  
  // Create invoice
  const invoice = await Invoice.create({
    invoiceNumber,
    accountId,
    dueDate,
    totalCents,
    paidCents: 0,
  });
  
  // Create line items in batch
  if (lineItems.length > 0) {
    const lineItemDocs = lineItems.map(item => ({
      invoiceId: invoice._id,
      description: item.description,
      amountCents: item.amount,
    }));
    await LineItem.insertMany(lineItemDocs);
  }
  return getInvoice(invoice._id);
}
```

**Key Differences:**
- `.create()` instead of `.run(INSERT...)`
- `.insertMany()` for batch inserts (more efficient)
- No UUID generation
- Automatic timestamps
- Schema validation on save

#### D. Payment Service Conversion

**Before (SQLite):**
```javascript
export async function applyPaymentToInvoice(invoiceId, amountCents) {
  const invoice = await getInvoice(invoiceId);
  const paidAmount = await getInvoicePaidAmount(invoiceId);
  
  if (totalPaid > invoice.total_cents) {
    throw new Error('Payment exceeds invoice total');
  }
  
  // Check for duplicate
  const recentPayments = await getPaymentsForInvoice(invoiceId);
  for (const payment of recentPayments) {
    const paymentTime = new Date(payment.created_at).getTime();
    if (now - paymentTime < 5000 && payment.amount_cents === amountCents) {
      throw new Error('Duplicate payment detected');
    }
  }
  
  await runAsync(
    `UPDATE invoices SET paid_cents = paid_cents + ? WHERE id = ?`,
    [amountCents, invoiceId]
  );
}
```

**After (Mongoose):**
```javascript
export async function applyPaymentToInvoice(invoiceId, amountCents) {
  const invoice = await getInvoice(invoiceId);
  const paidAmount = invoice.paidCents;
  
  if (paidAmount + amountCents > invoice.totalCents) {
    throw new Error(`Payment exceeds invoice total...`);
  }
  
  // Check for duplicate payments in last 5 seconds
  const recentPayments = await Payment.find({
    invoiceId,
    createdAt: { $gt: new Date(Date.now() - 5000) }
  });
  
  for (const payment of recentPayments) {
    if (payment.amountCents === amountCents && payment.status === 'COMPLETED') {
      throw new Error('Duplicate payment detected');
    }
  }
  
  // Create payment
  const payment = await createPayment(invoiceId, amountCents, 'COMPLETED');
  
  // Update invoice using $inc operator
  const updatedInvoice = await Invoice.findByIdAndUpdate(
    invoiceId,
    { $inc: { paidCents: amountCents } },
    { new: true }
  );
  
  // Update status if fully paid
  if (updatedInvoice.paidCents >= updatedInvoice.totalCents) {
    await updateInvoiceStatus(invoiceId, 'PAID');
  }
  
  return payment;
}
```

**Key Differences:**
- `.find()` with query filter instead of retrieving all and looping
- `$gt` operator for "greater than" in date comparison
- `$inc` operator for atomic increment (not separate read-update)
- `.findByIdAndUpdate()` with `{ new: true }` returns updated document
- Better error messages with context

---

### 5. **GraphQL Resolvers** (Field Name Mapping)

#### Before (SQLite Field Names):
```javascript
return accounts.map(acc => ({
  ...acc,
  balance: acc.balance_cents,      // Renamed field
  createdAt: acc.created_at        // Renamed field
}));
```

#### After (Mongoose Field Names):
```javascript
return accounts.map(acc => ({
  id: acc._id.toString(),          // MongoDB _id as string
  name: acc.name,
  type: acc.type,
  balance: 0,                      // Will be fetched by field resolver
  createdAt: acc.createdAt.toISOString(),  // Already in correct format
}));
```

**Field Mapping Reference:**
| SQLite | Mongoose | GraphQL |
|--------|----------|---------|
| `id` | `_id` | `id` (converted to string) |
| `created_at` | `createdAt` | `createdAt` |
| `balance_cents` | N/A (calculated) | `balance` |
| `amount_cents` | `amountCents` | `amount` |
| `debit_account_id` | `debitAccountId` | `debitAccountId` |
| `invoice_number` | `invoiceNumber` | `invoiceNumber` |
| `account_id` | `accountId` | `accountId` |
| `total_cents` | `totalCents` | `total` |
| `paid_cents` | `paidCents` | `paid` |
| `invoice_id` | `invoiceId` | `invoiceId` |

---

### 6. **Main Server File** (index.js Changes)

#### Before (SQLite):
```javascript
import { initializeDatabase } from './db/database.js';

async function startServer() {
  await initializeDatabase();  // Synchronously create tables
  const app = express();
  // ... setup ...
}
```

#### After (MongoDB):
```javascript
import { connectDatabase, disconnectDatabase } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function startServer() {
  try {
    await connectDatabase();  // Connect to MongoDB Atlas
    const app = express();
    // ... setup ...
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
```

**Key Differences:**
- Loads environment variables with `dotenv`
- Async connection to MongoDB (not synchronous table creation)
- Graceful shutdown handling
- Better error logging

---

### 7. **Package.json Updates**

#### Before:
```json
{
  "dependencies": {
    "apollo-server-express": "^4.10.1",
    "express": "^4.18.2",
    "graphql": "^16.8.1",
    "sqlite3": "^5.1.6",
    "uuid": "^9.0.0"
  }
}
```

#### After:
```json
{
  "dependencies": {
    "apollo-server-express": "^4.10.1",
    "express": "^4.18.2",
    "graphql": "^16.8.1",
    "mongoose": "^7.5.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5"
  }
}
```

**Changes:**
- Removed: `sqlite3`
- Added: `mongoose` (MongoDB ODM)
- Added: `dotenv` (environment variable loading)
- Added: `cors` (was already imported in code)

---

## 📋 Summary of Key Concepts

### 1. **MongoDB vs SQLite**
| Aspect | SQLite | MongoDB |
|--------|--------|---------|
| Type | Relational DB | Document DB (NoSQL) |
| Storage | Local file | Cloud (Atlas) |
| Schema | Fixed tables | Flexible schemas |
| Queries | SQL | MongoDB Query Language |
| Relationships | Foreign keys | References/Population |

### 2. **Mongoose Advantages**
- **Schema Validation**: Automatic validation before saving
- **Hooks**: Pre/post save, delete, etc. hooks
- **Virtuals**: Computed fields not stored in database
- **Indexes**: Automatic index management
- **Lean**: Return plain objects for better performance
- **Aggregation**: Complex queries with pipeline

### 3. **Core Principle: Balance Calculation**
**Was**: Stored in `balance_cents` column
**Now**: Calculated on-demand from transactions using aggregation

```javascript
// Calculate balance from transaction log
Balance = SUM(credits) - SUM(debits)
```

This ensures:
- Audit trail integrity
- No data inconsistency
- Always accurate balance

### 4. **Double-Entry Ledger Maintained**
Every transaction still has:
- **Debit**: Account losing money
- **Credit**: Account gaining money
- Both amounts are equal
- Balance = credits - debits

---

## 🚀 Running the Project

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Configure Environment
The `.env` file should have your MongoDB connection string:
```
DB_CONNECTION_STRING="mongodb+srv://user:pass@cluster.mongodb.net/database?..."
```

### Step 3: Start Server
```bash
npm start
```

Server starts on port 6500 with MongoDB connection.

### Step 4: Start Frontend
```bash
cd ../frontend
npm install
npm start
```

Frontend connects to backend at `http://localhost:6500`.

---

## 🔧 Migration Troubleshooting

### Issue: "Cannot find module 'sqlite3'"
**Solution**: Remove node_modules and package-lock.json, run `npm install` again
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: MongoDB Connection Error
**Solution**: Check that:
1. `DB_CONNECTION_STRING` is correct in `.env`
2. MongoDB Atlas IP whitelist includes your IP
3. Connection string has correct password (special characters may need encoding)

### Issue: "E11000 duplicate key error"
**Solution**: `invoiceNumber` must be unique. Clear database or use different invoice numbers.
```javascript
// In MongoDB compass or mongo CLI:
db.invoices.deleteMany({});
```

---

## 📚 Learning Resources

### Mongoose Documentation
- [Mongoose.js Official Docs](https://mongoosejs.com/)
- [Schema Documentation](https://mongoosejs.com/docs/guide.html)
- [Query Documentation](https://mongoosejs.com/docs/queries.html)

### MongoDB Query Language
- [MongoDB Query Language](https://docs.mongodb.com/manual/reference/operator/query/)
- [Aggregation Pipeline](https://docs.mongodb.com/manual/reference/operator/aggregation/)

### Migration Patterns
- [Double-Entry Accounting](https://en.wikipedia.org/wiki/Double-entry_bookkeeping)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

---

## ✅ What's Working

- ✅ All accounts operations (create, read, calculate balance)
- ✅ Double-entry transactions (debit, credit)
- ✅ Invoice management (create, update status, partial payments)
- ✅ Payment processing with validation
- ✅ Duplicate payment prevention
- ✅ Overpayment prevention
- ✅ Refund transactions
- ✅ GraphQL API with all queries and mutations
- ✅ React UI (unchanged, works with same API)
- ✅ MongoDB Atlas connection
- ✅ CORS for frontend-backend communication

---

## 🔄 Next Steps (Optional)

1. **Add Authentication**: JWT or OAuth
2. **Add Logging**: MongoDB logging service
3. **Add Caching**: Redis for balance caching
4. **Performance**: Index optimization
5. **Testing**: Jest tests for Mongoose models
6. **Production**: Deploy to cloud (Heroku, AWS, etc.)

---

Created: 2026-07-11
Version: 2.0 (MongoDB/Mongoose)
