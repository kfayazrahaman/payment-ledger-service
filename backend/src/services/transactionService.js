/**
 * Transaction Service - Mongoose Version
 * 
 * Handles all transaction-related operations for the double-entry ledger:
 * - Creating transactions (debit one account, credit another)
 * - Fetching transaction information
 * - Querying transactions by account or filter criteria
 * 
 * Key Differences from SQLite Version:
 * - Uses Mongoose Transaction model instead of raw SQL
 * - Schema validation prevents invalid transactions automatically
 * - Uses async/await with Mongoose queries
 * - Aggregation pipeline support for complex queries
 * - Automatic indexes for fast queries
 */

import Transaction from '../models/Transaction.js';

/**
 * Create a new double-entry transaction
 * 
 * Previously (SQLite):
 * ```sql
 * INSERT INTO transactions 
 * (id, debit_account_id, credit_account_id, amount_cents, description)
 * VALUES (?, ?, ?, ?, ?)
 * ```
 * 
 * Now (Mongoose): Uses Transaction.create() which:
 * - Auto-generates _id
 * - Validates schema (including debit ≠ credit check)
 * - Adds timestamps
 * - Runs pre-save hooks for business logic
 * 
 * @param {string} debitAccountId - MongoDB ObjectId of account being debited
 * @param {string} creditAccountId - MongoDB ObjectId of account being credited
 * @param {number} amountCents - Amount in cents (must be positive integer)
 * @param {string} [description] - Optional transaction description
 * @returns {Promise<Object>} - Created transaction document
 * @throws {Error} - If validation fails or accounts are invalid
 */
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
      `✅ Transaction recorded: $${(amountCents / 100).toFixed(2)} from ${debitAccountId} to ${creditAccountId}`
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

/**
 * Get a single transaction by ID
 * 
 * Previously (SQLite):
 * ```sql
 * SELECT * FROM transactions WHERE id = ?
 * ```
 * 
 * Now (Mongoose): Uses findById() and populates account references
 * 
 * @param {string} id - Transaction MongoDB ObjectId
 * @returns {Promise<Object|null>} - Transaction document with populated accounts or null
 * @throws {Error} - If database error occurs
 */
export async function getTransaction(id) {
  try {
    // findById finds by _id and populates references
    // .populate() replaces account IDs with full account documents
    const transaction = await Transaction.findById(id)
      .populate('debitAccountId', 'name type')
      .populate('creditAccountId', 'name type');

    if (!transaction) {
      console.warn(`⚠️ Transaction not found: ${id}`);
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

/**
 * Get multiple transactions with pagination
 * 
 * Previously (SQLite):
 * ```sql
 * SELECT * FROM transactions 
 * ORDER BY created_at DESC 
 * LIMIT ? OFFSET ?
 * ```
 * 
 * Now (Mongoose): Uses find() with limit and skip
 * - limit(n): returns only n documents
 * - skip(n): skips first n documents (for pagination)
 * 
 * @param {number} [limit=50] - Maximum number of transactions to return
 * @param {number} [offset=0] - Number of transactions to skip (for pagination)
 * @returns {Promise<Array>} - Array of transaction documents
 * @throws {Error} - If database error occurs
 */
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
      `✅ Retrieved ${transactions.length} transactions (offset: ${offset}, limit: ${limit})`
    );

    return transactions;
  } catch (error) {
    throw error;
  }
}

/**
 * Get all transactions involving a specific account
 * 
 * Previously (SQLite):
 * ```sql
 * SELECT * FROM transactions 
 * WHERE debit_account_id = ? OR credit_account_id = ? 
 * ORDER BY created_at DESC
 * ```
 * 
 * Now (Mongoose): Uses $or operator in query
 * - Finds transactions where account is either debited or credited
 * 
 * @param {string} accountId - Account MongoDB ObjectId
 * @returns {Promise<Array>} - Array of transaction documents
 * @throws {Error} - If database error occurs
 */
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
      `✅ Retrieved ${transactions.length} transactions for account ${accountId}`
    );

    return transactions;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new Error(`Invalid account ID format: ${accountId}`);
    }
    throw error;
  }
}

/**
 * Get transaction count for an account
 * Useful for statistics and reporting
 * 
 * New method in Mongoose version
 * 
 * @param {string} accountId - Account MongoDB ObjectId
 * @returns {Promise<number>} - Number of transactions for this account
 * @throws {Error} - If database error occurs
 */
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
