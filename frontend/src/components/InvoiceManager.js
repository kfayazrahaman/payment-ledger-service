import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:6500/graphql';

export default function InvoiceManager() {
  const [invoices, setInvoices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [lineItems, setLineItems] = useState([{ description: '', amount: '' }]);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    accountId: '',
    dueDate: '',
  });

  useEffect(() => {
    fetchInvoices();
    fetchAccounts();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await axios.post(API_URL, {
        query: `query { 
          invoices { 
            id 
            invoiceNumber 
            account { id name }
            status 
            total 
            paid 
            remaining
            dueDate 
            createdAt 
          } 
        }`
      });
      setInvoices(response.data.data.invoices || []);
      setError(null);
    } catch (err) {
      setError('Failed to load invoices: ' + (err.response?.data?.errors?.[0]?.message || err.message));
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

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { description: '', amount: '' }]);
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  };

  const handleRemoveLineItem = (index) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();

    if (lineItems.some(item => !item.description || !item.amount)) {
      setError('All line items must have description and amount');
      return;
    }

    setLoading(true);
    try {
      const lineItemsFormatted = lineItems.map(item => ({
        description: item.description,
        amount: parseInt(item.amount * 100)
      }));

      const lineItemsStr = JSON.stringify(lineItemsFormatted).replace(/"/g, '\\"');

      const response = await axios.post(API_URL, {
        query: `mutation { 
          createInvoice(
            invoiceNumber: "${formData.invoiceNumber}"
            accountId: "${formData.accountId}"
            dueDate: "${formData.dueDate}"
            lineItems: ${lineItemsStr}
          ) { 
            id 
            invoiceNumber 
            status 
            total 
            paid 
            remaining
            createdAt 
          } 
        }`
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      setSuccess('Invoice created successfully!');
      setFormData({ invoiceNumber: '', accountId: '', dueDate: '' });
      setLineItems([{ description: '', amount: '' }]);
      fetchInvoices();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to create invoice: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPayment = async (invoiceId, amount) => {
    if (!amount || amount <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      const amountCents = parseInt(amount * 100);
      const response = await axios.post(API_URL, {
        query: `mutation { 
          applyPayment(invoiceId: "${invoiceId}", amount: ${amountCents}) { 
            id 
            amount 
            status 
            createdAt 
          } 
        }`
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      setSuccess('Payment applied successfully!');
      fetchInvoices();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to apply payment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    return `status-badge status-${status.toLowerCase()}`;
  };

  const formatAmount = (cents) => {
    return (cents / 100).toFixed(2);
  };

  return (
    <div className="section">
      <h2>Manage Invoices</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleCreateInvoice}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div className="form-group">
            <label>Invoice Number</label>
            <input
              type="text"
              value={formData.invoiceNumber}
              onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              placeholder="INV-001"
              required
            />
          </div>

          <div className="form-group">
            <label>Customer Account</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              required
            >
              <option value="">Select account...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Due Date</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>
        </div>

        <h4 style={{ marginTop: '15px', marginBottom: '10px' }}>Line Items</h4>

        {lineItems.map((item, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: '10px', marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Description"
              value={item.description}
              onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={item.amount}
              onChange={(e) => handleLineItemChange(index, 'amount', e.target.value)}
              required
            />
            <button
              type="button"
              className="button-danger"
              onClick={() => handleRemoveLineItem(index)}
              disabled={lineItems.length === 1}
            >
              Remove
            </button>
          </div>
        ))}

        <button type="button" className="button-secondary" onClick={handleAddLineItem} style={{ marginBottom: '15px' }}>
          + Add Line Item
        </button>

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Invoice'}
        </button>
      </form>

      <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Invoices</h3>

      {loading ? (
        <div className="loader"></div>
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          <p>No invoices created yet.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Account</th>
              <th>Status</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Remaining</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoiceNumber}</td>
                <td>{invoice.account.name}</td>
                <td><span className={getStatusClass(invoice.status)}>{invoice.status}</span></td>
                <td>${formatAmount(invoice.total)}</td>
                <td>${formatAmount(invoice.paid)}</td>
                <td>${formatAmount(invoice.remaining)}</td>
                <td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}</td>
                <td>
                  <button
                    className="button-secondary"
                    onClick={() => {
                      const amount = prompt(`Pay for ${invoice.invoiceNumber} (remaining: $${formatAmount(invoice.remaining)})`);
                      if (amount) handleApplyPayment(invoice.id, parseFloat(amount));
                    }}
                    disabled={invoice.remaining === 0}
                    style={{ fontSize: '12px', padding: '5px 10px' }}
                  >
                    Pay
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
