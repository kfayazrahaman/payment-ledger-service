import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema(
  {
    // Reference to the parent invoice
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: [true, 'Invoice is required'],
      // Index for fast lookup of line items by invoice
      index: true,
    },

    // Description of the item or service
    // Example: "Professional Services - 10 hours @ $100/hr"
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },

    // Amount for this line item in cents (integer)
    // Example: $99.99 is stored as 9999
    amountCents: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be positive'],
      // Store as integer in MongoDB
      set: (v) => Math.floor(v),
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Create the LineItem model
const LineItem = mongoose.model('LineItem', lineItemSchema);

export default LineItem;
