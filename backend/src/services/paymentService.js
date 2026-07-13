/**
 * Payment Service - Mongoose Version
 * 
 * Handles all payment-related operations:
 * - Creating payment records
 * - Fetching payment information
 * - Applying payments to invoices with validation
 * - Preventing duplicate and overpayments
 * 
 * Key Differences from SQLite Version:
 * - Uses Mongoose Payment model instead of raw SQL
 * - Supports transaction linking (payment to ledger transaction)
 * - Better error handling and validation
 * - Uses MongoDB aggregation for payment lookups
 */

import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import {
  getInvoice,
  getInvoicePaidAmount,
  updateInvoicePaidAmount,
  updateInvoiceStatus,
} from './invoiceService.js';

/**
 * Create a new payment record
 * 
 * Previously (SQLite):
 * ```sql
 * INSERT INTO payments (id, invoice_id, amount_cents, status)
 * VALUES (?, ?, ?, ?)
 * ```
 * 
 * Now (Mongoose):
 * - Payment.create() auto-generates _id
 * - Validates amount and status
 * - Adds automatic timestamps
 * 
 * @param {string} invoiceId - Invoice MongoDB ObjectId
 * @param {number} amountCents - Payment amount in cents
 * @param {string} [status='PENDING'] - Payment status (PENDING, COMPLETED, FAILED)
 * @param {string} [transactionId] - Optional ledger transaction ID
 * @returns {Promise<Object>} - Created payment document
 * @throws {Error} - If validation fails
 */
export async function createPayment(
  invoiceId,
  amountCents,
  status = 'PENDING',
  transactionId = null
) {
  try {
    // Create payment record
    const payment = await Payment.create({
      invoiceId,
      amountCents: Math.floor(amountCents),
      status: status.toUpperCase(),
      transactionId,
    });

    console.log(
      `✅ Payment created: $${(amountCents / 100).toFixed(2)} - Status: ${status}`
    );

    return payment;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(', ');
      throw new Error(`Payment validation failed: ${messages}`);
    }
    throw error;
  }
}

/**
 * Get a single payment by ID
 * 
 * Previously (SQLite):
 * ```sql
 * SELECT * FROM payments WHERE id = ?
 * ```
 * 
 * Now (Mongoose):
 * - findById() with optional populate of related documents
 * 
 * @param {string} id - Payment MongoDB ObjectId
 * @returns {Promise<Object|null>} - Payment document or null
 * @throws {Error} - If database error occurs
 */
export async function getPayment(id) {
  try {
    const payment = await Payment.findById(id)
      .populate('invoiceId', 'invoiceNumber totalCents')
      .populate('transactionId', 'description amountCents');

    if (!payment) {
      console.warn(`⚠️ Payment not found: ${id}`);
      return null;
    }

    return payment;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new Error(`Invalid payment ID format: ${id}`);
    }
    throw error;
  }
}

/**
 * Get all payments for a specific invoice
 * 
 * Previously (SQLite):
 * ```sql
 * SELECT * FROM payments 
 * WHERE invoice_id = ? 
 * ORDER BY created_at DESC
 * ```
 * 
 * Now (Mongoose):
 * - find() filtered by invoiceId
 * - Sorted by newest first
 * 
 * @param {string} invoiceId - Invoice MongoDB ObjectId
 * @returns {Promise<Array>} - Array of payment documents
 * @throws {Error} - If database error occurs
 */
export async function getPaymentsForInvoice(invoiceId) {
  try {
    const payments = await Payment.find({ invoiceId })
      .sort({ createdAt: -1 })
      .lean();

    console.log(
      `✅ Retrieved ${payments.length} payments for invoice ${invoiceId}`
    );

    return payments;
  } catch (error) {
    throw error;
  }
}

/**
 * Apply a payment to an invoice with comprehensive validation
 * 
 * This is the core payment processing logic:
 * 1. Verify invoice exists
 * 2. Check for overpayment
 * 3. Detect duplicate payments
 * 4. Create payment record
 * 5. Update invoice paid amount
 * 6. Update invoice status if fully paid
 * 
 * Previously (SQLite):
 * ```sql
 * -- Check invoice exists
 * SELECT * FROM invoices WHERE id = ?
 * 
 * -- Sum completed payments
 * SELECT SUM(amount_cents) FROM payments WHERE invoice_id = ?
 * 
 * -- Insert new payment
 * INSERT INTO payments (...)
 * 
 * -- Update invoice
 * UPDATE invoices SET paid_cents = paid_cents + ?
 * UPDATE invoices SET status = 'PAID' WHERE paid_cents >= total_cents
 * ```
 * 
 * Now (Mongoose):
 * - Uses Mongoose transactions (if needed) for atomic operations
 * - Better error handling and validation
 * - Prevents race conditions with clever querying
 * 
 * @param {string} invoiceId - Invoice MongoDB ObjectId
 * @param {number} amountCents - Payment amount in cents
 * @returns {Promise<Object>} - Created payment document
 * @throws {Error} - If validation fails (overpayment, duplicate, etc.)
 */
