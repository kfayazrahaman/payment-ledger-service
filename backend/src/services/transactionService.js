import Transaction from '../models/Transaction.js';

export async function createTransaction(
  debitAccountId,
  creditAccountId,
  amountCents,
  description = null
) {
  try {
    // Additional validation before database operation
    // Note: Schema also validates this, but we check here for immediate feedback
    if (!debitAccountId || !creditAccountId) {
      throw new Error('Both debit and credit account IDs are required');
    }

    if (amountCents <= 0) {
      throw new Error('Transaction amount must be positive');
    }

    // Create transaction
    // Mongoose schema pre-save hook also checks debit ≠ credit
    const transaction = await Transaction.create({
      debitAccountId,
      creditAccountId,
      amountCents: Math.floor(amountCents), // Ensure integer
      description: description ? description.trim() : null,
    });

    console.log(
      `Transaction recorded: $${(amountCents / 100).toFixed(2)} from ${debitAccountId} to ${creditAccountId}`
    );

    return transaction;
  } catch (error) {
    // Handle specific validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(', ');
      throw new Error(`Transaction validation failed: ${messages}`);
    }
    throw error;
  }
}

export async function getTransaction(id) {
  try {
    // findById finds by _id and populates references
    // .populate() replaces account IDs with full account documents
    const transaction = await Transaction.findById(id)
      .populate('debitAccountId', 'name type')
      .populate('creditAccountId', 'name type');

    if (!transaction) {
      console.warn(`Transaction not found: ${id}`);
      return null;
    }

    return transaction;
  } catch (error) {
    // Handle invalid ObjectId format
    if (error.name === 'CastError') {
      throw new Error(`Invalid transaction ID format: ${id}`);
    }
    throw error;
  }
}

export async function getAllTransactions(limit = 50, offset = 0) {
  try {
    // Build query: find all, sort by newest first, skip offset, take limit
    const transactions = await Transaction.find({})
      .populate('debitAccountId', 'name type')
      .populate('creditAccountId', 'name type')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

      console.log("getAllTransactions function",transactions)

    console.log(
      `Retrieved ${transactions.length} transactions (offset: ${offset}, limit: ${limit})`
    );

    return transactions;
  } catch (error) {
    throw error;
  }
}

export async function getTransactionsByAccount(accountId) {
  try {
    // Use $or to find transactions where account is debited OR credited
    const transactions = await Transaction.find({
      $or: [
        { debitAccountId: accountId },
        { creditAccountId: accountId },
      ],
    })
      .populate('debitAccountId', 'name type')
      .populate('creditAccountId', 'name type')
      .sort({ createdAt: -1 });

    console.log(
      `Retrieved ${transactions.length} transactions for account ${accountId}`
    );

    return transactions;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new Error(`Invalid account ID format: ${accountId}`);
    }
    throw error;
  }
}

export async function getTransactionCount(accountId) {
  try {
    const count = await Transaction.countDocuments({
      $or: [
        { debitAccountId: accountId },
        { creditAccountId: accountId },
      ],
    });

    return count;
  } catch (error) {
    throw error;
  }
}
