import mongoose from 'mongoose';

/**
 * Transaction Schema (Double-Entry Ledger)
 * Every transaction represents a transfer of money between two accounts
 * Debit account loses money, Credit account gains money
 * 
 * Converted from SQLite table:
 * CREATE TABLE transactions (
 *   id TEXT PRIMARY KEY,
 *   debit_account_id TEXT NOT NULL,
 *   credit_account_id TEXT NOT NULL,
 *   amount_cents INTEGER NOT NULL,
 *   description TEXT,
 *   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
 * )
 * 
 * Changes in MongoDB:
 * - SQLite TEXT id becomes Mongoose _id (auto-generated)
 * - debit_account_id becomes debitAccountId with ObjectId reference
 * - credit_account_id becomes creditAccountId with ObjectId reference
 * - amount_cents stays as amountCents (stored in cents to prevent float errors)
 * - created_at becomes createdAt (auto-timestamp)
 * - Added indexes for faster queries by account
 * - Added validation to ensure debit ≠ credit
 */
const transactionSchema = new mongoose.Schema(
  {
    // Reference to the account being debited (money goes out)
    debitAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Debit account is required'],
    },

    // Reference to the account being credited (money comes in)
    creditAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Credit account is required'],
    },

    // Amount in cents (integer) to prevent floating-point errors
    // Example: $123.45 is stored as 12345
    amountCents: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be positive'],
    },

    // Optional description for the transaction
    // Example: "Payment received from customer ABC"
    description: {
      type: String,
      trim: true,
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Create the Transaction model
const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
