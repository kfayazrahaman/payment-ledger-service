# GitHub Copilot Instructions for Payment Ledger Service

This file contains custom instructions for working on the Payment Ledger & Invoice Service project.

## Project Overview
- **Purpose**: Mini Payment Ledger & Invoice Service for TMS (Transportation Management System)
- **Tech Stack**: Node.js/Express + GraphQL backend, React frontend, SQLite database
- **Key Focus**: Double-entry accounting, invoice management, payment processing

## Coding Standards

### Backend (Node.js)
- Use async/await for database operations
- Store money amounts in cents (integers) to prevent floating-point errors
- Always validate that debit and credit accounts are different
- Calculate balances from transaction logs, never store as mutable state
- Use UUID for all IDs

### Frontend (React)
- Use functional components with hooks
- Handle API calls with try-catch error handling
- Format money amounts: cents to dollars with 2 decimal places
- Show loading states and error messages
- Disable buttons during API calls

### Database
- All monetary amounts in cents as INTEGER
- Use FOREIGN KEY constraints
- Index frequently queried columns

## Key Features to Maintain

1. **Double-Entry Ledger**: Every transaction must have debit and credit
2. **Balance Calculation**: Always calculated from transaction log
3. **Payment Validation**: Prevent overpayment and duplicate payments
4. **Invoice States**: draft → sent → paid → overdue

## Common Tasks

### Adding a new service
1. Create file in `backend/src/services/`
2. Export async functions for database operations
3. Use `runAsync`, `getAsync`, `allAsync` from database.js
4. Add corresponding GraphQL resolver

### Adding a new component
1. Create `.js` file in `frontend/src/components/`
2. Use axios for API calls to GraphQL endpoint
3. Handle loading and error states
4. Format money with `formatAmount()` helper

### Testing
```bash
cd backend && npm test
```

## Important Notes

- **Amounts**: Always work in cents. Convert from dollars: `amount * 100`
- **GraphQL**: Query `/graphql` endpoint on localhost:4000
- **Ports**: Backend on 4000, Frontend on 3000
- **Database**: SQLite at `backend/data/ledger.db`

## File Locations Reference

- API Server: `backend/src/index.js`
- Database Setup: `backend/src/db/database.js`
- GraphQL Schema: `backend/src/graphql/schema.js`
- Services: `backend/src/services/*.js`
- Main App: `frontend/src/App.js`
- Components: `frontend/src/components/*.js`
