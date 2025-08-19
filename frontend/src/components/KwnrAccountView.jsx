import React, { useState, useEffect } from 'react';
import './KwnrAccountView.css';

function KwnrAccountView({ transactions = [], currentBalance = null }) {
    // Stan dla formularza dodawania wydatku
    const [newExpense, setNewExpense] = useState({
        name: '',
        person: 'Gabi', // Domyślnie wybrana Gabi
        amount: '',
        date: new Date().toISOString().split('T')[0] // Dzisiejsza data jako domyślna
    });
    
    // Stan dla widoczności formularzy
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [showTransferForm, setShowTransferForm] = useState(false);
    
    // Stan dla formularza transferu
    const [newTransfer, setNewTransfer] = useState({
        type: 'wpływ',
        source: 'Wspólne',
        destination: 'Gabi',
        amount: '',
        date: new Date().toISOString().split('T')[0]
    });
    
    // Funkcja obsługująca zmiany w formularzu
    const handleExpenseChange = (e) => {
        const { name, value } = e.target;
        setNewExpense(prev => ({
            ...prev,
            [name]: name === 'amount' ? value.replace(/[^0-9.,]/g, '').replace(',', '.') : value
        }));
    };
    
    // Funkcja dodająca nowy wydatek
    const handleAddExpense = async (e) => {
        e.preventDefault();
        
        // Walidacja formularza
        if (!newExpense.name || !newExpense.amount || !newExpense.date) {
            alert('Wypełnij wszystkie pola formularza!');
            return;
        }
        
        // Konwersja kwoty do liczby
        const amount = parseFloat(newExpense.amount);
        
        if (isNaN(amount) || amount <= 0) {
            alert('Podaj poprawną kwotę!');
            return;
        }
        
        try {
            // Przygotuj dane do wysłania na serwer
            const expenseData = {
                date: newExpense.date,
                type: 'expense',
                cost: amount,
                account: 'KWNR',
                category: 'Wspólne wydatki',
                description: `${newExpense.name} (${newExpense.person})`,
                extraDescription: `KWNR expense by ${newExpense.person}`
            };
            
            // Wysyłamy na serwer
            const response = await fetch('http://localhost:3001/api/expenses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(expenseData),
            });
            
            if (!response.ok) {
                throw new Error(`Błąd HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Tworzenie nowego wydatku z ID z serwera
            const newExpenseItem = {
                id: result.id || Date.now(),
                name: newExpense.name,
                person: newExpense.person,
                amount: amount,
                balanceAfter: amount + (expenses.length > 0 ? expenses[0].balanceAfter : 0),
                date: newExpense.date
            };
            
            // Dodanie do listy wydatków
            const updatedExpenses = [newExpenseItem, ...expenses];
            updatedExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Aktualizacja stanu
            setExpenses(updatedExpenses);
            
            // Resetowanie formularza
            setNewExpense({
                name: '',
                person: 'Gabi',
                amount: '',
                date: new Date().toISOString().split('T')[0]
            });
            
            // Ukrycie formularza
            setShowExpenseForm(false);
            
            // Aktualizacja bilansu
            updateBalances(newExpenseItem);
            
            alert('Wydatek został pomyślnie zapisany!');
        } catch (error) {
            console.error('Błąd podczas zapisywania wydatku:', error);
            alert(`Wystąpił błąd podczas zapisywania wydatku: ${error.message}`);
        }
    };
    
    // Funkcja aktualizująca bilanse osób
    const updateBalances = (newExpense) => {
        // Prosta logika aktualizacji bilansu - w przyszłości do rozbudowy
        setBalances(prev => {
            if (newExpense.person === 'Gabi') {
                return { ...prev, gabi: prev.gabi + newExpense.amount };
            } else {
                return { ...prev, norf: prev.norf + newExpense.amount };
            }
        });
    };
    
    // Funkcja obsługująca zmiany w formularzu transferu
    const handleTransferChange = (e) => {
        const { name, value } = e.target;
        setNewTransfer(prev => ({
            ...prev,
            [name]: name === 'amount' ? value.replace(/[^0-9.,]/g, '').replace(',', '.') : value
        }));
    };
    
    // Funkcja dodająca nowy transfer
    const handleAddTransfer = async (e) => {
        e.preventDefault();
        
        // Walidacja formularza
        if (!newTransfer.amount || !newTransfer.date) {
            alert('Wypełnij wszystkie pola formularza!');
            return;
        }
        
        // Konwersja kwoty do liczby
        const amount = parseFloat(newTransfer.amount);
        
        if (isNaN(amount) || amount <= 0) {
            alert('Podaj poprawną kwotę!');
            return;
        }
        
        try {
            // Przygotuj dane do wysłania na serwer
            let transferData;
            
            if (newTransfer.type === 'wpływ') {
                // Dla wpływu tworzymy transfer do KWNR
                transferData = {
                    date: newTransfer.date,
                    type: 'transfer',
                    cost: amount,
                    account: newTransfer.source,
                    description: 'Transfer do: KWNR',
                    toAccount: 'KWNR',
                    extraDescription: `Transfer na konto wspólnych wydatków z ${newTransfer.source}`
                };
            } else {
                // Dla rozliczenia tworzymy wydatek z KWNR
                transferData = {
                    date: newTransfer.date,
                    type: 'transfer',
                    cost: amount,
                    account: 'KWNR',
                    description: `Rozliczenie dla: ${newTransfer.destination}`,
                    category: 'Rozliczenia',
                    extraDescription: `KWNR settlement to ${newTransfer.destination}`
                };
            }
            
            // Wysyłamy na serwer
            const response = await fetch('http://localhost:3001/api/expenses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(transferData),
            });
            
            if (!response.ok) {
                throw new Error(`Błąd HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Tworzenie nowego transferu z ID z serwera
            const newTransferItem = {
                id: result.id || Date.now(),
                type: newTransfer.type,
                amount: amount,
                date: newTransfer.date
            };
            
            // Dodaj odpowiednie pola w zależności od typu transferu
            if (newTransfer.type === 'wpływ') {
                newTransferItem.source = newTransfer.source;
            } else {
                newTransferItem.destination = newTransfer.destination;
            }
            
            // Obliczenie nowego bilansu
            const lastTransfer = transfers.length > 0 ? transfers[0] : { balanceAfter: 0 };
            const currentBalance = lastTransfer.balanceAfter || 0;
            
            // Wpływy zwiększają saldo, rozliczenia zmniejszają
            const newBalance = newTransfer.type === 'wpływ' ? 
                currentBalance + amount : 
                currentBalance - amount;
            
            newTransferItem.balanceAfter = newBalance;
            
            // Dodanie do listy transferów
            const updatedTransfers = [newTransferItem, ...transfers];
            updatedTransfers.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Aktualizacja stanu
            setTransfers(updatedTransfers);
            
            // Resetowanie formularza
            setNewTransfer({
                type: 'wpływ',
                source: 'Wspólne',
                destination: 'Gabi',
                amount: '',
                date: new Date().toISOString().split('T')[0]
            });
            
            // Ukrycie formularza
            setShowTransferForm(false);
            
            alert('Transfer został pomyślnie zapisany!');
        } catch (error) {
            console.error('Błąd podczas zapisywania transferu:', error);
            alert(`Wystąpił błąd podczas zapisywania transferu: ${error.message}`);
        }
    };
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

    // Stan komponentu
    const [expenses, setExpenses] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [balances, setBalances] = useState({
        gabi: 0,
        norf: 0
    });

    // Funkcja do przetwarzania transakcji z API
    const processTransactions = (transactions) => {
        // Jeśli nie ma transakcji, użyj przykładowych danych
        if (!transactions || transactions.length === 0) {
            // Tymczasowe przykładowe dane
            const sampleExpenses = [
                { id: 1, name: 'Zakupy spożywcze', person: 'Gabi', amount: 125.50, balanceAfter: 125.50, date: '2025-08-15' },
                { id: 2, name: 'Restauracja', person: 'Norf', amount: 89.90, balanceAfter: 215.40, date: '2025-08-16' },
                { id: 3, name: 'Kino', person: 'Norf', amount: 45.00, balanceAfter: 260.40, date: '2025-08-18' }
            ];

            const sampleTransfers = [
                { id: 101, type: 'wpływ', source: 'Wspólne', amount: 500.00, balanceAfter: 500.00, date: '2025-08-10' },
                { id: 102, type: 'rozliczenie', destination: 'Gabi', amount: 200.00, balanceAfter: 300.00, date: '2025-08-17' },
                { id: 103, type: 'wpływ', source: 'Rachunki', amount: 150.00, balanceAfter: 450.00, date: '2025-08-19' }
            ];

            setExpenses(sampleExpenses);
            setTransfers(sampleTransfers);
            
            // Przykładowy stan salda
            setBalances({
                gabi: 150.25,
                norf: 149.75
            });
            
            return;
        }
        
        // Przetwarzanie rzeczywistych transakcji z API
        const processedExpenses = [];
        const processedTransfers = [];
        let totalBalance = 0;
        let gabiBalance = 0;
        let norfBalance = 0;
        
        // Przetwarzaj transakcje chronologicznie
        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        sortedTransactions.forEach(transaction => {
            // Identyfikujemy transfery na konto KWNR (transfer do tego konta)
            if (transaction.type === 'transfer' && 
                (transaction.description.includes('Transfer do: KWNR') || 
                 transaction.toAccount === 'KWNR')) {
                
                // To jest wpływ na konto KWNR
                const amount = parseFloat(transaction.cost || transaction.amount || 0);
                totalBalance += amount;
                
                processedTransfers.push({
                    id: transaction.id,
                    type: 'wpływ',
                    source: transaction.account || transaction.fromAccount || 'Nieznane',
                    amount: amount,
                    balanceAfter: totalBalance,
                    date: transaction.date
                });
            }
            // Tu można dodać obsługę innych typów transakcji
        });
        
        // Aktualizuj stan
        if (processedExpenses.length > 0) {
            setExpenses(processedExpenses);
        }
        
        if (processedTransfers.length > 0) {
            setTransfers(processedTransfers);
        }
        
        // Aktualizuj bilans
        setBalances({
            gabi: gabiBalance,
            norf: norfBalance
        });
    };
    
    // Przetwarzaj transakcje po załadowaniu lub zmianie
    useEffect(() => {
        processTransactions(transactions);
    }, [transactions]);

    return (
        <div className="kwnr-account-container">
            <div className="kwnr-section balances-section">
                <div className="section-header">
                    <h3>Saldo</h3>
                </div>
                <div className="balance-cards">
                    <div className="balance-card gabi">
                        <div className="person">Gabi</div>
                        <div className="amount">{formatCurrency(balances.gabi)}</div>
                    </div>
                    <div className="balance-card norf">
                        <div className="person">Norf</div>
                        <div className="amount">{formatCurrency(balances.norf)}</div>
                    </div>
                </div>
            </div>

            <div className="kwnr-section expenses-section">
                <div className="section-header">
                    <h3>Wydatki</h3>
                    <button 
                        className="add-button"
                        onClick={() => setShowExpenseForm(!showExpenseForm)}
                    >
                        {showExpenseForm ? 'Anuluj' : 'Dodaj wydatek'}
                    </button>
                </div>
                
                {showExpenseForm && (
                    <form className="expense-form" onSubmit={handleAddExpense}>
                        <div className="form-group">
                            <label htmlFor="expense-name">Za co:</label>
                            <input
                                id="expense-name"
                                type="text"
                                name="name"
                                value={newExpense.name}
                                onChange={handleExpenseChange}
                                placeholder="Opisz wydatek"
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="expense-person">Kto:</label>
                            <select
                                id="expense-person"
                                name="person"
                                value={newExpense.person}
                                onChange={handleExpenseChange}
                                required
                            >
                                <option value="Gabi">Gabi</option>
                                <option value="Norf">Norf</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="expense-amount">Kwota:</label>
                            <input
                                id="expense-amount"
                                type="text"
                                name="amount"
                                value={newExpense.amount}
                                onChange={handleExpenseChange}
                                placeholder="0,00"
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="expense-date">Data:</label>
                            <input
                                id="expense-date"
                                type="date"
                                name="date"
                                value={newExpense.date}
                                onChange={handleExpenseChange}
                                required
                            />
                        </div>
                        
                        <div className="form-actions">
                            <button type="submit" className="save-expense-btn">Zapisz</button>
                            <button 
                                type="button" 
                                className="cancel-btn"
                                onClick={() => setShowExpenseForm(false)}
                            >
                                Anuluj
                            </button>
                        </div>
                    </form>
                )}
                
                <table className="kwnr-table expenses-table">
                    <thead>
                        <tr>
                            <th>Wydatek</th>
                            <th>Kto</th>
                            <th>Kwota</th>
                            <th>Bilans po wydatku</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.length > 0 ? (
                            expenses.map((expense) => (
                                <tr key={expense.id}>
                                    <td>{expense.name}</td>
                                    <td>{expense.person}</td>
                                    <td className="amount-cell">{formatCurrency(expense.amount)}</td>
                                    <td className="amount-cell">{formatCurrency(expense.balanceAfter)}</td>
                                    <td>{formatDate(expense.date)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="no-data">Brak zarejestrowanych wydatków</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="kwnr-section transfers-section">
                <div className="section-header">
                    <h3>Transfery</h3>
                    <button 
                        className="add-button"
                        onClick={() => setShowTransferForm(!showTransferForm)}
                    >
                        {showTransferForm ? 'Anuluj' : 'Dodaj transfer'}
                    </button>
                </div>
                
                {showTransferForm && (
                    <form className="expense-form transfer-form" onSubmit={handleAddTransfer}>
                        <div className="form-group">
                            <label htmlFor="transfer-type">Typ:</label>
                            <select
                                id="transfer-type"
                                name="type"
                                value={newTransfer.type}
                                onChange={handleTransferChange}
                                required
                            >
                                <option value="wpływ">Wpływ</option>
                                <option value="rozliczenie">Rozliczenie</option>
                            </select>
                        </div>
                        
                        {newTransfer.type === 'wpływ' ? (
                            <div className="form-group">
                                <label htmlFor="transfer-source">Źródło:</label>
                                <select
                                    id="transfer-source"
                                    name="source"
                                    value={newTransfer.source}
                                    onChange={handleTransferChange}
                                    required
                                >
                                    <option value="Wspólne">Wspólne</option>
                                    <option value="Rachunki">Rachunki</option>
                                    <option value="Gotówka">Gotówka</option>
                                    <option value="Inne">Inne</option>
                                </select>
                            </div>
                        ) : (
                            <div className="form-group">
                                <label htmlFor="transfer-destination">Dla kogo:</label>
                                <select
                                    id="transfer-destination"
                                    name="destination"
                                    value={newTransfer.destination}
                                    onChange={handleTransferChange}
                                    required
                                >
                                    <option value="Gabi">Gabi</option>
                                    <option value="Norf">Norf</option>
                                </select>
                            </div>
                        )}
                        
                        <div className="form-group">
                            <label htmlFor="transfer-amount">Kwota:</label>
                            <input
                                id="transfer-amount"
                                type="text"
                                name="amount"
                                value={newTransfer.amount}
                                onChange={handleTransferChange}
                                placeholder="0,00"
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="transfer-date">Data:</label>
                            <input
                                id="transfer-date"
                                type="date"
                                name="date"
                                value={newTransfer.date}
                                onChange={handleTransferChange}
                                required
                            />
                        </div>
                        
                        <div className="form-actions">
                            <button type="submit" className="save-expense-btn">Zapisz</button>
                            <button 
                                type="button" 
                                className="cancel-btn"
                                onClick={() => setShowTransferForm(false)}
                            >
                                Anuluj
                            </button>
                        </div>
                    </form>
                )}
                
                <table className="kwnr-table transfers-table">
                    <thead>
                        <tr>
                            <th>Wpływ/Rozliczenie</th>
                            <th>Skąd/Dokąd</th>
                            <th>Kwota</th>
                            <th>Bilans po</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transfers.length > 0 ? (
                            transfers.map((transfer) => (
                                <tr key={transfer.id}>
                                    <td>{transfer.type}</td>
                                    <td>{transfer.source || transfer.destination}</td>
                                    <td className="amount-cell">{formatCurrency(transfer.amount)}</td>
                                    <td className="amount-cell">{formatCurrency(transfer.balanceAfter)}</td>
                                    <td>{formatDate(transfer.date)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="no-data">Brak zarejestrowanych transferów</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default KwnrAccountView;
