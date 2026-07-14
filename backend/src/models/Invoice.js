import mongoose from 'mongoose';
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
      type: Date,
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
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Create the Invoice model
const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
