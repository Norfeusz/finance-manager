import React, { useState, useEffect, useRef } from 'react';
import './BillsTable.css';

function BillsTable({ transactions = [], currentBalance = null }) {
    // Funkcja do aktualizacji salda konta w bazie danych
    const updateAccountBalanceInDatabase = async (balance) => {
        try {
            const response = await fetch('http://localhost:3001/api/accounts/current-balance', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountName: 'Rachunki',
                    currentBalance: balance
                }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Zaktualizowano saldo w bazie danych:', data);
        } catch (error) {
            console.error('Błąd podczas aktualizacji salda w bazie danych:', error);
        }
    };
    // Stan komponentu
    const [bills, setBills] = useState([]);
    const [editingBill, setEditingBill] = useState(null);
    const [editedAmount, setEditedAmount] = useState('');
    const [accountBalance, setAccountBalance] = useState(300); // Wartość początkowa salda konta
    const firstRender = useRef(true); // Ref do śledzenia pierwszego renderowania

    // Ładowanie danych z localStorage przy montowaniu komponentu
    useEffect(() => {
        console.log('BillsTable - inicjalizacja komponentu');
        
        // Dane początkowe dla stałych płatności
        const initialBills = [
            { id: 1, name: 'Gaz', recipient: 'PGNiG', amount: '' }, // Puste pole do uzupełnienia
            { id: 2, name: 'Spotify', recipient: 'Norf', amount: '38' },
            { id: 3, name: 'Czynsz', recipient: 'Wspólnota', amount: '338.77' },
            { id: 4, name: 'Enel', recipient: 'Gabi', amount: '180' },
            { id: 5, name: 'Woda', recipient: 'Wodociągi', amount: '' }, // Puste pole do uzupełnienia
            { id: 6, name: 'Prąd', recipient: 'Tauron', amount: '200' },
        ];
        
        const savedBills = localStorage.getItem('monthlyBills');
        if (savedBills) {
            setBills(JSON.parse(savedBills));
        } else {
            setBills(initialBills);
        }
        
            // Używaj wartości z props, jeśli jest dostępna, w przeciwnym razie pobierz z bazy danych
        if (currentBalance !== null) {
            // Jeśli mamy wartość przekazaną jako props, użyj jej jako źródła prawdy
            const balance = parseFloat(currentBalance || 300);
            console.log(`Używam salda konta Rachunki przekazanego jako props: ${balance} zł`);
            setAccountBalance(balance);
            localStorage.setItem('billsAccountBalance', balance.toString());
        } else {
            // W przeciwnym razie pobierz z bazy danych
            const fetchAccountBalance = async () => {
                try {
                    const response = await fetch('http://localhost:3001/api/accounts/balances');
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}`);
                    }
                    const accounts = await response.json();
                    const billsAccount = accounts.find(account => account.name === 'Rachunki');
                    
                    if (billsAccount) {
                        // Zawsze używaj salda z bazy danych jako źródła prawdy
                        const dbBalance = parseFloat(billsAccount.current_balance || 300);
                        console.log(`Pobrano saldo konta Rachunki z bazy danych: ${dbBalance} zł`);
                        
                        setAccountBalance(dbBalance);
                        localStorage.setItem('billsAccountBalance', dbBalance.toString());
                    } else {
                        // Jeśli konto nie istnieje w bazie, użyj wartości domyślnej 300 zł
                        console.log('Nie znaleziono konta Rachunki w bazie danych, używam wartości domyślnej 300 zł');
                        setAccountBalance(300);
                        localStorage.setItem('billsAccountBalance', '300');
                    }
                } catch (error) {
                    console.error('Błąd podczas pobierania salda konta z bazy danych:', error);
                    
                    // W przypadku błędu, spróbuj użyć lokalnego salda
                    const savedBalance = localStorage.getItem('billsAccountBalance');
                    if (savedBalance) {
                        setAccountBalance(parseFloat(savedBalance));
                    } else {
                        setAccountBalance(300);
                    }
                }
            };
            
            fetchAccountBalance();
        }
        
        // Wyczyść lub zresetuj localStorage dla śledzenia transferów,
        // aby ponownie przetwarzać transfery przy każdym otwarciu okna
        localStorage.removeItem('billsAccountTransfers');
    }, [currentBalance]);
    
    // Śledź przetworzone transfery i aktualizuj saldo konta
    useEffect(() => {
        // Przy pierwszym renderowaniu pomijamy przetwarzanie transferów
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        
        // Pomiń przetwarzanie, gdy nie ma transakcji
        if (transactions.length === 0) return;
        
        // Zawsze używaj aktualnego stanu salda z komponentu (który jest zsynchronizowany z bazą danych)
        let newBalance = accountBalance;
        
        // Zamiast używać listy przetworzonych ID, będziemy śledzić transfery z pełnymi danymi
        // To umożliwi nam sprawdzenie, czy transfer został cofnięty/usunięty
        const savedTransfers = JSON.parse(localStorage.getItem('billsAccountTransfers')) || {};
        const updatedTransfers = {...savedTransfers};
        
        // 1. Sprawdź nowe transfery i dodaj je do listy śledzonych
        transactions.forEach(transaction => {
            // Sprawdź czy to transfer na konto "Rachunki"
            if (transaction.type === 'transfer' && 
                transaction.description && 
                transaction.description === 'Transfer do: Rachunki') {
                
                // Jeśli to nowy transfer (nie był wcześniej śledzony)
                if (!savedTransfers[transaction.id]) {
                    const transferAmount = parseFloat(transaction.cost || transaction.amount || 0);
                    newBalance += transferAmount;
                    
                    // Zapisz transfer do śledzenia z jego kwotą
                    updatedTransfers[transaction.id] = {
                        id: transaction.id,
                        amount: transferAmount,
                        date: transaction.date
                    };
                    
                    console.log(`Dodano nowy transfer ID: ${transaction.id}, kwota: ${transferAmount} zł, nowe saldo: ${newBalance} zł`);
                }
            }
        });
        
        // 2. Sprawdź usunięte transfery - jeśli nie ma ich w bieżących transakcjach
        const currentTransactionIds = transactions.map(t => t.id);
        
        Object.keys(savedTransfers).forEach(savedId => {
            // Jeśli zapisany transfer nie występuje w bieżących transakcjach, został usunięty
            if (!currentTransactionIds.includes(parseInt(savedId)) && !currentTransactionIds.includes(savedId)) {
                const removedTransfer = savedTransfers[savedId];
                
                // Odejmij kwotę usuniętego transferu od salda
                newBalance -= removedTransfer.amount;
                console.log(`Cofnięto transfer ID: ${savedId}, kwota: ${removedTransfer.amount} zł, nowe saldo: ${newBalance} zł`);
                
                // Usuń transfer z listy śledzonych
                delete updatedTransfers[savedId];
            }
        });
        
        // 3. Aktualizuj saldo tylko jeśli się zmieniło
        if (newBalance !== accountBalance) {
            setAccountBalance(newBalance);
            localStorage.setItem('billsAccountBalance', newBalance.toString());
            console.log(`Zaktualizowano saldo konta Rachunki: ${newBalance} zł`);
            
            // Aktualizuj również saldo konta w bazie danych
            updateAccountBalanceInDatabase(newBalance);
        }
        
        // 4. Zapisz zaktualizowaną listę śledzonych transferów
        localStorage.setItem('billsAccountTransfers', JSON.stringify(updatedTransfers));
    }, [transactions, accountBalance]);

    // Zapisywanie danych do localStorage po każdej zmianie
    useEffect(() => {
        if (bills.length > 0) {
            localStorage.setItem('monthlyBills', JSON.stringify(bills));
        }
    }, [bills]);

    // Funkcja do rozpoczęcia edycji kwoty
    const handleEditAmount = (bill) => {
        setEditingBill(bill.id);
        setEditedAmount(bill.amount);
    };

    // Funkcja do zakończenia edycji i zapisania kwoty
    const handleSaveAmount = (id) => {
        const updatedBills = bills.map(bill => {
            if (bill.id === id) {
                return { ...bill, amount: editedAmount };
            }
            return bill;
        });

        setBills(updatedBills);
        setEditingBill(null);
        setEditedAmount('');
    };

    // Funkcja do anulowania edycji
    const handleCancelEdit = () => {
        setEditingBill(null);
        setEditedAmount('');
    };

    // Funkcja pomocnicza do formatowania waluty
    const formatCurrency = (value) => {
        if (!value) return '';
        return parseFloat(value).toLocaleString('pl-PL', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }) + ' zł';
    };

    // Funkcja do obliczania sumy wszystkich opłaconych rachunków
    const calculateTotal = () => {
        return bills
            .filter(bill => bill.amount)
            .reduce((total, bill) => total + parseFloat(bill.amount), 0);
    };
    
    // Funkcja do odejmowania rachunków od salda
    const deductBillsFromBalance = () => {
        const totalBills = calculateTotal();
        let newBalance = accountBalance - totalBills;
        
        // Nie pozwalamy na ujemne saldo
        if (newBalance < 0) newBalance = 0;
        
        setAccountBalance(newBalance);
        localStorage.setItem('billsAccountBalance', newBalance.toString());
        
        // Aktualizuj saldo w bazie danych
        updateAccountBalanceInDatabase(newBalance);
        
        alert(`Odliczono ${totalBills} zł z salda konta. Nowe saldo: ${newBalance.toFixed(2)} zł`);
    };
    
    // Funkcja do resetowania salda do wartości początkowej
    const resetBalance = () => {
        const initialBalance = 300;
        setAccountBalance(initialBalance);
        localStorage.setItem('billsAccountBalance', initialBalance.toString());
        
        // Resetuj również listę śledzonych transferów
        localStorage.setItem('billsAccountTransfers', JSON.stringify({}));
        
        // Aktualizuj saldo w bazie danych
        updateAccountBalanceInDatabase(initialBalance);
        
        alert(`Zresetowano saldo konta do wartości początkowej: ${initialBalance.toFixed(2)} zł`);
    };

    return (
        <div className="bills-table-container">
            <div className="bills-header">
                <h3>Stałe płatności miesięczne</h3>
                <div className="account-balance-info">
                    <span className="balance-label">Saldo konta: </span>
                    <span className="balance-amount">{formatCurrency(accountBalance)}</span>
                </div>
            </div>
            
            <div className="bills-actions">
                <button 
                    className="action-button deduct-button" 
                    onClick={deductBillsFromBalance}
                    title="Odejmij rachunki od salda"
                >
                    💰
                </button>
                <button 
                    className="action-button reset-button" 
                    onClick={resetBalance}
                    title="Resetuj saldo"
                >
                    🔄
                </button>
                <button 
                    className="action-button debug-button" 
                    onClick={() => {
                        const trackedTransfers = JSON.parse(localStorage.getItem('billsAccountTransfers')) || {};
                        console.log('Śledzone transfery:', trackedTransfers);
                        console.log('Aktualne transakcje:', transactions);
                        
                        const transferCount = Object.keys(trackedTransfers).length;
                        const totalAmount = Object.values(trackedTransfers)
                            .reduce((sum, transfer) => sum + transfer.amount, 0);
                            
                        alert(`Liczba śledzonych transferów: ${transferCount}. 
Suma transferów: ${totalAmount.toFixed(2)} zł.
Saldo konta: ${accountBalance.toFixed(2)} zł.
Szczegóły w konsoli.`);
                    }}
                    title="Pokaż informacje debugowania"
                >
                    ℹ️
                </button>
            </div>
            
            <table className="bills-table">
                <thead>
                    <tr>
                        <th>Za co</th>
                        <th>Komu</th>
                        <th>Kwota</th>
                        <th>Akcje</th>
                    </tr>
                </thead>
                <tbody>
                    {bills.map((bill) => (
                        <tr key={bill.id}>
                            <td>{bill.name}</td>
                            <td>{bill.recipient}</td>
                            <td className="amount-cell">
                                {editingBill === bill.id ? (
                                    <input
                                        type="text"
                                        value={editedAmount}
                                        onChange={(e) => setEditedAmount(e.target.value)}
                                        autoFocus
                                        className="amount-input"
                                    />
                                ) : (
                                    bill.amount ? formatCurrency(bill.amount) : <span className="empty-amount">Uzupełnij kwotę</span>
                                )}
                            </td>
                            <td className="actions-cell">
                                {editingBill === bill.id ? (
                                    <>
                                        <button 
                                            className="save-button" 
                                            onClick={() => handleSaveAmount(bill.id)}
                                        >
                                            ✓
                                        </button>
                                        <button 
                                            className="cancel-button" 
                                            onClick={handleCancelEdit}
                                        >
                                            ✕
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        className="edit-button" 
                                        onClick={() => handleEditAmount(bill)}
                                    >
                                        ✎
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan="2" className="total-label">Suma</td>
                        <td className="total-amount">{formatCurrency(calculateTotal())}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

export default BillsTable;
