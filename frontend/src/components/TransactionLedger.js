import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:6500/graphql';

export default function TransactionLedger() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({
    debitAccountId: '',
    creditAccountId: '',
    amount: '',
    description: ''
  });

  useEffect(() => {
    fetchTransactions();
    fetchAccounts();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await axios.post(API_URL, {
        query: `query { 
          transactions(limit: 100) { 
            id 
            debitAccount { id name }
            creditAccount { id name }
            amount 
            description 
            createdAt 
          } 
        }`
      });
      setTransactions(response.data.data.transactions || []);
      setError(null);
    } catch (err) {
      setError('Failed to load transactions: ' + (err.response?.data?.errors?.[0]?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await axios.post(API_URL, {
        query: `query { accounts { id name } }`
      });
      setAccounts(response.data.data.accounts || []);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();

    if (formData.debitAccountId === formData.creditAccountId) {
      setError('Debit and credit accounts must be different');
      return;
    }

    setLoading(true);
    try {
      const amount = parseInt(formData.amount * 100); // Convert to cents

      const response = await axios.post(API_URL, {
        query: `mutation { 
          createTransaction(
            debitAccountId: "${formData.debitAccountId}"
            creditAccountId: "${formData.creditAccountId}"
            amount: ${amount}
            description: "${formData.description}"
          ) { 
            id 
            debitAccount { id name }
            creditAccount { id name }
            amount 
            description 
            createdAt 
          } 
        }`
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      setSuccess('Transaction recorded successfully!');
      setFormData({ debitAccountId: '', creditAccountId: '', amount: '', description: '' });
      fetchTransactions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to create transaction: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (cents) => {
    return (cents / 100).toFixed(2);
  };

  return (
    <div className="section">
      <h2>Double-Entry Ledger</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleCreateTransaction}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <div className="form-group">
            <label>Debit Account (Money Out)</label>
            <select
              value={formData.debitAccountId}
              onChange={(e) => setFormData({ ...formData, debitAccountId: e.target.value })}
              required
            >
              <option value="">Select account...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Credit Account (Money In)</label>
            <select
              value={formData.creditAccountId}
              onChange={(e) => setFormData({ ...formData, creditAccountId: e.target.value })}
              required
            >
              <option value="">Select account...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Amount (in dollars)</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="e.g., Payment received from customer"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Recording...' : 'Record Transaction'}
        </button>
      </form>

      <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Transaction History</h3>

      {loading ? (
        <div className="loader"></div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions recorded yet.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Debit Account</th>
              <th>Credit Account</th>
              <th>Amount</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn) => (
              <tr key={txn.id}>
                <td>{new Date(txn.createdAt).toLocaleDateString()}</td>
                <td>{txn.debitAccount?.name || 'Unknown'}</td>
                <td>{txn.creditAccount?.name || 'Unknown'}</td>
                <td>${formatAmount(txn.amount)}</td>
                <td>{txn.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
