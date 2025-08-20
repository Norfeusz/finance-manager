import React, { useState, useEffect } from 'react';
import './KwnrAccountView.css';

function KwnrAccountView({ transactions: initialTransactions, currentBalance: initialBalance }) {
    // Stan dla formularza dodawania wydatku
    const [newExpense, setNewExpense] = useState({
        name: '',
        person: 'Gabi', // Domyślnie wybrana Gabi
        amount: '',
        date: new Date().toISOString().split('T')[0] // Dzisiejsza data jako domyślna
    });
    
    // Stan dla edycji wydatku
    const [editExpense, setEditExpense] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    
    // Stany do przechowywania danych lokalnie
    const [transactions, setTransactions] = useState(initialTransactions || []);
    const [currentBalance, setCurrentBalance] = useState(initialBalance || 0);
    const [isLoading, setIsLoading] = useState(false);
    
    // Stan dla widoczności formularzy
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [showTransferForm, setShowTransferForm] = useState(false);
    
    // Funkcja pobierająca dane o transakcjach KWNR
    const fetchKwnrData = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('http://localhost:3001/api/accounts/KWNR/transactions');
            if (response.ok) {
                const data = await response.json();
                console.log("Otrzymane dane z API:", JSON.stringify(data, null, 2));
                if (data.transactions) {
                    data.transactions.slice(0,20).forEach(t => console.log('[KWNR RAW DATE]', t.id, t.date));
                }
                setTransactions(data.transactions || []);
                setCurrentBalance(data.balance || 0);
            } else {
                console.error('Błąd pobierania danych KWNR:', await response.text());
            }
        } catch (error) {
            console.error('Błąd podczas pobierania danych KWNR:', error);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Pobierz dane przy pierwszym renderowaniu
    useEffect(() => {
        fetchKwnrData();
    }, []);
    
    // Aktualizuj dane przy zmianie props
    useEffect(() => {
        if (initialTransactions) {
            setTransactions(initialTransactions);
        }
        if (initialBalance !== undefined) {
            setCurrentBalance(initialBalance);
        }
    }, [initialTransactions, initialBalance]);
    
    // Stan dla formularza transferu
    const [newTransfer, setNewTransfer] = useState({
        type: 'wpływ',
        source: 'Wspólne',
        destination: 'Gabi',
        amount: '',
        date: new Date().toISOString().split('T')[0]
    });

    // Salda osób (SG, SN) wg wzoru: S = -W + R
    // W = suma wydatków (expenses) dla danej osoby
    // R = suma transferów typu "rozliczenie" (transfer.type === 'expense') gdzie Skąd/Dokąd wskazuje osobę
    const [gabiBalance, setGabiBalance] = useState(0); // SG
    const [norfBalance, setNorfBalance] = useState(0); // SN
    const [availableFunds, setAvailableFunds] = useState(0);
    // Stan formularza rozliczenia
    const [settleTarget, setSettleTarget] = useState(null); // 'Gabi' | 'Norf' | null
    const [settleAmount, setSettleAmount] = useState('');
    const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
    const [settleError, setSettleError] = useState('');
    
    // Funkcja obsługująca zmiany w formularzu
    const handleExpenseChange = (e) => {
        const { name, value } = e.target;
        setNewExpense(prev => ({
            ...prev,
            [name]: name === 'amount' ? value.replace(/[^0-9.,]/g, '').replace(',', '.') : value
        }));
    };
    
    // Funkcja dodająca nowy wydatek do konta KWNR
    const handleAddExpense = async (e) => {
        e.preventDefault();
        
        // Walidacja
        if (!newExpense.name || !newExpense.person || !newExpense.amount || !newExpense.date) {
            alert('Wypełnij wszystkie pola formularza');
            return;
        }
        
        const amount = parseFloat(newExpense.amount);
        if (isNaN(amount) || amount <= 0) {
            alert('Podaj prawidłową kwotę');
            return;
        }
        
        try {
            // Przygotowanie daty w formacie YYYY-MM-DD - zachowujemy datę bez strefy czasowej
            // Jeśli użytkownik wybierze datę w formacie "2023-08-16", to dokładnie taka data
            // zostanie wysłana do backendu, bez ryzyka przesunięcia przez strefę czasową
            const selectedDate = newExpense.date;
            console.log("Wybrana data przed wysłaniem:", selectedDate);
            
            // Tworzymy strukturę danych dla API - specjalny format dla wydatków KWNR
            const payload = [{
                flowType: 'expense',
                data: {
                    account: 'KWNR', // Konto KWNR
                    cost: amount.toString(),
                    date: selectedDate, // Używamy dokładnie tej samej daty, którą użytkownik wybrał
                    mainCategory: 'Wydatek KWNR', // Kategoria dla wszystkich wydatków KWNR
                    description: newExpense.name, // Nazwa wydatku dokładnie tak jak użytkownik wpisał w polu "za co"
                    extra_description: newExpense.person, // Informacja o osobie - prosto, bez dodatkowego tekstu
                    isKwnrExpense: true, // Specjalny znacznik dla backendu
                    person: newExpense.person // Informacja o osobie
                }
            }];
            
            // Wysyłamy dane do API
            // Log przed wysłaniem, aby sprawdzić co dokładnie wysyłamy
            console.log("Wysyłam do API następujące dane:", JSON.stringify(payload, null, 2));
            
            const response = await fetch('http://localhost:3001/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Wyświetl komunikat o sukcesie
                alert(`Wydatek "${newExpense.name}" został dodany`);
                
                // Resetuj formularz
                setNewExpense({
                    name: '',
                    person: 'Gabi',
                    amount: '',
                    date: new Date().toISOString().split('T')[0]
                });
                
                // Zamknij formularz
                setShowExpenseForm(false);
                
                // Logi debugowania - sprawdź, co zostało zapisane w bazie
                console.log("Dodano wydatek, ID:", result.id || 'nieznane ID');
                console.log("Wysłana data:", selectedDate);
                console.log("Odświeżam dane z backendu...");
                
                // Odświeżenie danych z backendu po krótkim opóźnieniu, aby baza zdążyła przetworzyć zmiany
                setTimeout(() => {
                    fetchKwnrData();
                }, 500);
            } else {
                alert(`Błąd: ${result.message || 'Nie udało się zapisać wydatku'}`);
            }
        } catch (error) {
            console.error('Błąd podczas zapisywania wydatku:', error);
            alert('Wystąpił błąd podczas zapisywania wydatku');
        }
    };
    
    // Funkcja obsługująca zmiany w formularzu transferu
    const handleTransferChange = (e) => {
        const { name, value } = e.target;
        setNewTransfer(prev => ({
            ...prev,
            [name]: name === 'amount' ? value.replace(/[^0-9.,]/g, '').replace(',', '.') : value
        }));
    };
    
    // Pusta funkcja dodająca nowy transfer - będzie zaimplementowana od nowa
    const handleAddTransfer = (e) => {
        e.preventDefault();
        alert('Funkcja dodawania transferów zostanie zaimplementowana od nowa');
    };
    // Funkcja pomocnicza do formatowania waluty
    const formatCurrency = (value) => {
        if (value === null || value === undefined) return '-';
        return parseFloat(value).toLocaleString('pl-PL', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }) + ' zł';
    };
    
    // Funkcja do obsługi edycji wydatku
    const handleEditExpense = (expense) => {
        console.log("Edycja wydatku:", expense);
        
        // Utwórz kopię obiektu wydatku, aby uniknąć bezpośredniej modyfikacji stanu
        const expenseToEdit = {
            ...expense,
            // Zachowaj oryginalne wartości do porównania przy zapisie
            originalName: expense.name || expense.description,
            originalPerson: expense.person || expense.extra_description,
            // Jeśli data jest w formacie DD.MM.YYYY, konwertujemy ją na YYYY-MM-DD dla elementu input type="date"
            date: expense.date && expense.date.includes('.') 
                ? expense.date.split('.').reverse().join('-') 
                : expense.date
        };
        
        console.log("Dane do edycji:", expenseToEdit);
        
        // Ustaw stan edycji i otwórz modal
        setEditExpense(expenseToEdit);
        setIsEditModalOpen(true);
    };
    
    // Funkcja do obsługi zapisywania zedytowanego wydatku
    const handleSaveEditedExpense = async () => {
        if (!editExpense || !editExpense.id) {
            alert("Błąd: Brak identyfikatora wydatku do aktualizacji");
            return;
        }
        
        try {
            setIsLoading(true);
            
            // Walidacja danych
            if (!editExpense.name || !editExpense.person || !editExpense.amount || !editExpense.date) {
                alert("Wypełnij wszystkie pola formularza");
                return;
            }
            
            const amount = parseFloat(editExpense.amount);
            if (isNaN(amount) || amount <= 0) {
                alert("Podaj prawidłową kwotę");
                return;
            }
            
            // Przygotowanie daty w formacie YYYY-MM-DD
            let selectedDate = editExpense.date;
            // Jeśli data jest w formacie DD.MM.YYYY, konwertujemy ją na YYYY-MM-DD
            if (selectedDate.includes('.')) {
                const [day, month, year] = selectedDate.split('.');
                selectedDate = `${year}-${month}-${day}`;
            }
            console.log("Data do wysłania:", selectedDate);
            
            // Przygotowanie danych do wysłania
            const original = {
                id: editExpense.id,
                account: 'KWNR',
                description: editExpense.originalName || editExpense.name,
                extra_description: editExpense.originalPerson || editExpense.person,
                extraDescription: editExpense.originalPerson || editExpense.person
            };
            
            const updated = {
                account: 'KWNR',
                cost: amount.toString(),
                date: selectedDate,
                mainCategory: 'Wydatek KWNR',
                description: editExpense.name,
                // Upewnijmy się, że wysyłamy informację o osobie we wszystkich możliwych polach
                extra_description: editExpense.person,
                extraDescription: editExpense.person,
                isKwnrExpense: true,
                person: editExpense.person
            };
            
            // Dodamy więcej logów, aby zobaczyć co się dzieje
            console.log("Oryginalna osoba:", editExpense.originalPerson);
            console.log("Nowa osoba:", editExpense.person);
            
            console.log("Wysyłam do API aktualizację:", JSON.stringify({ original, updated }, null, 2));
            
            // Wysłanie żądania do API
            const response = await fetch('http://localhost:3001/api/expenses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ original, updated })
            });
            
            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                console.error("Błąd parsowania odpowiedzi JSON:", jsonError);
                result = { message: "Serwer zwrócił nieprawidłową odpowiedź." };
            }
            
            if (response.ok) {
                alert(`Wydatek "${editExpense.name}" został zaktualizowany`);
                
                // Zamknij modal i zresetuj stan edycji
                setIsEditModalOpen(false);
                setEditExpense(null);
                
                // Odświeżenie danych z backendu po krótkim opóźnieniu
                setTimeout(() => {
                    fetchKwnrData();
                }, 500);
            } else {
                console.error("Błąd podczas aktualizacji wydatku:", result);
                alert(`Błąd: ${result.message || `Nie udało się zaktualizować wydatku (kod ${response.status})`}`);
            }
        } catch (error) {
            console.error("Błąd podczas aktualizacji wydatku:", error);
            alert("Wystąpił błąd podczas aktualizacji wydatku. Sprawdź konsolę, aby uzyskać więcej informacji.");
        } finally {
            setIsLoading(false);
        }
    };
    
    // Funkcja do obsługi usuwania wydatku
    const handleDeleteExpense = async (expense) => {
        console.log("Usuwanie wydatku:", expense);
        
        if (!expense || !expense.id) {
            alert("Błąd: Brak identyfikatora wydatku do usunięcia");
            return;
        }
        
        const confirmDelete = window.confirm(`Czy na pewno chcesz usunąć wydatek "${expense.name || expense.description}"?`);
        
        if (confirmDelete) {
            try {
                setIsLoading(true);
                
                // Wysłanie żądania do API, aby usunąć wydatek
                const response = await fetch('http://localhost:3001/api/expenses/delete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id: expense.id
                    })
                });
                
                let result;
                try {
                    // Próbujemy sparsować JSON z odpowiedzi
                    result = await response.json();
                } catch (jsonError) {
                    // Jeśli parsowanie się nie powiedzie, ustawiamy domyślną wiadomość
                    console.error("Błąd parsowania odpowiedzi JSON:", jsonError);
                    result = { message: "Serwer zwrócił nieprawidłową odpowiedź." };
                }
                
                if (response.ok) {
                    console.log("Pomyślnie usunięto wydatek:", result);
                    
                    // Najpierw animujemy usunięcie wiersza z tabeli
                    setExpenses(prevExpenses => 
                        prevExpenses.map(exp => 
                            exp.id === expense.id ? { ...exp, isDeleting: true } : exp
                        )
                    );

                    // Aktualizuj dane w interfejsie użytkownika po animacji
                    setTimeout(() => {
                        alert(`Wydatek "${expense.name || expense.description}" został pomyślnie usunięty.`);
                        
                        // Odśwież dane z serwera
                        fetchKwnrData();
                    }, 300);
                } else {
                    console.error("Błąd podczas usuwania wydatku:", result);
                    console.error("Kod statusu odpowiedzi:", response.status);
                    alert(`Błąd: ${result.message || `Nie udało się usunąć wydatku (kod ${response.status})`}`);
                }
            } catch (error) {
                console.error("Błąd podczas usuwania wydatku:", error);
                alert("Wystąpił błąd podczas usuwania wydatku. Sprawdź konsolę, aby uzyskać więcej informacji.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Funkcja pomocnicza do formatowania daty – bez przesunięć strefowych
    const formatDate = (dateString) => {
        if (!dateString) return '-';

        // 1. Gotowy format DD.MM.YYYY
        if (typeof dateString === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(dateString)) {
            return dateString;
        }

        // 2. Format YYYY-MM-DD (nie tworzymy obiektu Date aby NIE odejmować dnia)
        if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [y, m, d] = dateString.split('-');
            return `${d}.${m}.${y}`;
        }

        // 3. ISO z czasem – bierzemy tylko część przed 'T'
        if (typeof dateString === 'string' && dateString.includes('T')) {
            const isoPart = dateString.split('T')[0]; // YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(isoPart)) {
                const [y, m, d] = isoPart.split('-');
                return `${d}.${m}.${y}`;
            }
        }

        // 4. Obiekt Date (fallback – używamy lokalnych wartości, nie UTC)
        if (dateString instanceof Date) {
            const d = String(dateString.getDate()).padStart(2, '0');
            const m = String(dateString.getMonth() + 1).padStart(2, '0');
            const y = dateString.getFullYear();
            return `${d}.${m}.${y}`;
        }

        return dateString;
    };

    // Obliczenie sald i wydzielenie wydatków/transferów z transakcji
    const [expenses, setExpenses] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [editTransfer, setEditTransfer] = useState(null);
    const [isEditTransferModalOpen, setIsEditTransferModalOpen] = useState(false);

    // Przetwarzanie transakcji po ich otrzymaniu
    useEffect(() => {
        if (!transactions || transactions.length === 0) return;
        
        // Wyświetl otrzymane transakcje w konsoli dla debugowania
        console.log("Otrzymane transakcje:", JSON.stringify(transactions, null, 2));
        
        // Podział transakcji na wydatki i transfery
        const expensesList = [];
        const transfersList = [];
        
        // Analizujemy transakcje i dzielimy na odpowiednie kategorie
        transactions.forEach(transaction => {
            console.log('Przetwarzam transakcję:', JSON.stringify(transaction, null, 2)); // Dokładny log transakcji
            const isSettlement = transaction.type === 'expense' && transaction.description && transaction.description.startsWith('Rozliczenie:');
            if ((transaction.type === 'expense' || transaction.category === 'Wydatek KWNR') && !isSettlement) {
                // Tworzymy obiekt wydatku bezpośrednio na podstawie danych z transakcji
                // Ważne jest, aby wszystkie pola były dokładnie takie, jakie otrzymujemy z backendu
                const expenseObj = {
                    id: transaction.id,
                    // description - dokładnie to co użytkownik wpisał w polu "za co"
                    name: transaction.description || 'Wydatek bez nazwy',
                    // extra_description - dokładnie to co użytkownik wybrał w polu "kto"
                    person: transaction.extra_description || transaction.person || 'Nieznana',
                    // amount - kwota wydatku
                    amount: parseFloat(transaction.amount) || 0,
                    // date - data wydatku, używamy jej dokładnie tak jak przychodzi z backendu
                    date: transaction.date || new Date().toISOString().split('T')[0]
                };
                
                // Dodajemy log, aby zobaczyć wartość extra_description
                console.log(`Wydatek ID ${transaction.id}: extra_description = "${transaction.extra_description}", person = "${transaction.person}"`);
                
                console.log("Data wydatku przed formatowaniem:", transaction.date);
                
                // Jeśli data jest już w formacie DD.MM.YYYY, zachowujemy ją bez zmian
                if (typeof transaction.date === 'string' && !transaction.date.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
                    // Zastosujmy formatowanie daty tylko jeśli nie jest już w formacie DD.MM.YYYY
                    expenseObj.date = formatDate(transaction.date);
                    console.log("Data wydatku po formatowaniu:", expenseObj.date);
                }
                
                console.log('Dodaję wydatek do listy:', JSON.stringify(expenseObj, null, 2));
                expensesList.push(expenseObj);
            } else if (isSettlement || transaction.type === 'transfer' || transaction.type === 'income') {
                // Wyodrębnij nazwę źródłowego konta dla wpływu
                let source = 'Nieznane';
                let destination = transaction.destination;
                
                // Próba pobrania nazwy źródłowego konta
                if (transaction.source_account_name) {
                    source = transaction.source_account_name;
                } else if (transaction.description && transaction.description.startsWith('Wpływ z: ')) {
                    source = transaction.description.replace('Wpływ z: ', '');
                } else if (transaction.source) {
                    source = transaction.source;
                }

                if (isSettlement) {
                    // Ustaw jako rozliczenie na osobę – osoba w extra_description lub w opisie po ":"
                    const person = transaction.extra_description || (transaction.description.split(':')[1] || '').trim();
                    destination = person || 'Nieznana';
                }
                
                // Dodajemy pełne informacje o transferze
                const rawAmount = transaction.amount !== undefined ? transaction.amount : transaction.cost;
                const parsedAmount = parseFloat(rawAmount);
                console.log('Transfer amount raw/parsed:', rawAmount, parsedAmount, 'transaction.id=', transaction.id);
                transfersList.push({
                    id: transaction.id,
                    type: isSettlement ? 'expense' : transaction.type,
                    source: source,
                    source_account_id: transaction.source_account_id,
                    source_account_name: transaction.source_account_name,
                    destination: destination,
                    description: transaction.description,
                    amount: !isNaN(parsedAmount) ? parsedAmount : 0,
                    date: transaction.date
                });
            }
        });
        
        // Obliczenie sald (to powinna robić strona serwerowa, ale dodajemy na wszelki wypadek)
    let gabiWG = 0; // suma wydatków Gabi
    let norfWG = 0; // suma wydatków Norf
    let gabiRG = 0; // suma rozliczeń Gabi
    let norfRN = 0; // suma rozliczeń Norf
    let sumIncomes = 0;  // W – suma wpływów (income) na KWNR
    let sumSettlements = 0; // R – suma rozliczeń (settlements) "Rozliczenie:"
        
        expensesList.forEach(expense => {
            const amount = parseFloat(expense.amount);
            if (!isNaN(amount)) {
                if (expense.person === 'Gabi') {
                    gabiWG += amount;
                } else if (expense.person === 'Norf') {
                    norfWG += amount;
                }
            }
        });
        // Sumuj wszystkie wpływy (income) oraz rozliczenia
        transfersList.forEach(tr => {
            const amount = parseFloat(tr.amount);
            if (!isNaN(amount) && tr.type === 'income') sumIncomes += amount; // W
            // Rozliczenia (transfer.type === 'expense') – przypisz do osoby wg kolumny Skąd/Dokąd
            if (!isNaN(amount) && tr.type === 'expense') {
                // Kolumna Skąd/Dokąd w obecnym kodzie pokazuje 'source'; dla rozliczenia powinniśmy użyć destination jeśli istnieje
                const who = tr.destination || tr.source;
                if (who === 'Gabi') gabiRG += amount;
                if (who === 'Norf') norfRN += amount;
                sumSettlements += amount; // R
            }
        });
        
        setExpenses(expensesList);
        setTransfers(transfersList);
        // Oblicz salda: S = -W + R
        const gabiS = -gabiWG + gabiRG;
        const norfS = -norfWG + norfRN;
        setGabiBalance(gabiS);
        setNorfBalance(norfS);
        const ds = sumIncomes - sumSettlements; // DS = W - R
        setAvailableFunds(ds);
        // Zapisz wyliczenia dla innych komponentów (np. Główne Statystyki)
        try {
            const derived = { SG: gabiS, SN: norfS, DS: ds, SC: gabiS + norfS + ds, timestamp: Date.now() };
            sessionStorage.setItem('kwnrDerived', JSON.stringify(derived));
        } catch { /* ignore */ }
    }, [transactions, currentBalance]);

    // Obsługa rozpoczęcia rozliczenia
    const startSettlement = (person) => {
        setSettleTarget(person);
        // Deficyt = ujemne saldo * -1, inaczej 0
        const saldo = person === 'Gabi' ? gabiBalance : norfBalance;
        const deficit = saldo < 0 ? -saldo : 0;
        const suggested = Math.min(deficit, availableFunds);
        setSettleAmount(suggested > 0 ? suggested.toFixed(2) : '');
        setSettleDate(new Date().toISOString().split('T')[0]);
        setSettleError('');
    };

    const cancelSettlement = () => {
        setSettleTarget(null);
        setSettleAmount('');
        setSettleError('');
    };

    const handleSettleAmountChange = (e) => {
        const v = e.target.value.replace(/[^0-9.,]/g,'').replace(',','.');
        setSettleAmount(v);
        setSettleError('');
    };

    const saveSettlement = async () => {
        if (!settleTarget) return;
        const amountNum = parseFloat(settleAmount);
        if (isNaN(amountNum) || amountNum <= 0) { setSettleError('Podaj prawidłową kwotę'); return; }
        if (amountNum > availableFunds) { setSettleError('Kwota przekracza dostępne środki'); return; }
        if (!settleDate) { setSettleError('Wybierz datę'); return; }
        try {
            setIsLoading(true);
            const payload = [{
                flowType: 'expense',
                data: {
                    account: 'KWNR',
                    cost: amountNum.toString(),
                    date: settleDate,
                    mainCategory: 'Wydatek KWNR', // używamy tej samej kategorii; odróżniamy po opisie
                    description: `Rozliczenie: ${settleTarget}`,
                    extra_description: settleTarget,
                    isKwnrExpense: true,
                    person: settleTarget
                }
            }];
            const resp = await fetch('http://localhost:3001/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(txt || 'Błąd zapisu rozliczenia');
            }
            cancelSettlement();
            setTimeout(()=>fetchKwnrData(),400);
        } catch(err){
            console.error('Błąd zapisu rozliczenia', err);
            setSettleError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- OBSŁUGA EDYCJI / USUWANIA TRANSFERÓW ---
    const handleEditTransfer = (transfer) => {
        const isSettlement = transfer.type === 'expense';
        setEditTransfer({
            id: transfer.id,
            isSettlement,
            person: isSettlement ? (transfer.destination || (transfer.description.split(':')[1]||'').trim()) : '',
            amount: transfer.amount.toFixed(2),
            date: (typeof transfer.date === 'string' && transfer.date.includes('.')) ? transfer.date.split('.').reverse().join('-') : (transfer.date?.split('T')[0] || transfer.date),
            description: transfer.description,
            originalDescription: transfer.description
        });
        setIsEditTransferModalOpen(true);
    };

    const handleDeleteTransfer = async (transfer) => {
        if (!transfer?.id) return;
        if (!window.confirm('Usunąć ten transfer?')) return;
        try {
            setIsLoading(true);
            const resp = await fetch('http://localhost:3001/api/expenses/delete', {
                method: 'POST',
                headers: { 'Content-Type':'application/json' },
                body: JSON.stringify({ id: transfer.id })
            });
            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(txt || 'Błąd usuwania');
            }
            setTimeout(()=>fetchKwnrData(),300);
        } catch(err){
            alert('Błąd usuwania transferu: '+err.message);
        } finally { setIsLoading(false);}        
    };

    const handleSaveEditedTransfer = async () => {
        if (!editTransfer) return;
        const amt = parseFloat(editTransfer.amount);
        if (isNaN(amt) || amt<=0) { alert('Kwota nieprawidłowa'); return; }
        const date = editTransfer.date;
        try {
            setIsLoading(true);
            let payload;
            if (editTransfer.isSettlement) {
                // traktowane jako expense na KWNR
                payload = {
                    original: {
                        id: editTransfer.id,
                        account: 'KWNR',
                        description: editTransfer.originalDescription,
                        extra_description: editTransfer.person
                    },
                    updated: {
                        account: 'KWNR',
                        cost: amt.toString(),
                        date,
                        mainCategory: 'Wydatek KWNR',
                        description: `Rozliczenie: ${editTransfer.person}`,
                        extra_description: editTransfer.person,
                        isKwnrExpense: true,
                        person: editTransfer.person
                    }
                };
            } else {
                // income
                payload = {
                    original: { id: editTransfer.id, account: 'KWNR', description: editTransfer.originalDescription },
                    updated: { account: 'KWNR', amount: amt.toString(), date, description: editTransfer.originalDescription }
                };
            }
            const resp = await fetch('http://localhost:3001/api/expenses', {
                method: 'PUT',
                headers: { 'Content-Type':'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(txt || 'Błąd aktualizacji');
            }
            setIsEditTransferModalOpen(false);
            setEditTransfer(null);
            setTimeout(()=>fetchKwnrData(),400);
        } catch(err){
            alert('Błąd aktualizacji transferu: '+err.message);
        } finally { setIsLoading(false);}        
    };

    return (
        <div className="kwnr-account-container">
            <div className="kwnr-section balances-section">
                <div className="section-header">
                    <h3>Saldo</h3>
                </div>
                {/* Usunięto szczegóły W/R/DS - pozostaje jedynie wyświetlanie dostępnych środków w nagłówku sekcji tabeli */}
                <div className="balance-cards">
                    <div className="balance-card gabi">
                        <div className="person">Gabi (SG)</div>
                        <div className="amount">{formatCurrency(gabiBalance)}</div>
                        <button className="settle-btn" disabled={isLoading || Math.abs(gabiBalance) < 0.005} onClick={()=>startSettlement('Gabi')}>Rozlicz</button>
                    </div>
                    <div className="balance-card norf">
                        <div className="person">Norf (SN)</div>
                        <div className="amount">{formatCurrency(norfBalance)}</div>
                        <button className="settle-btn" disabled={isLoading || Math.abs(norfBalance) < 0.005} onClick={()=>startSettlement('Norf')}>Rozlicz</button>
                    </div>
                    <div className="balance-card total">
                        <div className="person">Saldo całkowite (SC)</div>
                        <div className="amount">{formatCurrency(gabiBalance + norfBalance + availableFunds)}</div>
                    </div>
                </div>
            </div>

            {settleTarget && (
                <div className="settlement-form" style={{marginTop:'12px', border:'1px solid #ddd', padding:'12px', borderRadius:6}}>
                    <h4>Rozliczenie – {settleTarget}</h4>
                    <div style={{display:'flex', gap:'12px', flexWrap:'wrap'}}>
                        <div>
                            <label>Kwota:&nbsp;
                                <input type="text" value={settleAmount} onChange={handleSettleAmountChange} placeholder="0,00" style={{width:100}} />
                            </label>
                        </div>
                        <div>
                            <label>Data:&nbsp;
                                <input type="date" value={settleDate} onChange={e=>setSettleDate(e.target.value)} />
                            </label>
                        </div>
                        <div style={{display:'flex', gap:'8px'}}>
                            <button type="button" className="save-expense-btn" disabled={isLoading} onClick={saveSettlement}>{isLoading? 'Zapisywanie...' : 'Zapisz rozliczenie'}</button>
                            <button type="button" className="cancel-btn" onClick={cancelSettlement}>Anuluj</button>
                        </div>
                    </div>
                    {settleError && <div style={{color:'red', marginTop:8}}>{settleError}</div>}
                    <div style={{marginTop:6, fontSize:'0.85em', color:'#555'}}>Sugestia to deficyt (ujemne saldo) ograniczony do dostępnych środków. Maks: {formatCurrency(availableFunds)}</div>
                </div>
            )}

            <div className="kwnr-section expenses-section">
                <div className="section-header">
                    <h3>Wydatki</h3>
                    <div className="section-controls">
                        {isLoading && <div className="loading-spinner"></div>}
                        <button 
                            className="add-button"
                            onClick={() => setShowExpenseForm(!showExpenseForm)}
                            disabled={isLoading}
                        >
                            {showExpenseForm ? 'Anuluj' : 'Dodaj wydatek'}
                        </button>
                    </div>
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
                            <th>Data</th>
                            <th>Akcje</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.length > 0 ? (
                            expenses.map((expense) => {
                                console.log("Renderowanie wydatku:", expense);
                                return (
                                    <tr key={expense.id} className={expense.isDeleting ? 'deleting' : ''}>
                                        <td>{expense.name || expense.description || (expense.category ? expense.category.name : 'Wydatek')}</td>
                                        <td>
                                            {(() => {
                                                // Dodajemy debugowanie bezpośrednio w renderowaniu
                                                const personValue = expense.person || expense.extra_description || 'Nieznana';
                                                console.log(`Renderowanie wydatku ID ${expense.id}: person=${expense.person}, extra_description=${expense.extra_description}`);
                                                return personValue;
                                            })()}
                                        </td>
                                        <td className="amount-cell">{formatCurrency(expense.amount)}</td>
                                        <td>{formatDate(expense.date) || '-'}</td>
                                        <td className="action-cell">
                                            <button 
                                                className="icon-button edit-button" 
                                                title="Edytuj wydatek"
                                                onClick={() => handleEditExpense(expense)}
                                                disabled={isLoading || expense.isDeleting}
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                className="icon-button delete-button" 
                                                title="Usuń wydatek"
                                                onClick={() => handleDeleteExpense(expense)}
                                                disabled={isLoading || expense.isDeleting}
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="4" className="no-data">Brak zarejestrowanych wydatków</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="kwnr-section transfers-section">
                <div className="section-header">
                    <h3>Transfery</h3>
                    <div className="available-funds">
                        <span>Dostępne środki:</span> 
                        <span className="available-amount">{formatCurrency(availableFunds)}</span>
                    </div>
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
                            <th>Data</th>
                            <th>Wpływ/Rozliczenie</th>
                            <th>Skąd/Dokąd</th>
                            <th>Kwota</th>
                            <th>Akcje</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transfers.length > 0 ? (
                            transfers.map((transfer) => {
                                const isSettlement = transfer.type === 'expense' && transfer.description && transfer.description.startsWith('Rozliczenie:');
                                const personFromDesc = isSettlement ? (transfer.destination || (transfer.description.split(':')[1] || '').trim()) : null;
                                const displaySource = isSettlement
                                    ? (personFromDesc || 'Nieznane')
                                    : (transfer.source_account_name || (transfer.description && transfer.description.replace('Wpływ z: ', '')) || transfer.source || 'Nieznane');
                                return (
                                    <tr key={transfer.id}>
                                        <td>{formatDate(transfer.date)}</td>
                                        <td>{transfer.type === 'income' ? 'Wpływ' : (isSettlement ? 'Rozliczenie' : (transfer.type === 'expense' ? 'Rozliczenie' : transfer.type))}</td>
                                        <td>{displaySource}</td>
                                        <td className="amount-cell">{formatCurrency(transfer.amount)}</td>
                                        <td className="action-cell">
                                            <button className="icon-button edit-button" title="Edytuj" disabled={isLoading} onClick={()=>handleEditTransfer(transfer)}>✏️</button>
                                            <button className="icon-button delete-button" title="Usuń" disabled={isLoading} onClick={()=>handleDeleteTransfer(transfer)}>🗑️</button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="5" className="no-data">Brak zarejestrowanych transferów</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Modal do edycji wydatku - będzie zaimplementowany w przyszłości */}
            {isEditModalOpen && editExpense && (
                <div className="modal">
                    <div className="modal-content">
                        <span className="close" onClick={() => setIsEditModalOpen(false)}>&times;</span>
                        <h2>Edytuj wydatek</h2>
                        <form className="expense-form edit-form">
                            <div className="form-section">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit-expense-name">Za co:</label>
                                        <input
                                            id="edit-expense-name"
                                            type="text"
                                            name="name"
                                            value={editExpense.name || editExpense.description || ''}
                                            onChange={(e) => setEditExpense({...editExpense, name: e.target.value})}
                                            placeholder="Opisz wydatek"
                                            required
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="edit-expense-person">Kto:</label>
                                        <select
                                            id="edit-expense-person"
                                            name="person"
                                            value={editExpense.person || editExpense.extra_description || 'Gabi'}
                                            onChange={(e) => setEditExpense({...editExpense, person: e.target.value})}
                                            required
                                        >
                                            <option value="Gabi">Gabi</option>
                                            <option value="Norf">Norf</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="edit-expense-amount">Kwota:</label>
                                        <input
                                            id="edit-expense-amount"
                                            type="text"
                                            name="amount"
                                            value={editExpense.amount || ''}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                                                setEditExpense({...editExpense, amount: value})
                                            }}
                                            placeholder="0,00"
                                            required
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label htmlFor="edit-expense-date">Data:</label>
                                        <input
                                            id="edit-expense-date"
                                            type="date"
                                            name="date"
                                            value={editExpense.date || new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setEditExpense({...editExpense, date: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Podgląd szczegółów</h3>
                                <div className="expense-details">
                                    <div className="detail-item">
                                        <span className="detail-label">ID transakcji:</span>
                                        <span className="detail-value">{editExpense.id}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Data dodania:</span>
                                        <span className="detail-value">{formatDate(editExpense.date)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="form-actions">
                                <button 
                                    type="button" 
                                    className="save-expense-btn"
                                    onClick={handleSaveEditedExpense}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Zapisywanie...' : 'Zapisz zmiany'}
                                </button>
                                <button 
                                    type="button" 
                                    className="cancel-btn"
                                    onClick={() => setIsEditModalOpen(false)}
                                    disabled={isLoading}
                                >
                                    Anuluj
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {isEditTransferModalOpen && editTransfer && (
                <div className="modal">
                    <div className="modal-content" style={{maxWidth:'520px', width:'100%', height:'auto'}}>
                        <span className="close" onClick={()=>{setIsEditTransferModalOpen(false); setEditTransfer(null);}}>&times;</span>
                        <h2>Edytuj {editTransfer.isSettlement ? 'rozliczenie' : 'wpływ'}</h2>
                        <div style={{display:'flex', flexDirection:'column', gap:16}}>
                            {editTransfer.isSettlement && (
                                <div className="form-group">
                                    <label>Osoba</label>
                                    <select value={editTransfer.person} onChange={e=>setEditTransfer({...editTransfer, person:e.target.value, description:`Rozliczenie: ${e.target.value}`})}>
                                        <option value="Gabi">Gabi</option>
                                        <option value="Norf">Norf</option>
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label>Kwota</label>
                                <input type="text" value={editTransfer.amount} onChange={e=>setEditTransfer({...editTransfer, amount:e.target.value.replace(/[^0-9.,]/g,'').replace(',','.')})} />
                            </div>
                            <div className="form-group">
                                <label>Data</label>
                                <input type="date" value={editTransfer.date} onChange={e=>setEditTransfer({...editTransfer, date:e.target.value})} />
                            </div>
                            <div className="form-actions" style={{justifyContent:'flex-end'}}>
                                <button type="button" className="save-expense-btn" disabled={isLoading} onClick={handleSaveEditedTransfer}>{isLoading? 'Zapisywanie...' : 'Zapisz'}</button>
                                <button type="button" className="cancel-btn" onClick={()=>{setIsEditTransferModalOpen(false); setEditTransfer(null);}}>Anuluj</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default KwnrAccountView;
