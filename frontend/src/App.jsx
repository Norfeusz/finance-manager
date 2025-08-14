import { useState, useEffect } from 'react';
import StatisticsDashboard from './components/StatisticsDashboard';
import DataEntryForm from './components/DataEntryForm';
import ShoppingStats from './components/ShoppingStats';
import './App.css';

function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:3001/api/transactions?year=2025&month=8');
        if (!response.ok) throw new Error('Błąd serwera: ' + response.statusText);
        const data = await response.json();
        setTransactions(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [refreshKey]);

  const refreshData = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  return (
    <div className="App">
      <h1>Menadżer Finansów</h1>
      <div className="main-layout">
        <div className="form-container">
          <DataEntryForm onNewEntry={refreshData} />
        </div>
        <div className="dashboard-container">
          {loading && <p className="loading">Ładowanie danych...</p>}
          {error && <p style={{ color: 'red' }}>Wystąpił błąd: {error}</p>}
          {!loading && !error && (
            <>
              <StatisticsDashboard transactions={transactions} />
              <ShoppingStats refreshKey={refreshKey} transactions={transactions} onDataChange={refreshData} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;