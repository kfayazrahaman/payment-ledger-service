# Payment Ledger & Invoice Service - Developer Setup Guide

## First Run Setup

### 1. Backend Setup (4-5 minutes)
```bash
cd backend
npm install
npm start
```
✓ Server will start on http://localhost:4000
✓ GraphQL endpoint: http://localhost:4000/graphql

### 2. Frontend Setup (3-4 minutes in another terminal)
```bash
cd frontend
npm install
npm start
```
✓ App will open at http://localhost:3000

### 3. Verify Installation
- Check that both servers are running without errors
- Backend should show: "🚀 Server running at http://localhost:4000"
- Frontend should open the Payment Ledger UI

## Testing the Application

### Using the Web UI
1. Go to Accounts tab → Create Cash and Customer accounts
2. Go to Ledger tab → Record a transaction
3. Go to Invoices tab → Create an invoice
4. Click "Pay" to apply payment to invoice

### Using GraphQL Playground
Navigate to http://localhost:4000/graphql and try:

```graphql
query {
  accounts {
    id
    name
    type
    balance
  }
}
```

## Database

- SQLite database located at: `backend/data/ledger.db`
- Automatically created on first run
- Reset by deleting the file (backend will recreate on restart)

## Running Tests

```bash
cd backend
npm test
```

Tests cover:
- Double-entry transaction logic
- Balance calculation from logs
- Overpayment prevention
- Duplicate payment prevention

## Troubleshooting

**Backend won't start**: Check if port 4000 is in use
```bash
npx kill-port 4000
npm start
```

**Frontend can't connect to API**: Ensure backend is running first on port 4000

**Package installation fails**: Try deleting `node_modules` and `package-lock.json`, then `npm install` again

## Architecture Summary

- **Backend**: Node.js + Express + GraphQL + SQLite
- **Frontend**: React + Axios
- **Core Feature**: Double-entry accounting ledger
- **Key Validation**: Prevents overpayment and duplicate payments
