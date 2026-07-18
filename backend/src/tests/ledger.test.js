import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

// Import real services
import { createAccount, calculateBalance } from '../services/accountService.js';
import { createTransaction } from '../services/transactionService.js';
import { applyPaymentToInvoice } from '../services/paymentService.js';
import { createInvoice, getInvoice, updateInvoiceStatus } from '../services/invoiceService.js';
import { createRefundTransaction } from '../services/refundService.js';

// Import real models to clean up DB
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import Invoice from '../models/Invoice.js';
import LineItem from '../models/LineItem.js';
import Payment from '../models/Payment.js';

// Connect to the database before all tests run
beforeAll(async () => {
  // This assumes your environment is set up to use a TEST database
  // when process.env.NODE_ENV === 'test'.
  await connectDatabase();
});

// Disconnect after all tests are done
afterAll(async () => {
  // Completely clear the test database
  await mongoose.connection.db.dropDatabase();
  await disconnectDatabase();
});

// Before each test, clear all data to ensure tests are isolated
beforeEach(async () => {
  await Promise.all([
    Account.deleteMany({}),
    Transaction.deleteMany({}),
    Invoice.deleteMany({}),
    LineItem.deleteMany({}),
    Payment.deleteMany({}),
  ]);
});

describe('Ledger Integration Tests', () => {
  test('Double-entry transaction creates balanced entries', async () => {
    const cashAccount = await createAccount('Cash', 'ASSET');
    const customerAccount = await createAccount('Customer A', 'LIABILITY');

    // Debit Cash, Credit Customer
    await createTransaction(cashAccount._id, customerAccount._id, 10000, 'Payment received');

    // calculateBalance now works with the real database
    const cashBalance = await calculateBalance(cashAccount._id);
    const customerBalance = await calculateBalance(customerAccount._id);

    // Balance = Credits - Debits.
    // Cash was debited, so its balance is 0 - 10000 = -10000
    expect(cashBalance).toBe(-10000);
    // Customer was credited, so its balance is 10000 - 0 = 10000
    expect(customerBalance).toBe(10000);
  });

  test('Balance is calculated correctly from multiple transactions', async () => {
    const cashAccount = await createAccount('Cash', 'ASSET');
    const revenueAccount = await createAccount('Sales Revenue', 'REVENUE');

    // Record two separate transactions where cash is debited
    await createTransaction(cashAccount._id, revenueAccount._id, 5000);
    await createTransaction(cashAccount._id, revenueAccount._id, 3000);

    const cashBalance = await calculateBalance(cashAccount._id);

    // Total debits to cash: 5000 + 3000 = 8000. Balance = 0 - 8000
    expect(cashBalance).toBe(-8000);
  });

  test('Prevents overpayment on an invoice', async () => {
    const customerAccount = await createAccount('Test Customer', 'LIABILITY');
    const invoice = await createInvoice(
      'INV-OVERPAY',
      customerAccount._id,
      '2024-12-31',
      [{ description: 'Service', amount: 10000 }] // Total is 10000 cents
    );

    // First payment is fine
    await applyPaymentToInvoice(invoice._id.toString(), 8000);

    // Second payment attempts to overpay (remaining is 2000, paying 3000)
    await expect(
      applyPaymentToInvoice(invoice._id.toString(), 3000)
    ).rejects.toThrow('Payment exceeds invoice total');
  });

  test('Prevents duplicate payments', async () => {
    const customerAccount = await createAccount('Test Customer', 'LIABILITY');
    const invoice = await createInvoice(
      'INV-DUPE',
      customerAccount._id,
      '2024-12-31',
      [{ description: 'Service', amount: 10000 }]
    );

    // First payment is fine
    await applyPaymentToInvoice(invoice._id.toString(), 5000);

    // Immediately trying to pay the same amount again should fail
    await expect(
      applyPaymentToInvoice(invoice._id.toString(), 5000)
    ).rejects.toThrow(/Duplicate payment detected/);
  });

  test('Processes a refund correctly and updates invoice status', async () => {
    const customerAccount = await createAccount('Refunding Customer', 'LIABILITY');
    const cashAccount = await createAccount('Company Cash', 'ASSET');
    let invoice = await createInvoice(
      'INV-REFUND',
      customerAccount._id,
      '2024-12-31',
      [{ description: 'Product', amount: 10000 }] // Total is 10000 cents
    );

    // Pay the invoice in full
    await applyPaymentToInvoice(invoice._id.toString(), 10000);

    // Verify it's paid
    let paidInvoice = await getInvoice(invoice._id.toString());
    expect(paidInvoice.status).toBe('PAID');
    expect(paidInvoice.paidCents).toBe(10000);

    // Now, process a partial refund
    await createRefundTransaction(invoice._id.toString(), 4000, cashAccount._id);

    // Re-fetch the invoice and check its state
    const refundedInvoice = await getInvoice(invoice._id.toString());

    // The status should no longer be PAID because a balance is now due
    expect(refundedInvoice.status).toBe('SENT');
    // The paid amount should be reduced by the refund amount
    expect(refundedInvoice.paidCents).toBe(6000); // 10000 - 4000
  });
});