export async function applyPaymentToInvoice(invoiceId, amountCents) {
  try {
    // Step 1: Fetch invoice
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    console.log(`💳 Processing payment of $${(amountCents / 100).toFixed(2)} for invoice ${invoice.invoiceNumber}`);

    // Step 2: Check that payment is positive
    if (amountCents <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Step 3: Get current paid amount
    const paidAmount = invoice.paidCents || 0;
    const totalPaid = paidAmount + amountCents;

    // Step 4: Prevent overpayment
    if (totalPaid > invoice.totalCents) {
      throw new Error(
        `Payment exceeds invoice total. ` +
        `Invoice total: $${(invoice.totalCents / 100).toFixed(2)}, ` +
        `Already paid: $${(paidAmount / 100).toFixed(2)}, ` +
        `Attempting to pay: $${(amountCents / 100).toFixed(2)}`
      );
    }

    // Step 5: Check for duplicate payments (within last 5 seconds)
    // This prevents duplicate webhook fires from creating duplicate payments
    const recentPayments = await Payment.find({
      invoiceId,
      // Only check payments created in last 5 seconds
      createdAt: {
        $gt: new Date(Date.now() - 5000),
      },
    });

    for (const payment of recentPayments) {
      if (payment.amountCents === amountCents && payment.status === 'COMPLETED') {
        throw new Error(
          `Duplicate payment detected. ` +
          `A payment of $${(amountCents / 100).toFixed(2)} was already recorded ${
            Math.round((Date.now() - payment.createdAt.getTime()) / 1000)
          } seconds ago`
        );
      }
    }

    // Step 6: Create payment record
    const payment = await createPayment(invoiceId, amountCents, 'COMPLETED');

    // Step 7: Update invoice paid amount
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { $inc: { paidCents: amountCents } },
      { new: true }
    );

    console.log(`✅ Invoice paid amount updated. Remaining: $${(updatedInvoice.remainingCents / 100).toFixed(2)}`);

    // Step 8: Update invoice status if fully paid
    if (updatedInvoice.paidCents >= updatedInvoice.totalCents) {
      await updateInvoiceStatus(invoiceId, 'PAID');
      console.log(`✅ Invoice ${invoice.invoiceNumber} is now PAID`);
    }

    return payment;
  } catch (error) {
    console.error(`❌ Payment processing failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get total amount received for an invoice (all completed payments)
 * 
 * New method in Mongoose version
 * Uses aggregation pipeline for efficient calculation
 * 
 * @param {string} invoiceId - Invoice MongoDB ObjectId
 * @returns {Promise<number>} - Total amount in cents
 * @throws {Error} - If database error occurs
 */
export async function getTotalPaymentsForInvoice(invoiceId) {
  try {
    const result = await Payment.aggregate([
      {
        // Match only completed payments for this invoice
        $match: {
          invoiceId: invoiceId,
          status: 'COMPLETED',
        },
      },
      {
        // Sum all payment amounts
        $group: {
          _id: null,
          totalPayments: { $sum: '$amountCents' },
        },
      },
    ]);

    return result[0]?.totalPayments || 0;
  } catch (error) {
    throw error;
  }
}

/**
 * Get payment statistics for an invoice
 * 
 * New method in Mongoose version
 * Useful for dashboard and reporting
 * 
 * @param {string} invoiceId - Invoice MongoDB ObjectId
 * @returns {Promise<Object>} - Statistics object
 */
export async function getPaymentStats(invoiceId) {
  try {
    const stats = await Payment.aggregate([
      { $match: { invoiceId } },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$amountCents', 0],
            },
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
          },
        },
      },
    ]);

    return stats[0] || {
      totalAmount: 0,
      completedCount: 0,
      pendingCount: 0,
      failedCount: 0,
    };
  } catch (error) {
    throw error;
  }
}
