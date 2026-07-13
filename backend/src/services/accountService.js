/**
 * Account Service - Mongoose Version
 *
 * Handles all account-related operations:
 * - Creating new accounts
 * - Fetching account information
 * - Calculating account balances from transaction logs
 *
 * Key Differences from SQLite Version:
 * - Uses Mongoose models instead of raw SQL
 * - No manual connection management
 * - Built-in validation and indexing
 * - Uses async/await with Mongoose queries
 * - Automatic error handling with try-catch
 */

import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";

/**
 * Create a new account
 *
 * Previously (SQLite):
 * ```sql
 * INSERT INTO accounts (id, name, type, balance_cents)
 * VALUES (?, ?, ?, 0)
 * ```
 *
 * Now (Mongoose): Uses Account.create() which automatically:
 * - Generates _id
 * - Validates schema
 * - Adds timestamps
 *
 * @param {string} name - Account name (e.g., "Cash Account")
 * @param {string} type - Account type (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
 * @returns {Promise<Object>} - Created account document
 * @throws {Error} - If validation fails or database error occurs
 */
export async function createAccount(name, type) {
  try {
    // Create and save new account
    // Mongoose automatically handles validation based on schema
    const account = await Account.create({
      name: name.trim(),
      type: type.toUpperCase(),
    });

    console.log(`✅ Account created: ${account}`);
    return account;
  } catch (error) {
    // Handle specific validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      throw new Error(`Account validation failed: ${messages}`);
    }
    throw error;
  }
}

/**
 * Get a single account by ID
 *
 * Previously (SQLite):
 * ```sql
 * SELECT * FROM accounts WHERE id = ?
 * ```
 *
 * Now (Mongoose): Uses findById() which:
 * - Automatically finds by MongoDB _id
 * - Returns null if not found (instead of undefined)
 *
 * @param {string} id - Account MongoDB ObjectId
 * @returns {Promise<Object|null>} - Account document or null if not found
 * @throws {Error} - If database error occurs
 */
export async function getAccount(id) {
  try {
    
    console.log("getAccount function:",id)
    const accountId = id?.id || id?._id || id;

    const account = await Account.findOne({ _id: accountId });

    if (!account) {
      console.warn(`⚠️ Account not found: ${id}`);
      return null;
    }

    return account;
  } catch (error) {
    // Handle invalid ObjectId format
    if (error.name === "CastError") {
      throw new Error(`Invalid account ID format: ${id}`);
    }
    throw error;
  }
}

/**
 * Get all accounts, optionally filtered by type
 *
 * Previously (SQLite):
 * ```sql
 * SELECT * FROM accounts ORDER BY created_at DESC
 * ```
 *
 * Now (Mongoose): Uses find() which:
 * - Returns array of documents
 * - Supports filtering with query object
 * - Supports sorting, pagination, etc.
 *
 * @param {string} [type] - Optional filter by account type
 * @returns {Promise<Array>} - Array of account documents
 * @throws {Error} - If database error occurs
 */
export async function getAllAccounts(type = null) {
  try {
    let query = Account.find({});

    // Apply type filter if provided
    if (type) {
      query = query.where("type").equals(type.toUpperCase());
    }

    // Sort by creation date (newest first)
    // createdAt is auto-added by Mongoose timestamps
    const accounts = await query.sort({ createdAt: -1 });

    console.log(`✅ Retrieved ${accounts.length} accounts`);
    return accounts;
  } catch (error) {
    throw error;
  }
}

/**
 * Calculate account balance from transaction log
 *
 * This is the core principle of double-entry accounting:
 * Balance = SUM(credits) - SUM(debits)
 *
 * The balance is NOT stored in the database.
 * Instead, it's calculated from the transaction log.
 * This ensures audit trail integrity.
 *
 * Previously (SQLite):
 * ```sql
 * SELECT COALESCE(SUM(amount_cents), 0) as total
 * FROM transactions
 * WHERE credit_account_id = ?
 *
 * SELECT COALESCE(SUM(amount_cents), 0) as total
 * FROM transactions
 * WHERE debit_account_id = ?
 *
 * Balance = credits - debits
 * ```
 *
 * Now (Mongoose): Uses aggregation pipeline which:
 * - Matches transactions where account is credited
 * - Sums up the amounts
 * - Handles null/empty results gracefully
 *
 * @param {string} accountId - Account MongoDB ObjectId
 * @returns {Promise<number>} - Balance in cents
 * @throws {Error} - If database error occurs
 */
export async function calculateBalance(accountId) {
  try {
    // Get sum of all debits (money going out from this account)
    const debitsResult = await Transaction.aggregate([
      {
        // Filter transactions where this account is debited
        $match: { debitAccountId: accountId },
      },
      {
        // Sum up all the amounts
        $group: {
          _id: null,
          totalDebits: { $sum: "$amountCents" },
        },
      },
    ]);

    // Extract the total or default to 0 if no debits
    const totalDebits = debitsResult[0]?.totalDebits || 0;

    // Get sum of all credits (money coming in to this account)
    const creditsResult = await Transaction.aggregate([
      {
        // Filter transactions where this account is credited
        $match: { creditAccountId: accountId },
      },
      {
        // Sum up all the amounts
        $group: {
          _id: null,
          totalCredits: { $sum: "$amountCents" },
        },
      },
    ]);

    // Extract the total or default to 0 if no credits
    const totalCredits = creditsResult[0]?.totalCredits || 0;

    // Calculate balance: credits (in) - debits (out)
    // Positive balance = account has received more than it paid out
    // Negative balance = account has paid out more than it received
    const balance = totalCredits - totalDebits;

    console.log(
      `📊 Balance for account ${accountId}: ${balance} cents ($${(balance / 100).toFixed(2)})`,
    );

    return balance;
  } catch (error) {
    throw error;
  }
}
