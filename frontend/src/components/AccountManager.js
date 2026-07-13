import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:6500/graphql';

export default function AccountManager() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({ name: '', type: 'ASSET' });
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await axios.post(API_URL, {
        query: `query { 
          accounts { 
            id 
            name 
            type 
            balance 
            createdAt 
          } 
        }`
      });
      setAccounts(response.data.data.accounts || []);
      setError(null);
    } catch (err) {
      setError('Failed to load accounts: ' + (err.response?.data?.errors?.[0]?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(API_URL, {
        query: `mutation { 
          createAccount(name: "${formData.name}", type: ${formData.type}) { 
            id 
            name 
            type 
            balance 
            createdAt 
          } 
        }`
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      setSuccess('Account created successfully!');
      setFormData({ name: '', type: 'ASSET' });
      fetchAccounts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to create account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (cents) => {
    return (cents / 100).toFixed(2);
  };

  return (
    <div className="section">
      <h2>Manage Accounts</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleCreateAccount}>
        <div className="form-group">
          <label>Account Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Main Cash Account"
            required
          />
        </div>

        <div className="form-group">
          <label>Account Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            <option value="ASSET">Asset</option>
            <option value="LIABILITY">Liability</option>
            <option value="EQUITY">Equity</option>
            <option value="REVENUE">Revenue</option>
            <option value="EXPENSE">Expense</option>
          </select>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>

      <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Existing Accounts</h3>

      {loading ? (
        <div className="loader"></div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <p>No accounts created yet. Create one to get started!</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Balance</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td>{account.type}</td>
                <td>${formatAmount(account.balance)}</td>
                <td>{new Date(account.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
