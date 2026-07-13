# Architecture & Design Decisions

## Core Principles

### 1. Double-Entry Accounting ✓
Every transaction affects two accounts:
```
Payment of $100:
- Debit (decrease): Cash Account
- Credit (increase): Customer Account
```
This is the gold standard in accounting and ensures the ledger always balances.

### 2. Stateless Balance Calculation ✓
Balances are calculated on-demand, never stored:
```javascript
Balance = SUM(credits) - SUM(debits)
```
**Advantages**:
- Audit trail integrity: ledger is source of truth
- No synchronization issues
- Easy to trace any balance to specific transactions
- Prevents mutable state errors

### 3. Monetary Precision ✓
All amounts stored as integers (cents):
```javascript
$123.45 → 12345 cents
```
**Advantages**:
- No floating-point rounding errors
- JavaScript can safely handle 64-bit integers
- Real-world fintech standard
- Easy currency conversion

## Architecture Layers

### API Layer (GraphQL)
- `schema.js`: Type definitions
- `resolvers.js`: Query and mutation handlers
- Separates business logic from HTTP concerns

### Service Layer
- `accountService.js`: Account CRUD
- `transactionService.js`: Double-entry transaction logic
- `invoiceService.js`: Invoice management
- `paymentService.js`: Payment processing with validation
- `refundService.js`: Refund transactions

Each service handles a specific domain and exposes async functions.

### Data Layer (SQLite)
- `database.js`: Connection, migrations, async wrappers
- Promise-based queries for clean async/await
- Foreign key constraints for data integrity

### Frontend Layer (React)
- Separated components for different domains
- API calls via axios
- State management with React hooks
- Responsive design with CSS Grid

## Key Validation Rules

### Payment Validation
```javascript
// 1. Debit ≠ Credit
if (debitId === creditId) throw error;

// 2. Positive amount
if (amount <= 0) throw error;

// 3. No overpayment
if (paid + amount > total) throw error;

// 4. No duplicate payments
if (recentPayment.amount === amount && recentPayment.time < 5s) throw error;
```

## Database Design

### Normalization
- Accounts: 1 row per account
- Transactions: 2 rows per logical transaction (debit + credit)
- Invoices: 1 row per invoice
- Line Items: 1 row per line

### Constraints
- Primary keys on all tables
- Foreign keys on debit/credit accounts
- UNIQUE on invoice numbers
- Cascading deletes (if needed)

## Edge Cases Handled

### ✅ Duplicate Payment Detection
**Problem**: Payment webhook can fire twice for same payment
**Solution**: Track recent payments in 5-second window
**Location**: `paymentService.js#applyPaymentToInvoice`

### ✅ Overpayment Prevention
**Problem**: User clicks pay twice, pays more than owed
**Solution**: Validate total amount before accepting payment
**Location**: `paymentService.js#applyPaymentToInvoice`

### ✅ Floating-Point Errors
**Problem**: $0.10 + $0.20 ≠ $0.30 in JavaScript
**Solution**: Store all amounts in cents
**Location**: All services and GraphQL

## Performance Considerations

### ✅ What's Fast
- Balance queries: O(n) where n = transaction count for account
- Single transaction: O(1) insert
- Invoice lookup: O(1) by ID

### ⚠️ What Could Be Optimized
- Balance calculation: cache for frequently accessed accounts
- Transaction history: pagination (already implemented)
- Indexes: add on debit_account_id, credit_account_id
- Database: switch to PostgreSQL for production

### 🚀 Scaling Strategy
1. Add indexes on foreign keys
2. Cache balances with TTL
3. Migrate to PostgreSQL
4. Add read replicas for reporting
5. Consider event sourcing for audit trails

## Testing Strategy

### Unit Tests (ledger.test.js)
- Double-entry transaction creation
- Balance calculation accuracy
- Overpayment prevention
- Duplicate payment prevention

### Integration Tests (not yet implemented)
- Full invoice workflow
- Payment status updates
- Database constraints

### Manual Testing (via UI)
- Create accounts
- Record transactions
- Create and pay invoices
- Check balances

## Security Considerations

### Current State (Development Only)
- No authentication
- No input validation
- No rate limiting
- No logging

### For Production
1. **Authentication**: JWT or OAuth
2. **Authorization**: Role-based access (RBAC)
3. **Validation**: Server-side validation for all inputs
4. **Encryption**: TLS for transit, encryption at rest
5. **Logging**: Audit logs for all transactions
6. **Rate Limiting**: Prevent abuse
7. **CORS**: Restrict to known origins

## Why These Choices?

| Choice | Alternative | Reason |
|--------|-------------|--------|
| Double-Entry | Single Entry | Industry standard, ensures balance |
| Calculated Balance | Stored Balance | Audit trail integrity |
| Cents Storage | Float Storage | Precision, no rounding errors |
| SQLite | PostgreSQL | Quick setup, testable locally |
| GraphQL | REST | Type safety, efficient queries |
| React | Vue/Angular | Popular, good ecosystem |
| Async/Await | Promises/Callbacks | Cleaner code, easier debugging |

## Future Enhancements

### Phase 2
- [ ] Multi-currency support with exchange rates
- [ ] Recurring invoices
- [ ] Invoice templates
- [ ] Payment plans (installment invoices)

### Phase 3
- [ ] Bank reconciliation
- [ ] Tax calculation
- [ ] Financial reporting
- [ ] Compliance audits

### Phase 4
- [ ] Mobile app
- [ ] Real-time notifications
- [ ] Advanced analytics
- [ ] Machine learning for payment prediction
