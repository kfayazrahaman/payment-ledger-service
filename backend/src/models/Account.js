import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    // Account name (e.g., "Cash Account", "Customer A")
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
    },

    // Account type: ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE
    type: {
      type: String,
      enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
      required: [true, 'Account type is required'],
    },

  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Index for faster queries on account type (common filter)
accountSchema.index({ type: 1 });

// Create the Account model from the schema
const Account = mongoose.model('Account', accountSchema);

export default Account;
