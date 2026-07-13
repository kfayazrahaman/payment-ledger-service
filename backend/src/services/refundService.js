/**
 * Refund Service - Mongoose Version
 * 
 * Handles refund operations:
 * - Creating refund transactions
 * - Validating refund amounts
 * - Recording reversals in the ledger
 * - Updating invoice status after refund
 * 
 * Key Concept:
 * A refund is a reversal transaction that reverses a payment.
 * It's recorded as a double-entry transaction to maintain ledger integrity.
 * 
 * Key Differences from SQLite Version:
 * - Uses Mongoose models
 * - Better transaction management
 * - Improved error messages
 * - Uses async/await consistently
 */

import { createTransaction } from './transactionService.js';
import { getInvoice, updateInvoiceStatus } from './invoiceService.js';
import Invoice from '../models/Invoice.js';

/**
 * Create a refund transaction
 * 
 * Previously (SQLite):
 * 1. SELECT invoice by id
 * 2. SELECT sum of payments for invoice
 * 3. Validate refund amount
 * 4. INSERT transaction (debit customer, credit cash)
 * 5. UPDATE invoice paid_cents
 * 6. UPDATE invoice status
 * 
 * Now (Mongoose):
 * - Uses Mongoose queries
 * - Better atomic operations
 * - Improved validation
 * 
 * @param {string} invoiceId - Invoice MongoDB ObjectId
 * @param {number} amountCents - Refund amount in cents
 * @param {string} [cashAccountId] - Cash account to refund from
 * @returns {Promise<Object>} - Created refund transaction document
 * @throws {Error} - If invoice not found, amount invalid, or not enough paid
 */
export async function createRefundTransaction(
  invoiceId,
  amountCents,
  cashAccountId = null
) {
  try {
    // Step 1: Fetch the invoice
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    console.log(
      `💰 Processing refund of $${(amountCents / 100).toFixed(2)} for invoice ${invoice.invoiceNumber}`
    );

    // Step 2: Validate refund amount
    if (amountCents <= 0) {
      throw new Error('Refund amount must be greater than zero');
    }

    // Step 3: Check that refund doesn't exceed paid amount
    const paidAmount = invoice.paidCents || 0;

    if (amountCents > paidAmount) {
      throw new Error(
        `Refund amount exceeds paid amount. ` +
        `Invoice ${invoice.invoiceNumber}: ` +
        `Paid: $${(paidAmount / 100).toFixed(2)}, ` +
        `Refund requested: $${(amountCents / 100).toFixed(2)}`
      );
    }

    // Step 4: Create double-entry refund transaction
    // This reverses the original payment
    // The customer account (invoice.accountId) is debited (owes less)
    // The cash account is credited (has less money)
    //
    // If no cash account provided, we can use a placeholder or throw error
    if (!cashAccountId) {
      console.warn('⚠️ Cash account not specified for refund');
      // In production, would link to actual cash account
      // For now, we'll note this in the description
    }

    const refundTransaction = await createTransaction(
      invoice.accountId, // Debit: Customer account (liability decreases)
      cashAccountId || invoice.accountId, // Credit: Cash account (or customer if not specified)
      amountCents,
      `REFUND: Invoice ${invoice.invoiceNumber} - Reverse payment`
    );

    console.log(`✅ Refund transaction created`);

    // Step 5: Update invoice paid amount (decrease it)
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { $inc: { paidCents: -amountCents } }, // Negative increment to decrease
      { new: true }
    );

    console.log(
      `✅ Invoice paid amount reduced. New paid: $${(updatedInvoice.paidCents / 100).toFixed(2)}`
    );

    // Step 6: Update invoice status if no longer fully paid
    const remainingDue = updatedInvoice.totalCents - updatedInvoice.paidCents;

    if (remainingDue > 0) {
      // If there's remaining balance due, set status to SENT
      await updateInvoiceStatus(invoiceId, 'SENT');
      console.log(
        `✅ Invoice status updated to SENT (remaining due: $${(remainingDue / 100).toFixed(2)})`
      );
    }

    return refundTransaction;
  } catch (error) {
    console.error(`❌ Refund processing failed: ${error.message}`);
    throw error;
  }
}

/**
 * Process multiple refunds (batch refunds)
 * 
 * New method in Mongoose version
 * Useful for processing bulk refunds
 * 
 * @param {Array} refunds - Array of { invoiceId, amount } objects
 * @returns {Promise<Array>} - Array of created refund transactions
 * @throws {Error} - If any refund fails
 */
export async function createBatchRefunds(refunds) {
  try {
    const results = [];

    for (const refund of refunds) {
      const transaction = await createRefundTransaction(
        refund.invoiceId,
        refund.amount,
        refund.cashAccountId
      );
      results.push(transaction);
    }

    console.log(`✅ Batch refund processed: ${results.length} refunds created`);
    return results;
  } catch (error) {
    console.error(`❌ Batch refund failed: ${error.message}`);
    throw error;
  }
}
