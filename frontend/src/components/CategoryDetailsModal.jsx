import { useState } from 'react';
import Modal from './Modal';
import EditTransactionModal from './EditTransactionModal'; // Importujemy nowy komponent

const formatCurrency = (amount) => (amount || 0).toFixed(2).replace('.', ',') + ' zł';

const TransactionFullDetails = ({ transaction }) => (
  <div className="transaction-full-details">
    <ul>
      <li><strong>Konto:</strong> {transaction.account || '-'}</li>
      <li><strong>Koszt:</strong> {formatCurrency(transaction.cost)}</li>
      <li><strong>Opis:</strong> {transaction.description || '-'}</li>
      <li><strong>Data:</strong> {transaction.date ? new Date(transaction.date).toLocaleDateString('pl-PL') : '-'}</li>
      <li><strong>Notatka:</strong> {transaction.extraDescription || '-'}</li>
    </ul>
  </div>
);

function CategoryDetailsModal({ isOpen, onClose, categoryName, transactions, onDataChange }) {
  const [expandedId, setExpandedId] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null); // Stan do śledzenia edytowanej transakcji

  if (!isOpen) return null;

  const toggleDetails = (transactionId) => {
    setExpandedId(prevId => (prevId === transactionId ? null : transactionId));
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
  };

  const handleCloseEditModal = () => {
    setEditingTransaction(null);
  };

  const handleSaveEdit = async (updatedData) => {
    try {
        const response = await fetch('http://localhost:3001/api/expenses', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ original: editingTransaction, updated: updatedData })
        });
        const result = await response.json();
        if (response.ok) {
            alert('Transakcja zaktualizowana!');
            handleCloseEditModal();
            onClose(); // Zamknij główny modal
            onDataChange(); // Odśwież dane
        } else {
            throw new Error(result.message || 'Błąd aktualizacji');
        }
    } catch (error) {
        alert(`Wystąpił błąd: ${error.message}`);
    }
  };
  
  const handleDelete = async (transaction) => {
    const confirmDelete = window.confirm(`Czy na pewno chcesz usunąć transakcję: "${transaction.description || 'Brak opisu'}" o wartości ${formatCurrency(transaction.cost)}?`);
    if (confirmDelete) {
      try {
        const response = await fetch('http://localhost:3001/api/expenses', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: transaction.date, category: transaction.category, rowId: transaction.rowId }),
        });
        const result = await response.json();
        if (response.ok) {
          alert('Transakcja usunięta pomyślnie.');
          onClose();
          onDataChange();
        } else {
          throw new Error(result.message || 'Nie udało się usunąć transakcji.');
        }
      } catch (error) {
        alert(`Wystąpił błąd: ${error.message}`);
      }
    }
  };

  return (
    <>
      <Modal isOpen={isOpen && !editingTransaction} onClose={onClose} title={`Szczegóły dla: ${categoryName}`}>
        <div className="transaction-list">
          {transactions.length > 0 ? (
            transactions.map((t) => (
              <div key={t.id} className="transaction-list-item-wrapper">
                <div className="transaction-list-item">
                  <div className="transaction-info">
                    <span className="description">{t.description || '(brak opisu)'}</span>
                    <span className="cost">{formatCurrency(t.cost)}</span>
                  </div>
                  <div className="transaction-actions">
                    <button title="Pokaż szczegóły" onClick={() => toggleDetails(t.id)}>ℹ️</button>
                    <button title="Edytuj" onClick={() => handleEdit(t)}>✏️</button>
                    <button title="Usuń" onClick={() => handleDelete(t)}>🗑️</button>
                  </div>
                </div>
                {expandedId === t.id && <TransactionFullDetails transaction={t} />}
              </div>
            ))
          ) : (
            <p>Brak transakcji w tej kategorii w bieżącym miesiącu.</p>
          )}
        </div>
      </Modal>

      {editingTransaction && (
        <EditTransactionModal
          isOpen={!!editingTransaction}
          onClose={handleCloseEditModal}
          transaction={editingTransaction}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}

export default CategoryDetailsModal;