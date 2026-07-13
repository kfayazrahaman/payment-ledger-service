export const typeDefs = `
  enum AccountType {
    ASSET
    LIABILITY
    EQUITY
    REVENUE
    EXPENSE
  }

  enum InvoiceStatus {
    DRAFT
    SENT
    PAID
    OVERDUE
  }

  enum PaymentStatus {
    PENDING
    COMPLETED
    FAILED
  }

  type Account {
    id: ID!
    name: String!
    type: AccountType!
    balance: Int!
    createdAt: String!
  }

  type Transaction {
    id: ID!
    debitAccount: Account
    creditAccount: Account
    amount: Int!
    description: String
    createdAt: String!
  }

  type InvoiceLineItem {
    id: ID!
    description: String!
    amount: Int!
  }

  type Invoice {
    id: ID!
    invoiceNumber: String!
    account: Account
    status: InvoiceStatus!
    lineItems: [InvoiceLineItem!]!
    dueDate: String
    total: Int!
    paid: Int
    remaining: Int!
    createdAt: String!
    updatedAt: String!
  }

  type Payment {
    id: ID!
    invoice: Invoice!
    amount: Int!
    status: PaymentStatus!
    createdAt: String!
  }

  type LedgerBalance {
    account: Account!
    balance: Int!
  }

  type Query {
    accounts: [Account!]!
    account(id: ID!): Account
    transactions(limit: Int, offset: Int): [Transaction!]!
    transaction(id: ID!): Transaction
    invoices(status: InvoiceStatus): [Invoice!]!
    invoice(id: ID!): Invoice
    payments(invoiceId: ID!): [Payment!]!
    ledgerBalance(accountId: ID!): LedgerBalance
  }

  type Mutation {
    createAccount(name: String!, type: AccountType!): Account!
    createTransaction(debitAccountId: String!, creditAccountId: String!, amount: Int!, description: String): Transaction!
    
    createInvoice(invoiceNumber: String!, accountId: String!, dueDate: String, lineItems: [LineItemInput!]!): Invoice!
    updateInvoiceStatus(invoiceId: String!, status: InvoiceStatus!): Invoice!
    
    applyPayment(invoiceId: String!, amount: Int!): Payment!
    
    createRefund(invoiceId: String!, amount: Int!): Transaction!
  }

  input LineItemInput {
    description: String!
    amount: Int!
  }
`;
