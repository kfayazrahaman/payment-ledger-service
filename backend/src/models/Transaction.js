import mongoose from 'mongoose';

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
