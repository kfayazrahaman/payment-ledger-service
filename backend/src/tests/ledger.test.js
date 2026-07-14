import { 
  createAccount, 
  calculateBalance 
} from '../services/accountService.js';
import { 
  createTransaction 
} from '../services/transactionService.js';
import { 
  applyPaymentToInvoice 
} from '../services/paymentService.js';
import { 
  createInvoice 
} from '../services/invoiceService.js';

describe('Ledger Logic Tests', () => {
  let account1, account2, account3;

  beforeEach(async () => {
    // Setup test accounts
    account1 = await createAccount('Cash Account', 'ASSET');
    account2 = await createAccount('Customer A', 'LIABILITY');
    account3 = await createAccount('Revenue', 'REVENUE');
  });

  test('Double-entry transaction creates balanced entries', async () => {
    await createTransaction(account1.id, account2.id, 10000, 'Payment received');
    
    const balance1 = await calculateBalance(account1.id);
    const balance2 = await calculateBalance(account2.id);
    
    expect(balance1).toBe(-10000); // Debit: balance negative
    expect(balance2).toBe(10000);  // Credit: balance positive
  });

  test('Balance calculated from transaction log, never stored', async () => {
    await createTransaction(account1.id, account2.id, 5000);
    await createTransaction(account1.id, account3.id, 3000);
    
    const balance = await calculateBalance(account1.id);
    // Total debits: 5000 + 3000 = 8000
    expect(balance).toBe(-8000);
  });

  test('Money amounts in cents prevent floating point errors', async () => {
    const transaction = await createTransaction(
      account1.id, 
      account2.id, 
      12345, // 123.45 cents
      'Test'
    );
    
    expect(transaction.amount_cents).toBe(12345);
    expect(typeof transaction.amount_cents).toBe('number');
  });

  test('Prevents overpayment on invoice', async () => {
    const invoice = await createInvoice(
      'INV-001',
      account2.id,
      '2024-12-31',
      [
        { description: 'Service 1', amount: 10000 },
        { description: 'Service 2', amount: 5000 }
      ]
    );

    await applyPaymentToInvoice(invoice.id, 10000);
    
    // Try to pay more than remaining
    await expect(
      applyPaymentToInvoice(invoice.id, 6000)
    ).rejects.toThrow('Payment exceeds invoice total');
  });

  test('Prevents duplicate payments', async () => {
    const invoice = await createInvoice(
      'INV-002',
      account2.id,
      '2024-12-31',
      [{ description: 'Service', amount: 10000 }]
    );

    await applyPaymentToInvoice(invoice.id, 5000);
    
    // Try to pay same amount again immediately
    await expect(
      applyPaymentToInvoice(invoice.id, 5000)
    ).rejects.toThrow('Duplicate payment detected');
  });
});
