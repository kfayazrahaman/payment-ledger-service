import mongoose from 'mongoose';

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
