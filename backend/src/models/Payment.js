import mongoose from 'mongoose';

/**
 * Payment Schema
 * Represents a payment made toward an invoice
 * Supports partial payments and payment tracking
 * 
 * Converted from SQLite table:
 * CREATE TABLE payments (
 *   id TEXT PRIMARY KEY,
 *   invoice_id TEXT NOT NULL,
 *   amount_cents INTEGER NOT NULL,
 *   status TEXT DEFAULT 'pending',
 *   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
 * )
 * 
 * Changes in MongoDB:
 * - invoice_id becomes invoiceId with ObjectId reference
 * - amount_cents becomes amountCents (kept as integer in cents)
 * - status now uses enum for validation (PENDING, COMPLETED, FAILED)
 * - Automatic timestamps for tracking when payment was made
 * - Index on invoiceId for fast lookups
 * - Index on status for filtering payments
 */
const paymentSchema = new mongoose.Schema(
  {
    // Reference to the invoice being paid
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: [true, 'Invoice is required'],
      // Index for fast lookup of payments for a specific invoice
      index: true,
    },

    // Amount paid in cents (integer)
    // Example: $50.00 payment is stored as 5000
    amountCents: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [1, 'Payment amount must be positive'],
      // Store as integer in MongoDB
      set: (v) => Math.floor(v),
    },

    // Payment status: PENDING, COMPLETED, or FAILED
    // PENDING: Payment initiated but not yet confirmed
    // COMPLETED: Payment successfully processed
    // FAILED: Payment processing failed
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      // Index for filtering payments by status
      index: true,
    },

    // Optional reference to transaction if this payment is recorded in ledger
    // When a payment is completed, it creates a double-entry transaction
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },

    // Optional notes about the payment (e.g., check number, wire confirmation)
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Compound index for common query: "get completed payments for an invoice"
paymentSchema.index({ invoiceId: 1, status: 1 });

// Index for sorting payments by date
paymentSchema.index({ createdAt: -1 });

// Create the Payment model
const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
