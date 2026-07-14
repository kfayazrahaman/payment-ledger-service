

import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";

export async function createAccount(name, type) {
  try {
    // Create and save new account
    // Mongoose automatically handles validation based on schema
    const account = await Account.create({
      name: name.trim(),
      type: type.toUpperCase(),
    });

    console.log(`Account created: ${account}`);
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

export async function getAccount(id) {
  try {
    
    console.log("getAccount function:",id)
    const accountId = id?.id || id?._id || id;

    const account = await Account.findOne({ _id: accountId });

    if (!account) {
      console.warn(`Account not found: ${id}`);
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

    console.log(`Retrieved ${accounts.length} accounts`);
    return accounts;
  } catch (error) {
    throw error;
  }
}

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
      `Balance for account ${accountId}: ${balance} cents ($${(balance / 100).toFixed(2)})`,
    );

    return balance;
  } catch (error) {
    throw error;
  }
}
