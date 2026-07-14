
import {
  createAccount,
  getAccount,
  getAllAccounts,
  calculateBalance,
} from "../services/accountService.js";
import {
  createTransaction,
  getTransaction,
  getAllTransactions,
} from "../services/transactionService.js";
import {
  createInvoice,
  getInvoice,
  getAllInvoices,
  updateInvoiceStatus,
  getInvoiceLineItems,
} from "../services/invoiceService.js";
import {
  createPayment,
  getPaymentsForInvoice,
  applyPaymentToInvoice,
} from "../services/paymentService.js";
import { createRefundTransaction } from "../services/refundService.js";

const toGraphQLAccount = (accountData, createdAt = null) => {
  if (!accountData) return null;

  const id =
    accountData?._id?.toString() ||
    accountData?.id ||
    (typeof accountData === "string" ? accountData : null);

  return {
    id: id || "unknown-account",
    name: accountData?.name || "Unknown Account",
    type: accountData?.type || "ASSET",
    balance: 0,
    createdAt: createdAt || new Date().toISOString(),
  };
};

const toSafeInt = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
};

export const resolvers = {
  Query: {
    /**
     * Query: Get all accounts
     * Returns array of account documents
     *
     * Mongoose: Accounts have _id (ObjectId), not custom id
     * Balance is calculated from transactions
     */
    accounts: async () => {
      try {
        const accounts = await getAllAccounts();
        return accounts.map((acc) => ({
          id: acc._id.toString(), // Convert ObjectId to string for GraphQL
          name: acc.name,
          type: acc.type,
          balance: 0, // Will be populated by field resolver
          createdAt: acc?.createdAt.toISOString(),
        }));
      } catch (error) {
        console.error("Error fetching accounts:", error);
        throw error;
      }
    },

    /**
     * Query: Get single account by ID
     * Returns account document or null
     */
    account: async (_, { id }) => {
      try {
        const account = await getAccount(id);
        if (!account) return null;

        return {
          id: account._id.toString(),
          name: account.name,
          type: account.type,
          balance: 0, // Will be populated by field resolver
          createdAt: account.createdAt ? account.createdAt.toISOString() : new Date().toISOString(),
        };
      } catch (error) {
        console.error("Error fetching account:", error);
        throw error;
      }
    },

    /**
     * Query: Get all transactions with pagination
     * Returns array of transaction documents
     *
     * Mongoose: Uses skip/limit for pagination (not offset)
     */
    transactions: async (_, { limit = 50, offset = 0 }) => {
      try {
        const transactions = await getAllTransactions(limit, offset);
        return transactions.map((t) => ({
          id: t._id.toString(),
          debitAccount: t?.debitAccountId?._id.toString(),
          creditAccount: t?.creditAccountId?._id.toString(),
          amount: t.amountCents, // Mongoose uses amountCents, GraphQL expects amount
          description: t.description,
          createdAt: t.createdAt ? t.createdAt.toISOString() : new Date().toISOString(),
        }));
      } catch (error) {
        console.error("Error fetching transactions:", error);
        throw error;
      }
    },

    /**
     * Query: Get single transaction by ID
     */
    transaction: async (_, { id }) => {
      try {
        const transaction = await getTransaction(id);
        if (!transaction) return null;

        return {
          id: transaction._id.toString(),
          debitAccountId: transaction?.debitAccountId?._id.toString(),
          creditAccountId: transaction?.creditAccountId?._id.toString(),
          amount: transaction?.amountCents,
          description: transaction?.description,
          createdAt: transaction?.createdAt?.toISOString(),
        };
      } catch (error) {
        console.error("Error fetching transaction:", error);
        throw error;
      }
    },

    /**
     * Query: Get all invoices, optionally filtered by status
     */ 
    invoices: async (_, { status }) => {
      try {
        const invoices = await getAllInvoices(status);
        return invoices.map((inv) => ({
          id: inv._id.toString(),
          invoiceNumber: inv.invoiceNumber,
          account: toGraphQLAccount(inv?.accountId, inv?.createdAt.toISOString()),
          status: inv.status,
          lineItems: [], // Will be populated by field resolver
          dueDate: inv?.dueDate ? new Date(inv.dueDate).toISOString() : null,
          total: toSafeInt(inv?.totalCents ?? inv?.total ?? 0),
          paid: toSafeInt(inv?.paidCents ?? inv?.paid ?? 0),
          remaining:
            toSafeInt(inv?.totalCents ?? inv?.total ?? 0) -
            toSafeInt(inv?.paidCents ?? inv?.paid ?? 0),
          createdAt: inv?.createdAt.toISOString(),
          updatedAt: inv?.updatedAt.toISOString(),
        }));
      } catch (error) {
        console.error("Error fetching invoices:", error);
        throw error;
      }
    },

    /**
     * Query: Get single invoice by ID
     */
    invoice: async (_, { id }) => {
      try {
        const invoice = await getInvoice(id);
        if (!invoice) return null;

        return {
          id: invoice._id.toString(),
          invoiceNumber: invoice?.invoiceNumber,
          account: toGraphQLAccount(invoice?.accountId, invoice?.createdAt.toISOString()),
          status: invoice.status,
          lineItems: [], // Will be populated by field resolver
          dueDate: invoice?.dueDate,
          total: toSafeInt(invoice?.totalCents ?? invoice?.total ?? 0),
          paid: toSafeInt(invoice?.paidCents ?? invoice?.paid ?? 0),
          remaining:
            toSafeInt(invoice?.totalCents ?? invoice?.total ?? 0) -
            toSafeInt(invoice?.paidCents ?? invoice?.paid ?? 0),
          createdAt: invoice?.createdAt.toISOString(),
          updatedAt: invoice?.updatedAt.toISOString(),
        };
      } catch (error) {
        console.error("Error fetching invoice:", error);
        throw error;
      }
    },

    /**
     * Query: Get all payments for an invoice
     */
    payments: async (_, { invoiceId }) => {
      try {
        const payments = await getPaymentsForInvoice(invoiceId);
        return payments.map((p) => ({
          id: p?._id.toString(),
          invoiceId: p?.invoiceId.toString(),
          amount: p?.amountCents,
          status: p?.status,
          createdAt: p?.createdAt.toISOString(),
        }));
      } catch (error) {
        console.error("Error fetching payments:", error);
        throw error;
      }
    },

    /**
     * Query: Get calculated balance for an account
     *
     * This query calculates balance from transaction log
     * (not stored in database - ensures audit trail integrity)
     */
    ledgerBalance: async (_, { accountId }) => {
      try {
        const account = await getAccount(accountId);
        if (!account) return null;

        // Calculate balance from transactions
        const balance = await calculateBalance(accountId);

        return {
          account: {
            id: account?._id.toString(),
            name: account?.name,
            type: account?.type,
            balance: balance,
            createdAt: account?.createdAt ? account.createdAt.toISOString() : new Date().toISOString(),
          },
          balance: balance,
        };
      } catch (error) {
        console.error("Error calculating balance:", error);
        throw error;
      }
    },
  },

  Mutation: {
    /**
     * Mutation: Create a new account
     */
    createAccount: async (_, { name, type }) => {
      try {
        const account = await createAccount(name, type);
        return {
          id: account._id.toString(),
          name: account.name,
          type: account.type,
          balance: 0,
          createdAt: account?.createdAt ? account.createdAt.toISOString() : new Date().toISOString(),
        };
      } catch (error) {
        console.error("Error creating account:", error);
        throw error;
      }
    },

    /**
     * Mutation: Create a double-entry transaction
     *
     * Key: Debit one account, credit another
     * Amount must be positive, accounts must be different
     */
    createTransaction: async (
      _,
      { debitAccountId, creditAccountId, amount, description },
    ) => {
      try {
        const transaction = await createTransaction(
          debitAccountId,
          creditAccountId,
          amount,
          description,
        );

        return {
          id: transaction._id.toString(),
          debitAccount: transaction.debitAccountId,
          creditAccount: transaction.creditAccountId,
          amount: transaction.amountCents,
          description: transaction.description,
          createdAt: transaction.createdAt,
        };
      } catch (error) {
        console.error("Error creating transaction:", error);
        throw error;
      }
    },

    /**
     * Mutation: Create invoice with line items
     */
    createInvoice: async (
      _,
      { invoiceNumber, accountId, dueDate, lineItems },
    ) => {
      try {
        const invoice = await createInvoice(
          invoiceNumber,
          accountId,
          dueDate,
          lineItems,
        );

        console.log("Invoice created:", invoice);
        return {
          id: invoice._id.toString(),
          invoiceNumber: invoice?.invoiceNumber,
          account: toGraphQLAccount(invoice?.accountId, invoice?.createdAt),
          status: invoice.status,
          lineItems: (invoice?.lineItems || []).map((item) => ({
            id: item?._id?.toString() || item?.id || "",
            description: item?.description || "",
            amount: toSafeInt(item?.amountCents ?? item?.amount ?? 0),
          })),
          dueDate: invoice?.dueDate ? new Date(invoice?.dueDate) : null,
          total: toSafeInt(invoice?.totalCents ?? invoice?.total ?? 0),
          paid: toSafeInt(invoice?.paidCents ?? invoice?.paid ?? 0),
          remaining:
            toSafeInt(invoice?.totalCents ?? invoice?.total ?? 0) -
            toSafeInt(invoice?.paidCents ?? invoice?.paid ?? 0),
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
        };
      } catch (error) {
        console.error("Error creating invoice:", error);
        throw error;
      }
    },

    /**
     * Mutation: Update invoice status
     */
    updateInvoiceStatus: async (_, { invoiceId, status }) => {
      try {
        const invoice = await updateInvoiceStatus(invoiceId, status);

        return {
          id: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          account: toGraphQLAccount(invoice?.accountId, invoice?.createdAt),
          status: invoice.status,
          lineItems: [],
          dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
          total: toSafeInt(invoice?.totalCents ?? invoice?.total ?? 0),
          paid: toSafeInt(invoice?.paidCents ?? invoice?.paid ?? 0),
          remaining:
            toSafeInt(invoice?.totalCents ?? invoice?.total ?? 0) -
            toSafeInt(invoice?.paidCents ?? invoice?.paid ?? 0),
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
        };
      } catch (error) {
        console.error("Error updating invoice status:", error);
        throw error;
      }
    },

    /**
     * Mutation: Apply payment to invoice
     *
     * Validates:
     * - Invoice exists
     * - Amount is positive
     * - No overpayment
     * - No duplicate payments
     */
    applyPayment: async (_, { invoiceId, amount }) => {
      try {
        const payment = await applyPaymentToInvoice(invoiceId, amount);

        return {
          id: payment._id.toString(),
          invoiceId: payment.invoiceId.toString(),
          amount: payment.amountCents,
          status: payment.status,
          createdAt: payment.createdAt,
        };
      } catch (error) {
        console.error("Error applying payment:", error);
        throw error;
      }
    },

    /**
     * Mutation: Create a refund transaction
     *
     * Reverses a payment by:
     * 1. Creating a double-entry transaction
     * 2. Reducing invoice paid amount
     * 3. Updating invoice status
     */
    createRefund: async (_, { invoiceId, amount }) => {
      try {
        const transaction = await createRefundTransaction(invoiceId, amount);

        return {
          id: transaction._id.toString(),
          debitAccountId: transaction.debitAccountId.toString(),
          creditAccountId: transaction.creditAccountId.toString(),
          amount: transaction.amountCents,
          description: transaction.description,
          createdAt: transaction.createdAt,
        };
      } catch (error) {
        console.error("Error creating refund:", error);
        throw error;
      }
    },
  },

  /**
   * Field Resolvers for Account
   * These resolve nested fields when queried
   */
  Account: {
    // Account ID: convert ObjectId to string
    id: (account) => account?.id || account?._id?.toString() || "unknown-account",
    name: (account) => account?.name || "Unknown Account",
    type: (account) => account?.type || "ASSET",

    // Balance: calculated from transaction log
    balance: async (account) => {
      try {
        return await calculateBalance(account.id || account._id?.toString());
      } catch (error) {
        console.error("Error calculating account balance:", error);
        return 0;
      }
    },

    createdAt: (account) => account.createdAt,
  },

  /**
   * Field Resolvers for Transaction
   */
  Transaction: {
    id: (transaction) => transaction.id || transaction._id?.toString(),

    // Populate debit account with full details
    debitAccount: async (transaction) => {
      try {
        const account = await getAccount(
          transaction.debitAccount || transaction.debitAccountId,
        );
        if (!account) return null;

        return {
          id: account._id.toString(),
          name: account.name,
          type: account.type,
          balance: 0,
          createdAt: account.createdAt ? account.createdAt.toISOString() : new Date().toISOString(),
        };
      } catch (error) {
        console.error("Error fetching debit account:", error);
        return null;
      }
    },

    // Populate credit account with full details
    creditAccount: async (transaction) => {
      try {
        const account = await getAccount(
          transaction.creditAccount || transaction.creditAccountId,
        );
        if (!account) return null;

        return {
          id: account._id.toString(),
          name: account.name,
          type: account.type,
          balance: 0,
          createdAt: account.createdAt ? account.createdAt.toISOString() : new Date().toISOString(),
        };
      } catch (error) {
        console.error("Error fetching credit account:", error);
        return null;
      }
    },

    amount: (transaction) => transaction.amount || transaction.amountCents,
    description: (transaction) => transaction.description,
    createdAt: (transaction) => transaction.createdAt,
  },

  /**
   * Field Resolvers for Invoice
   */
  Invoice: {
    id: (invoice) => invoice?.id,
    invoiceNumber: (invoice) => invoice?.invoiceNumber,

    // Populate account with full details
    account: async (invoice) => {
      try {
        if (invoice?.account && typeof invoice.account === "object") {
          return {
            id: invoice.account.id || invoice.account._id?.toString() || "unknown-account",
            name: invoice.account.name || "Unknown Account",
            type: invoice.account.type || "ASSET",
            balance: 0,
            createdAt: invoice.account.createdAt || new Date().toISOString(),
          };
        }

        const account = await getAccount(
          invoice.accountId?._id?.toString() || invoice?.accountId || invoice?.account,
        );
        if (!account) return null;

        return {
          id: account?._id?.toString() || account?.id || "unknown-account",
          name: account.name || "Unknown Account",
          type: account.type || "ASSET",
          balance: 0,
          createdAt: account.createdAt || new Date().toISOString(),
        };
      } catch (error) {
        console.error("Error fetching invoice account:", error);
        return null;
      }
    },

    status: (invoice) => invoice?.status,

    // Fetch line items for this invoice
    lineItems: async (invoice) => {
      try {
        const items = await getInvoiceLineItems(
         invoice?.id || invoice?._id?.toString()
        );
        return items.map((item) => ({
          id: item?._id.toString(),
          description: item?.description,
          amount: item?.amountCents,
        }));
      } catch (error) {
        console.error("Error fetching line items:", error);
        return [];
      }
    },

    dueDate: (invoice) => (invoice?.dueDate ? new Date(invoice.dueDate).toISOString() : null),
    total: (invoice) => toSafeInt(invoice?.total ?? invoice?.totalCents ?? 0),
    paid: (invoice) => toSafeInt(invoice?.paid ?? invoice?.paidCents ?? 0),
    remaining: (invoice) => {
      const total = toSafeInt(invoice?.total ?? invoice?.totalCents ?? 0);
      const paid = toSafeInt(invoice?.paid ?? invoice?.paidCents ?? 0);
      return total - paid;
    },
    createdAt: (invoice) => invoice?.createdAt,
    updatedAt: (invoice) => invoice?.updatedAt,
  },

  /**
   * Field Resolvers for Payment
   */
  Payment: {
    id: (payment) => payment.id || payment._id?.toString(),

    // Populate invoice with full details
    invoice: async (payment) => {
      try {
        const invoice = await getInvoice(
          payment.invoiceId?._id?.toString() || payment.invoiceId,
        );
        if (!invoice) return null;

        return {
          id: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          accountId: invoice.accountId.toString(),
          status: invoice.status,
          lineItems: [],
          dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
          total: invoice.totalCents,
          paid: invoice.paidCents,
          remaining: invoice.totalCents - invoice.paidCents,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
        };
      } catch (error) {
        console.error("Error fetching payment invoice:", error);
        return null;
      }
    },

    amount: (payment) => payment.amount || payment.amountCents,
    status: (payment) => payment.status,
    createdAt: (payment) => payment.createdAt,
  },
};
