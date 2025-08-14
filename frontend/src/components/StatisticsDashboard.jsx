import { useState } from 'react';
import CollapsibleSection from './CollapsibleSection';
import CategoryDetailsModal from './CategoryDetailsModal';
import Modal from './Modal';
import EditTransactionModal from './EditTransactionModal';

function StatisticsDashboard({ transactions }) {
  const [modalInfo, setModalInfo] = useState({ isOpen: false, category: '', transactions: [] });
  const [incomeModal, setIncomeModal] = useState({ isOpen: false, transaction: null });
  const [editIncomeModal, setEditIncomeModal] = useState({ isOpen: false, transaction: null });

  // Funkcja pomocnicza do formatowania waluty
  function formatCurrency(value) {
    if (typeof value !== 'number') value = Number(value);
    if (isNaN(value)) return '-';
    return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });
  }

  // Nowa logika: wpływy początkowe to pierwsze dwa wpływy z datą 1 danego miesiąca
  function getInitialAndExtraIncomes(transactions) {
    // Zakładamy, że data jest w formacie YYYY-MM-DD
    // Grupujemy po miesiącu
    const byMonth = {};
    transactions.forEach(t => {
      if (t.type !== 'income') return;
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
      extra = extra.concat(incomes.filter(t => !initialIds.has(t.id)));
    });
    return { initial, extra };
  }

  const { initial: initialIncomes, extra: extraIncomes } = getInitialAndExtraIncomes(transactions);

  // Nowa funkcja do rozpoznania czy dany wpływ jest początkowy
  function isInitialIncome(t) {
    return initialIncomes.some(i => i.id === t.id);
  }

  // Proste statystyki
  const stats = {
    overallBalance: transactions.reduce((acc, t) => acc + (t.type === 'income' ? Number(t.cost || t.amount || 0) : t.type === 'expense' ? -Number(t.cost || 0) : 0), 0),
    accountBalances: transactions.reduce((acc, t) => {
      const accName = t.toAccount || t.account || 'Główne';
      if (!acc[accName]) acc[accName] = 0;
      if (t.type === 'income') acc[accName] += Number(t.cost || t.amount || 0);
      if (t.type === 'expense') acc[accName] -= Number(t.cost || 0);
      return acc;
    }, { 'Główne': 0, 'Oszczędnościowe': 0, 'Rachunki': 0 }),
    monthlyBalance: transactions.filter(t => t.type === 'income' || t.type === 'expense').reduce((acc, t) => acc + (t.type === 'income' ? Number(t.cost || t.amount || 0) : -Number(t.cost || 0)), 0),
    totalIncome: transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.cost || t.amount || 0), 0),
    totalExpenses: transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.cost || 0), 0),
    expenseByCategory: transactions.filter(t => t.type === 'expense').reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = 0;
      acc[t.category] += Number(t.cost || 0);
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

  function getBalanceAfter(transaction) {
    // Filtrujemy wszystkie wpływy i wydatki na to samo konto do momentu tej transakcji (włącznie)
    const account = transaction.toAccount || transaction.account;
    if (!account) return '-';
    const date = transaction.date;
    // Sortujemy transakcje po dacie i id
    const sorted = transactions
      .filter(t => (t.toAccount || t.account) === account && t.date <= date)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0)));
    let saldo = 0;
    for (const t of sorted) {
      if (t.type === 'income') saldo += Number(t.cost || t.amount || 0);
      if (t.type === 'expense') saldo -= Number(t.cost || 0);
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

  return (
    <>
      <div className="dashboard">
        <div className="stats-grid">
          <div className="card">
            <h2>Główne Statystyki</h2>
            <p><strong>Bilans całkowity:</strong> {formatCurrency(stats.overallBalance)}</p>
            <p><strong>Stan kont:</strong></p>
            <ul>
              <li>Główne: {stats.accountBalances['Główne']}</li>
              <li>Oszczędnościowe: {stats.accountBalances['Oszczędnościowe']}</li>
              <li>Rachunki: {stats.accountBalances['Rachunki']}</li>
            </ul>
          </div>

          <div className="card">
            <h2>Aktualny miesiąc</h2>
            <p><strong>Bilans miesiąca:</strong> <span style={{color: stats.monthlyBalance >= 0 ? 'green' : 'red'}}>{formatCurrency(stats.monthlyBalance)}</span></p>
            <hr/>
            <CollapsibleSection title={`Suma wpływów: ${formatCurrency(stats.totalIncome)}`}>
              <div style={{marginBottom: '8px', fontWeight: 500}}>Wpływy początkowe</div>
              <ul>
                {initialIncomes.length === 0 && <li style={{color:'#888'}}>Brak wpływów początkowych</li>}
                {initialIncomes.map(t => (
                  <li key={t.id} className="income-list-item">
                    <span className="income-date">{t.date}</span>:
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
                    <span className="income-date">{t.date}</span>:
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
            <CollapsibleSection title={`Suma wydatków: ${formatCurrency(stats.totalExpenses)}`}>
              <ul>
                {Object.entries(stats.expenseByCategory).map(([category, total]) => (
                  <li key={category} onClick={() => handleCategoryClick(category)} className="clickable-category">
                    <strong>{category}:</strong> {formatCurrency(total)}
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

  // Funkcje do edycji i usuwania wpływów
  


  // Funkcja do wyliczania salda po operacji (prosta symulacja)
  

      <CategoryDetailsModal 
        isOpen={modalInfo.isOpen}
        onClose={handleCloseModal}
        categoryName={modalInfo.category}
        transactions={modalInfo.transactions}
      />
    </>
  );
}

export default StatisticsDashboard;