import { useState, useEffect } from 'react';
import AccountTransactionsModal from './AccountTransactionsModal';
import './AccountTransactionsModal.css';
import './AccountBalances.css';
import KwnrAccountView from './KwnrAccountView';

function AccountBalances({ refreshKey }) {
    const [accountBalances, setAccountBalances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [showAllTransactions, setShowAllTransactions] = useState(false);

    useEffect(() => {
        const fetchAccountBalances = async () => {
            setLoading(true);
            try {
                const response = await fetch('http://localhost:3001/api/accounts/balances');
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                const data = await response.json();
                // Filtruj tylko dozwolone konta
                const allowedAccounts = ['Wspólne', 'Gotówka', 'Oszczędnościowe', 'Rachunki', 'KWNR'];
                const filteredData = data.filter(account => allowedAccounts.includes(account.name));
                setAccountBalances(filteredData);
                setError(null);
            } catch (err) {
                console.error('Błąd pobierania stanów kont:', err);
                setError('Nie udało się pobrać stanów kont. Spróbuj ponownie później.');
            } finally {
                setLoading(false);
            }
        };

        fetchAccountBalances();
    }, [refreshKey]);

    // Funkcja pomocnicza do formatowania waluty
    const formatCurrency = (value) => {
        if (value === null || value === undefined) return '-';
        return parseFloat(value).toLocaleString('pl-PL', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }) + ' zł';
    };

    if (loading) return <div className="loading">Ładowanie danych o kontach...</div>;
    if (error) return <div className="error">{error}</div>;

    // Zmienna showAllTransactions została już zadeklarowana na górze komponentu
    
    // Funkcja do filtrowania transakcji dla wybranego konta
    const filterTransactionsForAccount = (data, accountName) => {
        const accountTransactions = [];
        const processedIds = new Set(); // Unikanie duplikatów

        data.forEach(transaction => {
            // Pomijamy już przetworzone transakcje
            if (processedIds.has(transaction.id)) {
                return;
            }
            
            if (transaction.type === 'transfer') {
                if (transaction.account === accountName) {
                    // Sprawdź czy to jest transfer wychodzący
                    const isToTransaction = transaction.description && transaction.description.startsWith('Transfer do:');
                    
                    if (isToTransaction) {
                        // To jest transfer wychodzący z danego konta
                        accountTransactions.push(transaction);
                        processedIds.add(transaction.id);
                    }
                } else {
                    // Sprawdź czy to jest transfer do danego konta
                    const isToThisAccount = transaction.description && 
                        transaction.description === `Transfer do: ${accountName}`;
                        
                    if (isToThisAccount) {
                        // To jest transfer przychodzący na dane konto
                        accountTransactions.push({
                            ...transaction,
                            toAccount: accountName,
                            fromAccount: transaction.account
                        });
                        processedIds.add(transaction.id);
                    }
                }
            } else if (transaction.account === accountName) {
                // Dla pozostałych typów (income, expense) dodajemy tylko te na danym koncie
                accountTransactions.push(transaction);
                processedIds.add(transaction.id);
            }
        });

        return accountTransactions;
    };
    
    // Funkcja do pobierania transakcji
    const fetchTransactions = async (accountName, allMonths = false) => {
        try {
            // Pobierz transakcje z API
            let url = 'http://localhost:3001/api/transactions';
            if (!allMonths) {
                // Pobierz tylko dla bieżącego miesiąca (domyślnie API zwraca bieżący miesiąc)
                // Możemy dodać dodatkowe parametry dla precyzji
                const now = new Date();
                url += `?year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
            }
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const data = await response.json();
            return filterTransactionsForAccount(data, accountName);
            
        } catch (err) {
            console.error('Błąd pobierania transakcji:', err);
            throw err;
        }
    };

    // Funkcja do obsługi kliknięcia w nazwę konta
    const handleAccountClick = async (accountName) => {
        // Obsługujemy konta Oszczędnościowe, Rachunki i KWNR
        if (accountName === 'Oszczędnościowe' || accountName === 'Rachunki' || accountName === 'KWNR') {
            try {
                // Pobierz transakcje tylko dla bieżącego miesiąca (domyślnie)
                const accountTransactions = await fetchTransactions(accountName, false);
                
                // Jeśli to konto Rachunki, odśwież również listę śledzonych transferów
                if (accountName === 'Rachunki') {
                    // Wyczyść zapisane dane transferów w localStorage, aby wymusić ich ponowne przetworzenie
                    localStorage.removeItem('billsAccountTransfers');
                }
                
                setShowAllTransactions(false);
                setTransactions(accountTransactions);
                setSelectedAccount(accountName);
            } catch (error) {
                console.error('Błąd pobierania transakcji konta:', error);
                alert('Nie udało się pobrać transakcji dla tego konta.');
            }
        }
    };
    
    // Funkcja do obsługi kliknięcia przycisku "Pokaż wszystkie transakcje"
    const handleShowAllTransactions = async () => {
        if (!selectedAccount) return;
        
        try {
            // Pobierz wszystkie transakcje ze wszystkich miesięcy
            const allTransactions = await fetchTransactions(selectedAccount, true);
            setShowAllTransactions(true);
            setTransactions(allTransactions);
        } catch (error) {
            console.error('Błąd pobierania wszystkich transakcji:', error);
            alert('Nie udało się pobrać wszystkich transakcji.');
        }
    };

    // Funkcja zamykająca modal
    const handleCloseModal = () => {
        setSelectedAccount(null);
        setTransactions([]);
    };

    return (
        <div className="account-balances">
            <h3>Stany kont</h3>
            <table>
                <thead>
                    <tr>
                        <th>Konto</th>
                        <th>Stan bieżący</th>
                    </tr>
                </thead>
                <tbody>
                    {accountBalances.map(account => (
                        <tr key={account.id}>
                            <td 
                                className={['Oszczędnościowe', 'Rachunki', 'KWNR'].includes(account.name) ? 'clickable-account' : ''} 
                                onClick={() => ['Oszczędnościowe', 'Rachunki', 'KWNR'].includes(account.name) && handleAccountClick(account.name)}
                                title={['Oszczędnościowe', 'Rachunki', 'KWNR'].includes(account.name) ? 'Kliknij, aby zobaczyć przepływy' : ''}
                            >
                                {account.name}
                            </td>
                            <td 
                                className="current-balance" 
                                title={`Stan początkowy: ${formatCurrency(account.initial_balance)}`}
                            >
                                {formatCurrency(account.current_balance)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Modal z transakcjami konta */}
            {selectedAccount && (
                <AccountTransactionsModal 
                    isOpen={!!selectedAccount} 
                    onClose={handleCloseModal} 
                    accountName={selectedAccount} 
                    transactions={transactions}
                    showAllTransactions={showAllTransactions}
                    onShowAllTransactions={handleShowAllTransactions}
                    currentAccountBalance={accountBalances.find(acc => acc.name === selectedAccount)?.current_balance}
                />
            )}
        </div>
    );
}

export default AccountBalances;
