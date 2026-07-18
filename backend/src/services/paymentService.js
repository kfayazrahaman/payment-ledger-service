
import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import mongoose from '../config/database.js';
import {
  getInvoice,
  updateInvoiceStatus,
} from './invoiceService.js';

export async function createPayment(
  invoiceId,
  amountCents,
  status = 'PENDING',
  transactionId = null,
  session = null
) {
  try {
    // Create payment record
    const [payment] = await Payment.create([{
      invoiceId,
      amountCents: Math.floor(amountCents),
      status: status.toUpperCase(),
      transactionId,
    }], { session });

    console.log(
      ` Payment created: $${(amountCents / 100).toFixed(2)} - Status: ${status}`
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

export async function getPaymentsForInvoice(invoiceId) {
  try {
    const payments = await Payment.find({ invoiceId })
      .sort({ createdAt: -1 })
      .lean();

    console.log(
      `Retrieved ${payments.length} payments for invoice ${invoiceId}`
    );

    return payments;
  } catch (error) {
    throw error;
  }
}

export async function applyPaymentToInvoice(invoiceId, amountCents) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Step 1: Fetch invoice
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    console.log(`Processing payment of $${(amountCents / 100).toFixed(2)} for invoice ${invoice.invoiceNumber}`);

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
    const recentPayments = await Payment.find({
      invoiceId,
      createdAt: {
        $gt: new Date(Date.now() - 5000),
      },
    }).session(session);

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
    const payment = await createPayment(invoiceId, amountCents, 'COMPLETED', null, session);

    // Step 7: Update invoice paid amount
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { $inc: { paidCents: amountCents } },
      { new: true, session }
    );

    console.log(`Invoice paid amount updated. Remaining: $${((updatedInvoice.totalCents - updatedInvoice.paidCents) / 100).toFixed(2)}`);

    // Step 8: Update invoice status if fully paid
    if (updatedInvoice.paidCents >= updatedInvoice.totalCents) {
      await updateInvoiceStatus(invoiceId, 'PAID', session);
      console.log(`Invoice ${invoice.invoiceNumber} is now PAID`);
    }

    await session.commitTransaction();
    session.endSession();
    return payment;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(`Payment processing failed: ${error.message}`);
    throw error;
  }
}

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
