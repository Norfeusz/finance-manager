import React, { useState, useEffect } from 'react';
import CollapsibleSection from './CollapsibleSection';
import CategoryDetailsModal from './CategoryDetailsModal';
import Modal from './Modal';
import EditTransactionModal from './EditTransactionModal';
import AccountBalances from './AccountBalances';
import './StatisticsDashboard.css';

function StatisticsDashboard({ transactions }) {
  const [modalInfo, setModalInfo] = useState({ isOpen: false, category: '', transactions: [] });
  const [incomeModal, setIncomeModal] = useState({ isOpen: false, transaction: null });
  const [editIncomeModal, setEditIncomeModal] = useState({ isOpen: false, transaction: null });
  const [transferModal, setTransferModal] = useState({ isOpen: false, transaction: null });
  const [editTransferModal, setEditTransferModal] = useState({ isOpen: false, transaction: null });
  const [accountBalances, setAccountBalances] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(null);
  const [monthBudget, setMonthBudget] = useState(0);

  // Pobierz stany kont z API oraz dane o bieżącym miesiącu
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Pobierz stany kont
        const balancesResponse = await fetch('http://localhost:3001/api/accounts/balances');
        if (!balancesResponse.ok) {
          throw new Error(`HTTP error ${balancesResponse.status}`);
        }
        const balancesData = await balancesResponse.json();
        setAccountBalances(balancesData);
        
        // Pobierz dane o bieżącym miesiącu
        const monthResponse = await fetch('http://localhost:3001/api/months/current');
        if (!monthResponse.ok) {
          throw new Error(`HTTP error ${monthResponse.status}`);
        }
        const monthData = await monthResponse.json();
        setCurrentMonth(monthData);
        setMonthBudget(parseFloat(monthData.budget) || 0);
      } catch (err) {
        console.error('Błąd pobierania danych:', err);
      }
    };

    fetchData();
  }, []);

  // Funkcja pomocnicza do formatowania waluty
  function formatCurrency(value) {
    if (typeof value !== 'number') value = Number(value);
    if (isNaN(value)) return '-';
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });
  }
  
  // Funkcja pomocnicza do formatowania daty
  function formatDate(dateString) {
    if (!dateString) return '-';
    
    // Sprawdź czy data jest w formacie ISO (z T i Z)
    if (dateString.includes('T')) {
      const date = new Date(dateString);
      return date.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    
    // Jeśli data jest już w formacie YYYY-MM-DD, zwróć ją w formacie DD.MM.YYYY
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
      return `${day}.${month}.${year}`;
    }
    
    return dateString;
  }

  // Nowa logika: wpływy początkowe to pierwsze dwa wpływy z datą 1 danego miesiąca
  function getInitialAndExtraIncomes(transactions) {
    // Najpierw odfiltrujmy wszystkie wpływy generowane z opcji "bilansujemy wydatek"
    const realIncomes = transactions.filter(t => t.type === 'income' && !isBalanceExpenseIncome(t));
    
    // Zakładamy, że data jest w formacie YYYY-MM-DD
    // Grupujemy po miesiącu
    const byMonth = {};
    realIncomes.forEach(t => {
      const [year, month, day] = (t.date || '').split('-');
      if (!year || !month || !day) return;
      const monthKey = `${year}-${month}`;
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(t);
    });
    
    let initial = [], extra = [];
    Object.values(byMonth).forEach(incomes => {
      // Filtrujemy tylko te z datą 1
      const firstDay = incomes.filter(t => t.date && t.date.endsWith('-01'));
      // Sortujemy po id lub amount, żeby mieć deterministycznie pierwsze dwa
      const sorted = [...firstDay].sort((a, b) => (a.id || 0) - (b.id || 0));
      initial = initial.concat(sorted.slice(0, 2));
      // Pozostałe z datą 1 i wszystkie inne to extra
      const initialIds = new Set(sorted.slice(0, 2).map(t => t.id));
      const regularExtra = incomes.filter(t => !initialIds.has(t.id));
      
      extra = extra.concat(regularExtra);
    });
    return { initial, extra };
  }

  const { initial: initialIncomes, extra: extraIncomes } = getInitialAndExtraIncomes(transactions);

  // Nowa funkcja do rozpoznania czy dany wpływ jest początkowy
  function isInitialIncome(t) {
    return initialIncomes.some(i => i.id === t.id);
  }

  // Funkcja pomocnicza do sprawdzenia czy dany wpływ był wygenerowany z opcją "bilansujemy wydatek"
  function isBalanceExpenseIncome(transaction) {
    return transaction.type === 'income' && 
           transaction.extraDescription && 
           transaction.extraDescription.includes('opcja: balance_expense');
  }
  
  // Grupujemy transfery po dacie i kwocie, aby wyeliminować duplikaty
  // Dla każdej pary data-kwota zostawiamy tylko jeden transfer
  const seenTransfers = new Map();
  const filteredTransfers = [];
  
  // Najpierw zbieramy wszystkie transfery
  transactions.filter(t => t.type === 'transfer').forEach(t => {
    const fromAccount = t.account || 'Nieznane';
    let toAccount = 'Nieznane';
    
    // Wyciągnij nazwę konta docelowego z opisu
    if (t.description && t.description.includes('Transfer do: ')) {
      toAccount = t.description.replace('Transfer do: ', '');
      
      // Tworzymy unikalny klucz dla tego transferu (data + kwota + konta)
      const transferKey = `${t.date}_${t.cost || t.amount}_${fromAccount}_${toAccount}`;
      
      // Jeśli jeszcze nie widzieliśmy tego transferu, dodajemy go do listy
      if (!seenTransfers.has(transferKey)) {
        seenTransfers.set(transferKey, true);
        filteredTransfers.push({ ...t, fromAccount, toAccount });
      }
    }
  });
  
  // Suma transferów - tylko z przefiltrowanych transferów, aby uniknąć podwójnego liczenia
  const totalTransfersAmount = filteredTransfers.reduce((acc, t) => acc + Number(t.cost || t.amount || 0), 0);
  
  // Proste statystyki
  const stats = {
    // Ogólny bilans, uwzględniający transfery na konto "Rachunki" jako wydatki
    overallBalance: transactions.reduce((acc, t) => {
      if (t.type === 'income' && !isBalanceExpenseIncome(t)) {
        return acc + Number(t.cost || t.amount || 0);
      } 
      if (t.type === 'expense') {
        return acc - Number(t.cost || 0);
      }
      // Transfery na konto "Rachunki" lub "KWNR" traktujemy jak wydatki
      if (t.type === 'transfer' && 
          (t.description && (t.description.includes('Transfer do: Rachunki') || t.description.includes('Transfer do: KWNR')) ||
           t.toAccount === 'Rachunki' || t.toAccount === 'KWNR')) {
        return acc - Number(t.cost || t.amount || 0);
      }
      return acc;
    }, 0),
    accountBalances: transactions.reduce((acc, t) => {
      const accName = t.toAccount || t.account || 'Wspólne';
      if (!acc[accName]) acc[accName] = 0;
      if (t.type === 'income' && !isBalanceExpenseIncome(t)) acc[accName] += Number(t.cost || t.amount || 0);
      if (t.type === 'expense') acc[accName] -= Number(t.cost || 0);
      return acc;
    }, { 'Wspólne': 0, 'Gotówka': 0, 'Oszczędnościowe': 0, 'Rachunki': 0, 'KWNR': 0 }),
    // Obliczanie sumy wszystkich kont - na podstawie danych z tabeli account_balances
    totalAccountsBalance: accountBalances.reduce((sum, account) => sum + parseFloat(account.current_balance || 0), 0),
    // Bilans miesiąca - różnica między wpływami a wydatkami w danym miesiącu
    // Teraz uwzględniamy transfery na konto "Rachunki" i "KWNR" jako wydatki
    monthlyBalance: transactions.reduce((acc, t) => {
      if (t.type === 'income' && !isBalanceExpenseIncome(t)) {
        return acc + Number(t.cost || t.amount || 0);
      }
      if (t.type === 'expense') {
        return acc - Number(t.cost || 0);
      }
      // Transfery na konto "Rachunki" lub "KWNR" traktujemy jak wydatki
      if (t.type === 'transfer' && 
          (t.description && (t.description.includes('Transfer do: Rachunki') || t.description.includes('Transfer do: KWNR')) ||
           t.toAccount === 'Rachunki' || t.toAccount === 'KWNR')) {
        return acc - Number(t.cost || t.amount || 0);
      }
      return acc;
    }, 0),
    // Założony bilans miesiąca - różnica między budżetem a wydatkami (uwzględniając transfery na Rachunki i KWNR)
    monthlyBudgetBalance: monthBudget - transactions.reduce((acc, t) => {
      if (t.type === 'expense') {
        return acc + Number(t.cost || 0);
      }
      // Transfery na konto "Rachunki" lub "KWNR" traktujemy jak wydatki
      if (t.type === 'transfer' && 
          (t.description && (t.description.includes('Transfer do: Rachunki') || t.description.includes('Transfer do: KWNR')) ||
           t.toAccount === 'Rachunki' || t.toAccount === 'KWNR')) {
        return acc + Number(t.cost || t.amount || 0);
      }
      return acc;
    }, 0),
    // Suma wpływów z wyłączeniem tych generowanych opcją "bilansujemy wydatek"
    totalIncome: transactions.filter(t => t.type === 'income' && !isBalanceExpenseIncome(t)).reduce((acc, t) => acc + Number(t.cost || t.amount || 0), 0),
    // W sumie wydatków uwzględniamy także transfery na konto "Rachunki" i "KWNR"
    totalExpenses: transactions.reduce((acc, t) => {
      if (t.type === 'expense') {
        return acc + Number(t.cost || 0);
      }
      // Transfery na konto "Rachunki" lub "KWNR" traktujemy jak wydatki
      if (t.type === 'transfer' && 
          (t.description && (t.description.includes('Transfer do: Rachunki') || t.description.includes('Transfer do: KWNR')) ||
           t.toAccount === 'Rachunki' || t.toAccount === 'KWNR')) {
        return acc + Number(t.cost || t.amount || 0);
      }
      return acc;
    }, 0),
    // Transfery i ich suma
    transfers: filteredTransfers,
    totalTransfers: totalTransfersAmount,
    // Wydatki według kategorii, uwzględniające transfery na konto "Rachunki" i "KWNR"
    expenseByCategory: transactions.reduce((acc, t) => {
      // Standardowe wydatki
      if (t.type === 'expense') {
        const category = t.category || 'Inne';
        if (!acc[category]) acc[category] = 0;
        acc[category] += Number(t.cost || 0);
      }
      
      // Transfery na konto "Rachunki" traktujemy jak wydatki w kategorii "Transfer na Rachunki"
      if (t.type === 'transfer' && 
          (t.description && t.description.includes('Transfer do: Rachunki') ||
           t.toAccount === 'Rachunki')) {
        const category = 'Transfer na Rachunki';
        if (!acc[category]) acc[category] = 0;
        acc[category] += Number(t.cost || t.amount || 0);
      }
      
      // Transfery na konto "KWNR" traktujemy jak wydatki w kategorii "Transfer na KWNR"
      if (t.type === 'transfer' && 
          (t.description && t.description.includes('Transfer do: KWNR') ||
           t.toAccount === 'KWNR')) {
        const category = 'Transfer na KWNR';
        if (!acc[category]) acc[category] = 0;
        acc[category] += Number(t.cost || t.amount || 0);
      }
      
      return acc;
    }, {})
  };

  // Funkcje do edycji i usuwania wpływów oraz wyliczania salda po operacji
 
    const handleSaveEditIncome = async (updatedData) => {
      try {
        const response = await fetch('http://localhost:3001/api/expenses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ original: editIncomeModal.transaction, updated: updatedData })
        });
        const result = await response.json();
        if (response.ok) {
          alert('Wpływ zaktualizowany!');
          setEditIncomeModal({ isOpen: false, transaction: null });
          window.location.reload(); // lub odśwież dane w inny sposób
        } else {
          throw new Error(result.message || 'Błąd aktualizacji');
        }
      } catch (error) {
        alert(`Wystąpił błąd: ${error.message}`);
      }
    };

  const handleEditIncome = (transaction) => {
    setEditIncomeModal({ isOpen: true, transaction });
  };

  const handleDeleteIncome = async (transaction) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten wpływ?')) return;
    try {
      const response = await fetch('http://localhost:3001/api/expenses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: transaction.date, id: transaction.id, rowId: transaction.rowId }),
      });
      const result = await response.json();
      if (response.ok) {
        alert('Wpływ usunięty.');
        window.location.reload(); // lub odśwież dane w inny sposób
      } else {
        throw new Error(result.message || 'Nie udało się usunąć wpływu.');
      }
    } catch (error) {
      alert(`Wystąpił błąd: ${error.message}`);
    }
  };

  function getBalanceAfter(transaction, specificAccount = null) {
    // Filtrujemy wszystkie wpływy, wydatki i transfery na to samo konto do momentu tej transakcji (włącznie)
    // Jeśli podano specificAccount, używamy tego konta, w przeciwnym razie bierzemy konto z transakcji
    const account = specificAccount || transaction.toAccount || transaction.account;
    if (!account) return '-';
    
    const date = transaction.date;
    // ID transakcji, aby uwzględnić tylko transakcje wykonane przed lub równocześnie z tą transakcją
    const transactionId = transaction.id || 0;
    
    // Sortujemy transakcje po dacie i id
    const sorted = transactions
      .filter(t => {
        // Sprawdzamy czy transakcja dotyczy danego konta (czy jako źródło czy jako cel)
        const isAccountSource = t.account === account || t.fromAccount === account;
        const isAccountDestination = t.toAccount === account || 
                                   (t.description && t.description.includes(`do: ${account}`));
                                   
        // Uwzględniamy transakcje do tej daty
        if (t.date < date) return isAccountSource || isAccountDestination;
        
        // Dla transakcji z tą samą datą, sprawdzamy ID, aby zapewnić poprawną kolejność
        if (t.date === date) {
          const tId = t.id || 0;
          return (isAccountSource || isAccountDestination) && tId <= transactionId;
        }
        
        return false;
      })
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0)));
    
    let saldo = 0;
    for (const t of sorted) {
      if (t.type === 'income' && !isBalanceExpenseIncome(t) && (t.account === account || t.toAccount === account)) {
        saldo += Number(t.cost || t.amount || 0);
      }
      if (t.type === 'expense' && t.account === account) {
        saldo -= Number(t.cost || 0);
      }
      if (t.type === 'transfer') {
        // Dla transferu odejmujemy kwotę, jeśli konto jest źródłem transferu
        if (t.account === account || t.fromAccount === account) {
          saldo -= Number(t.cost || t.amount || 0);
        }
        // Dodajemy kwotę, jeśli konto jest celem transferu
        else if (t.toAccount === account || (t.description && t.description.includes(`do: ${account}`))) {
          saldo += Number(t.cost || t.amount || 0);
        }
      }
    }
    return formatCurrency(saldo);
  }

  const handleCategoryClick = (categoryName) => {
    const categoryTransactions = transactions.filter(t => t.category === categoryName);
    setModalInfo({
        isOpen: true,
        category: categoryName,
        transactions: categoryTransactions
    });
  };

  const handleCloseModal = () => {
    setModalInfo({ isOpen: false, category: '', transactions: [] });
  };
  
  // Funkcja do edycji transferu
  const handleEditTransfer = (transfer) => {
    setEditTransferModal({ isOpen: true, transaction: transfer });
  };

  // Funkcja do zapisywania edytowanego transferu
  const handleSaveEditTransfer = async (updatedData) => {
    try {
      const response = await fetch('http://localhost:3001/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: editTransferModal.transaction, updated: updatedData })
      });
      const result = await response.json();
      if (response.ok) {
        alert('Transfer zaktualizowany!');
        setEditTransferModal({ isOpen: false, transaction: null });
        window.location.reload(); // lub odśwież dane w inny sposób
      } else {
        throw new Error(result.message || 'Błąd aktualizacji');
      }
    } catch (error) {
      alert(`Wystąpił błąd: ${error.message}`);
    }
  };

  // Funkcja do cofania transferu
  const handleUndoTransfer = async (transfer) => {
    if (!window.confirm('Czy na pewno chcesz cofnąć ten transfer? Ta operacja usunie oba rekordy transferu.')) return;
    
    try {
      // Ponieważ transfer składa się z dwóch transakcji, musimy usunąć obie
      const response = await fetch('http://localhost:3001/api/expenses/transfer', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: transfer.id,
          date: transfer.date,
          fromAccount: transfer.fromAccount,
          toAccount: transfer.toAccount,
          amount: transfer.cost || transfer.amount 
        }),
      });
      
      const result = await response.json();
      if (response.ok) {
        alert('Transfer został cofnięty.');
        window.location.reload(); // lub odśwież dane w inny sposób
      } else {
        throw new Error(result.message || 'Nie udało się cofnąć transferu.');
      }
    } catch (error) {
      alert(`Wystąpił błąd: ${error.message}`);
    }
  };

  return (
    <>
      <div className="dashboard">
        <div className="stats-grid">
          <div className="card">
            <h2>Główne Statystyki</h2>
            <AccountBalances refreshKey={transactions.length} />
            <div className="highlighted-stat">
              <span className="label">Suma kont:</span>
              <span className={`value ${stats.totalAccountsBalance >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(stats.totalAccountsBalance)}
              </span>
            </div>
          </div>

          <div className="card">
            <h2>Aktualny miesiąc</h2>
            <div className="highlighted-stat">
              <div className="section-title">
                <span className="label">Bilans miesiąca:</span>
                <span className={`value ${stats.monthlyBalance >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(stats.monthlyBalance)}
                </span>
              </div>
            </div>
            <div className="highlighted-stat budget-stat">
              <div className="section-title">
                <span className="label">Założony bilans miesiąca:</span>
                <span className={`value ${stats.monthlyBudgetBalance >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(stats.monthlyBudgetBalance)}
                </span>
              </div>
              <button 
                className="small-button" 
                onClick={() => {
                  const newBudget = prompt('Podaj założony budżet miesiąca:', monthBudget);
                  if (newBudget !== null) {
                    const budget = parseFloat(newBudget.replace(',', '.'));
                    if (!isNaN(budget) && budget >= 0) {
                      setMonthBudget(budget);
                      // Zapisz budżet w bazie danych
                      fetch(`http://localhost:3001/api/months/${currentMonth.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ budget })
                      })
                      .then(response => {
                        if (!response.ok) throw new Error('Błąd zapisywania budżetu');
                        return response.json();
                      })
                      .then(data => console.log('Budżet zaktualizowany:', data))
                      .catch(error => console.error('Błąd:', error));
                    } else {
                      alert('Podaj poprawną wartość liczbową (nie mniejszą niż 0).');
                    }
                  }
                }}
              >
                ✏️
              </button>
            </div>
            <hr/>
            <CollapsibleSection title={<div className="section-title"><span>Suma wpływów:</span><span className="section-amount">{formatCurrency(stats.totalIncome)}</span></div>}>
              <div style={{marginBottom: '8px', fontWeight: 500}}>Wpływy początkowe</div>
              <ul>
                {initialIncomes.length === 0 && <li style={{color:'#888'}}>Brak wpływów początkowych</li>}
                {initialIncomes.map(t => (
                  <li key={t.id} className="income-list-item">
                    <span className="income-date">{formatDate(t.date)}</span>:
                    <span className="income-desc"> {t.description} </span>
                    <span className="income-amount">{formatCurrency(t.cost || t.amount)}</span>
                    <span className="income-actions">
                      <button title="Pokaż szczegóły" onClick={() => setIncomeModal({isOpen:true, transaction:t})}>🔍</button>
                      <button title="Edytuj" onClick={() => handleEditIncome(t)}>✏️</button>
                      {/* Brak opcji usuń dla wpływów początkowych */}
                    </span>
                  </li>
                ))}
              </ul>
              <div style={{margin:'12px 0 8px 0', fontWeight: 500}}>Wpływy dodatkowe</div>
              <ul>
                {extraIncomes.length === 0 && <li style={{color:'#888'}}>Brak wpływów dodatkowych</li>}
                {extraIncomes.map(t => (
                  <li key={t.id} className="income-list-item">
                    <span className="income-date">{formatDate(t.date)}</span>:
                    <span className="income-desc"> {t.description} </span>
                    <span className="income-amount">{formatCurrency(t.cost || t.amount)}</span>
                    <span className="income-actions">
                      <button title="Pokaż szczegóły" onClick={() => setIncomeModal({isOpen:true, transaction:t})}>🔍</button>
                      <button title="Edytuj" onClick={() => handleEditIncome(t)}>✏️</button>
                      <button title="Usuń" onClick={() => handleDeleteIncome(t)}>🗑️</button>
                    </span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
            <CollapsibleSection title={<div className="section-title"><span>Suma wydatków:</span><span className="section-amount">{formatCurrency(stats.totalExpenses)}</span></div>}>
              <ul>
                {Object.entries(stats.expenseByCategory).map(([category, total]) => (
                  <li key={category} onClick={() => handleCategoryClick(category)} className="clickable-category">
                    <strong>{category}:</strong> {formatCurrency(total)}
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
            <CollapsibleSection title={<div className="section-title"><span>Transfery między kontami:</span><span className="section-amount">{formatCurrency(stats.totalTransfers)}</span></div>}>
              <ul className="transfers-list">
                {stats.transfers.length === 0 && <li style={{color:'#888'}}>Brak transferów</li>}
                {stats.transfers.map(transfer => (
                  <li key={transfer.id} className="transfer-list-item">
                    <div className="transfer-row">
                      <span className="transfer-date">{formatDate(transfer.date)}</span>
                      <span className="transfer-accounts">
                        <span className="account-from">{transfer.fromAccount}</span>
                        <span className="transfer-arrow">→</span>
                        <span className="account-to">{transfer.toAccount}</span>
                      </span>
                    </div>
                    <div className="transfer-row secondary">
                      <span className="transfer-amount">{formatCurrency(transfer.cost || transfer.amount)}</span>
                      <span className="transfer-actions">
                        <button className="action-button" title="Pokaż szczegóły" onClick={() => setTransferModal({isOpen:true, transaction:transfer})}>🔍</button>
                        <button className="action-button" title="Edytuj" onClick={() => handleEditTransfer(transfer)}>✏️</button>
                        <button className="action-button" title="Cofnij" onClick={() => handleUndoTransfer(transfer)}>↩️</button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          </div>
        </div>
      </div>


      {/* Modal szczegółów wpływu */}
      <Modal isOpen={incomeModal.isOpen} onClose={() => setIncomeModal({isOpen:false, transaction:null})} title="Szczegóły wpływu">
        {incomeModal.transaction && (
          <div className="transaction-full-details">
            <ul>
              <li><strong>Konto:</strong> {incomeModal.transaction.toAccount || incomeModal.transaction.account || '-'}</li>
              <li><strong>Kwota:</strong> {formatCurrency(incomeModal.transaction.cost || incomeModal.transaction.amount)}</li>
              <li><strong>Opis:</strong> {incomeModal.transaction.description || '-'}</li>
              <li><strong>Data:</strong> {incomeModal.transaction.date ? new Date(incomeModal.transaction.date).toLocaleDateString('pl-PL') : '-'}</li>
              <li><strong>Notatka:</strong> {incomeModal.transaction.extraDescription || '-'}</li>
              <li><strong>Saldo po operacji:</strong> {getBalanceAfter(incomeModal.transaction)}</li>
              {isInitialIncome(incomeModal.transaction) && (
                <li style={{marginTop:'10px'}}><strong>Wyliczenia do wpływu początkowego:</strong><br/>
                  <span style={{color:'#888'}}>Wyliczenia będą dostępne po wdrożeniu panelu otwierania miesiąca.</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </Modal>

      {/* Modal edycji wpływu */}
      {editIncomeModal.isOpen && editIncomeModal.transaction && (
        <EditTransactionModal
          isOpen={editIncomeModal.isOpen}
          onClose={() => setEditIncomeModal({ isOpen: false, transaction: null })}
          transaction={editIncomeModal.transaction}
          onSave={handleSaveEditIncome}
        />
      )}

      <CategoryDetailsModal 
        isOpen={modalInfo.isOpen}
        onClose={handleCloseModal}
        categoryName={modalInfo.category}
        transactions={modalInfo.transactions}
        onDataChange={() => window.location.reload()} // Dodajemy funkcję odświeżania
      />
      
      {/* Modal szczegółów transferu */}
      <Modal isOpen={transferModal.isOpen} onClose={() => setTransferModal({isOpen:false, transaction:null})} title="Szczegóły transferu">
        {transferModal.transaction && (
          <div className="transaction-full-details">
            <ul>
              <li><strong>Z konta:</strong> {transferModal.transaction.fromAccount || transferModal.transaction.account || '-'}</li>
              <li><strong>Saldo konta źródłowego po operacji:</strong> {getBalanceAfter(transferModal.transaction, transferModal.transaction.fromAccount || transferModal.transaction.account)}</li>
              <li><strong>Na konto:</strong> {transferModal.transaction.toAccount || '-'}</li>
              <li><strong>Saldo konta docelowego po operacji:</strong> {getBalanceAfter(transferModal.transaction, transferModal.transaction.toAccount)}</li>
              <li><strong>Kwota:</strong> {formatCurrency(transferModal.transaction.cost || transferModal.transaction.amount)}</li>
              <li><strong>Data:</strong> {transferModal.transaction.date ? new Date(transferModal.transaction.date).toLocaleDateString('pl-PL') : '-'}</li>
              <li><strong>Notatka:</strong> {transferModal.transaction.extraDescription || '-'}</li>
            </ul>
          </div>
        )}
      </Modal>
      
      {/* Modal edycji transferu */}
      {editTransferModal.isOpen && editTransferModal.transaction && (
        <EditTransactionModal
          isOpen={editTransferModal.isOpen}
          onClose={() => setEditTransferModal({ isOpen: false, transaction: null })}
          transaction={editTransferModal.transaction}
          onSave={handleSaveEditTransfer}
          isTransfer={true}
        />
      )}
    </>
  );
}

export default StatisticsDashboard;