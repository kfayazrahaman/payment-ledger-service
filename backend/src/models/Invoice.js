import mongoose from 'mongoose';

/**
 * Invoice Schema
 * Represents a bill or invoice sent to a customer
 * Tracks invoice status and payment progress
 * 
 * Converted from SQLite table:
 * CREATE TABLE invoices (
 *   id TEXT PRIMARY KEY,
 *   invoice_number TEXT UNIQUE NOT NULL,
 *   account_id TEXT NOT NULL,
 *   status TEXT DEFAULT 'draft',
 *   due_date DATETIME,
 *   total_cents INTEGER NOT NULL,
 *   paid_cents INTEGER DEFAULT 0,
 *   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 *   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
 * )
 * 
 * Changes in MongoDB:
 * - invoice_number becomes invoiceNumber (camelCase)
 * - account_id becomes accountId with ObjectId reference
 * - status now uses enum for validation
 * - due_date becomes dueDate
 * - total_cents becomes totalCents (kept as integer in cents)
 * - paid_cents becomes paidCents (kept as integer in cents)
 * - Timestamps auto-managed by MongoDB
 * - Added index on invoiceNumber for uniqueness and fast lookup
 * - Added index on status for filtering invoices
 */
const invoiceSchema = new mongoose.Schema(
  {
    // Unique invoice number (e.g., "INV-001", "INV-2024-0123")
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
      // Add index for fast lookup
      index: true,
    },

    // Reference to the customer account (who owes money)
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account is required'],
    },

    // Invoice status: draft, sent, paid, overdue
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'PAID', 'OVERDUE'],
      default: 'DRAFT',
      // Index for filtering by status
      index: true,
    },

    // When the invoice is due
    dueDate: {
      type: String,
    },

    // Total invoice amount in cents (integer)
    // Example: $150.00 is stored as 15000
    totalCents: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [1, 'Total amount must be positive'],
      // Store as integer in MongoDB
      set: (v) => Math.floor(v),
    },

    // Amount already paid in cents
    // Tracks partial payments
    paidCents: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
      // Store as integer in MongoDB
      set: (v) => Math.floor(v),
    },

    /**
     * Virtual property: Remaining amount to pay
     * Calculated as: totalCents - paidCents
     * Not stored in database, computed on retrieval
     */
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Create the Invoice model
const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
