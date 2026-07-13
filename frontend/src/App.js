import React, { useState, useEffect } from 'react';
import AccountManager from './components/AccountManager';
import TransactionLedger from './components/TransactionLedger';
import InvoiceManager from './components/InvoiceManager';

function App() {
  const [activeTab, setActiveTab] = useState('accounts');
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    // Check API health
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      const response = await fetch('http://localhost:6500/health');
      if (response.ok) {
        setApiStatus('online');
      } else {
        setApiStatus('offline');
      }
    } catch (err) {
      setApiStatus('offline');
      console.error('API health check failed:', err);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>💰 Payment Ledger & Invoice Service</h1>
        <p>Transportation Management System - Accounts Payable Module</p>
        <div style={{ marginTop: '10px', fontSize: '12px' }}>
          API Status: <span style={{ 
            color: apiStatus === 'online' ? '#90EE90' : '#FF6B6B',
            fontWeight: 'bold'
          }}>
            {apiStatus === 'online' ? '✓ Online' : '✗ Offline'}
          </span>
        </div>
      </header>

      <div className="tabs">
        <button 
          className={`tab-button ${activeTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('accounts')}
        >
          📊 Accounts
        </button>
        <button 
          className={`tab-button ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          📝 Ledger
        </button>
        <button 
          className={`tab-button ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          📄 Invoices
        </button>
      </div>

      {activeTab === 'accounts' && <AccountManager />}
      {activeTab === 'transactions' && <TransactionLedger />}
      {activeTab === 'invoices' && <InvoiceManager />}

      <footer style={{ textAlign: 'center', marginTop: '40px', color: '#666', fontSize: '12px' }}>
        <p>Payment Ledger Service v1.0 | Fintech Skill Test</p>
      </footer>
    </div>
  );
}

export default App;
