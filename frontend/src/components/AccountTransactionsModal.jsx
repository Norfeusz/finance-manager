import React from 'react';
import Modal from './Modal';
import BillsTable from './BillsTable';
import KwnrAccountView from './KwnrAccountView';
import './AccountTransactionsModal.css';

function AccountTransactionsModal({ isOpen, onClose, accountName, transactions, showAllTransactions = false, onShowAllTransactions, currentAccountBalance }) {
    // Funkcja pomocnicza do formatowania waluty
    const formatCurrency = (value) => {
        if (value === null || value === undefined) return '-';
        return parseFloat(value).toLocaleString('pl-PL', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }) + ' zł';
    };

    // Funkcja pomocnicza do formatowania daty
    const formatDate = (dateString) => {
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
    };

    // Sortuj transakcje od najnowszych do najstarszych
    const sortedTransactions = [...transactions].sort((a, b) => {
        // Sortuj najpierw po dacie, a następnie po id jeśli daty są takie same
        if (a.date !== b.date) {
            return new Date(b.date) - new Date(a.date);
        }
        return (b.id || 0) - (a.id || 0);
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={accountName === 'KWNR' ? 'Konto wydatków nieregularnych' : `Przepływy konta: ${accountName}`}>
            <div className="account-transactions-list">
                {/* Specjalna tabela dla konta Rachunki */}
                {accountName === 'Rachunki' && (
                    <BillsTable 
                        transactions={transactions} 
                        key={transactions.length} // Wymuszenie rerender przy zmianie transakcji
                        currentBalance={currentAccountBalance} // Przekazanie bieżącego salda z bazy danych
                    />
                )}
                
                {/* Specjalny widok dla konta wydatków nieregularnych */}
                {accountName === 'KWNR' && (
                    <>
                        <KwnrAccountView 
                            transactions={transactions}
                            key={transactions.length} // Wymuszenie rerender przy zmianie transakcji
                            currentBalance={currentAccountBalance} // Przekazanie bieżącego salda z bazy danych
                        />
                    </>
                )}
                
                {/* Lista transakcji dla wszystkich kont (nie pokazujemy dla KWNR i Rachunki) */}
                {accountName !== 'KWNR' && accountName !== 'Rachunki' && (
                    sortedTransactions.length === 0 ? (
                        <p className="no-data">Brak transakcji dla tego konta</p>
                    ) : (
                    <>
                        <div className="transactions-header">
                            <p className="count-info">Liczba transakcji: {sortedTransactions.length}</p>
                            <div className="transaction-actions">
                                {!showAllTransactions && (
                                    <button 
                                        className="show-all-button" 
                                        onClick={onShowAllTransactions}
                                    >
                                        Pokaż wszystkie przepływy
                                    </button>
                                )}
                                {showAllTransactions && (
                                    <span className="all-transactions-label">Wszystkie transakcje</span>
                                )}
                            </div>
                        </div>
                        <table className="transactions-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Typ</th>
                                    <th>Opis</th>
                                    <th>Kwota</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTransactions.map((transaction) => {
                                    // Określenie typu transakcji i kwoty
                                    let type = transaction.type;
                                    let amount = 0;
                                    let amountClass = '';

                                    if (type === 'income') {
                                        amount = parseFloat(transaction.cost || transaction.amount || 0);
                                        amountClass = 'income-amount';
                                    } else if (type === 'expense') {
                                        amount = -parseFloat(transaction.cost || 0);
                                        amountClass = 'expense-amount';
                                    } else if (type === 'transfer') {
                                        // Sprawdź czy konto jest źródłem czy celem transferu
                                        if (transaction.account === accountName || transaction.fromAccount === accountName) {
                                            amount = -parseFloat(transaction.cost || transaction.amount || 0);
                                            amountClass = 'expense-amount';
                                        } else {
                                            amount = parseFloat(transaction.cost || transaction.amount || 0);
                                            amountClass = 'income-amount';
                                        }
                                    }

                                    return (
                                        <tr key={transaction.id}>
                                            <td>{formatDate(transaction.date)}</td>
                                            <td>{getTransactionTypeText(type)}</td>
                                            <td>{getTransactionDescription(transaction, accountName)}</td>
                                            <td className={amountClass}>{formatCurrency(amount)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </>
                    )
                )}
            </div>
        </Modal>
    );
}

// Funkcja do określenia typu transakcji w tekście
function getTransactionTypeText(type) {
    switch (type) {
        case 'income': return 'Wpływ';
        case 'expense': return 'Wydatek';
        case 'transfer': return 'Transfer';
        default: return type;
    }
}

// Funkcja do generowania opisu transakcji w kontekście wybranego konta
function getTransactionDescription(transaction, accountName) {
    if (transaction.type === 'transfer') {
        // Sprawdź czy to jest transfer wychodzący czy przychodzący
        const isOutgoing = transaction.description && transaction.description.startsWith('Transfer do:');
        const isIncoming = transaction.description && transaction.description.startsWith('Transfer z:');
        
        if (isOutgoing) {
            // Wyciągnij nazwę konta docelowego z opisu
            const targetAccount = transaction.description.replace('Transfer do: ', '').trim();
            return `→ ${targetAccount}`;
        } else if (isIncoming) {
            // Wyciągnij nazwę konta źródłowego z opisu
            const sourceAccount = transaction.description.replace('Transfer z: ', '').trim();
            return `← z: ${sourceAccount}`;
        } else if (transaction.toAccount && transaction.fromAccount) {
            // Mamy jawnie określone konta źródłowe i docelowe
            if (transaction.fromAccount === accountName) {
                return `→ ${transaction.toAccount}`;
            } else {
                return `← z: ${transaction.fromAccount}`;
            }
        } else {
            // Ostateczność - jeśli nie możemy określić kierunku, używamy ogólnego opisu
            return transaction.description || 'Transfer';
        }
    }
    
    // Dla transakcji innych niż transfery, używamy oryginalnego opisu
    return transaction.description || '-';
}

export default AccountTransactionsModal;
