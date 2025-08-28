import React, { useState, useEffect, useRef } from 'react';
import './BillsTable.css';

function BillsTable({ transactions = [], currentBalance = null, selectedMonthId }) {
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
    const [accountBalance, setAccountBalance] = useState(1208.06); // Wartość początkowa salda konta
    const [monthOpening, setMonthOpening] = useState(null);
    const [deductions, setDeductions] = useState([]);
    const [deductionsBreakdown, setDeductionsBreakdown] = useState({}); // { [deductionId]: { items: [{name, amount}], sum } }
    const [newBill, setNewBill] = useState({ name: '', recipient: '', amount: '', isRecurring: false });
    const [showAddForm, setShowAddForm] = useState(false);
    const firstRender = useRef(true); // Ref do śledzenia pierwszego renderowania (nie będzie używany do skip)
    const [isMonthClosed, setIsMonthClosed] = useState(false);

    // Ładowanie danych z localStorage przy montowaniu komponentu
    useEffect(() => {
        console.log('BillsTable - inicjalizacja komponentu');
        
        // Dane początkowe dla stałych płatności
        const initialBills = [
            { id: 1, name: 'Gaz', recipient: 'PGNiG', amount: '' }, // Puste pole do uzupełnienia
            { id: 2, name: 'Spotify', recipient: 'Norf', amount: '38' },
            { id: 3, name: 'Czynsz', recipient: 'Wspólnota', amount: '338.77' },
            { id: 4, name: 'Enel', recipient: 'Gabi', amount: '0' },
            { id: 5, name: 'Woda', recipient: 'Wodociągi', amount: '' }, // Puste pole do uzupełnienia
            { id: 6, name: 'Prąd', recipient: 'Tauron', amount: '200' },
        ];
        
        // Per-miesięczne przechowywanie rachunków: monthlyBills::<YYYY-MM>
    if (selectedMonthId) {
            const key = `monthlyBills::${selectedMonthId}`;
            const savedForMonth = localStorage.getItem(key);
            if (savedForMonth) {
                // Istnieje zapis dla tego miesiąca
                try { setBills(JSON.parse(savedForMonth)); } catch { setBills(initialBills); }
            } else {
                // Brak zapisu dla tego miesiąca – tworzymy nowy zestaw na bazie szablonu
                // Szablon: jeśli istnieje globalny 'monthlyBills' to go użyj, inaczej initialBills
                let template = initialBills;
                try {
                    const globalSaved = localStorage.getItem('monthlyBills');
                    if (globalSaved) template = JSON.parse(globalSaved);
                } catch { /* ignore */ }
                // Wyzeruj kwoty dla Gaz i Woda w nowym miesiącu
                const newForMonth = template.map(b =>
                    (b?.name === 'Gaz' || b?.name === 'Woda') ? { ...b, amount: '' } : { ...b }
                );
                setBills(newForMonth);
                localStorage.setItem(key, JSON.stringify(newForMonth));
            }
        } else {
            // Fallback: zachowanie jak dotychczas (gdy brak selectedMonthId)
            const savedBills = localStorage.getItem('monthlyBills');
            if (savedBills) {
                setBills(JSON.parse(savedBills));
            } else {
                setBills(initialBills);
            }
        }
        
            // Używaj wartości z props, jeśli jest dostępna, w przeciwnym razie pobierz z bazy danych
        if (currentBalance !== null) {
            // Jeśli mamy wartość przekazaną jako props, użyj jej jako źródła prawdy
            const balance = parseFloat((currentBalance ?? 1208.06));
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
                        const dbBalance = parseFloat((billsAccount.current_balance ?? 1208.06));
                        console.log(`Pobrano saldo konta Rachunki z bazy danych: ${dbBalance} zł`);
                        
                        setAccountBalance(dbBalance);
                        localStorage.setItem('billsAccountBalance', dbBalance.toString());
                    } else {
                        // Jeśli konto nie istnieje w bazie, użyj wartości domyślnej 300 zł
                        console.log('Nie znaleziono konta Rachunki w bazie danych, używam wartości domyślnej 1208,06 zł');
                        setAccountBalance(1208.06);
                        localStorage.setItem('billsAccountBalance', '1208.06');
                    }
                } catch (error) {
                    console.error('Błąd podczas pobierania salda konta z bazy danych:', error);
                    
                    // W przypadku błędu, spróbuj użyć lokalnego salda
                    const savedBalance = localStorage.getItem('billsAccountBalance');
                    if (savedBalance) {
                        setAccountBalance(parseFloat(savedBalance));
                    } else {
                        setAccountBalance(1208.06);
                    }
                }
            };
            
            fetchAccountBalance();
        }
        
    // Nie czyścimy śledzonych transferów na mount – zachowujemy stan między odświeżeniami

        // Pobierz stan miesięczny Rachunki
        if (selectedMonthId) {
            (async () => {
                try {
                    const r = await fetch(`http://localhost:3001/api/accounts/bills/${selectedMonthId}`);
                    if (r.ok) {
                        const js = await r.json();
                        setMonthOpening(js.openingBalance ?? null);
                        setDeductions(js.deductions || []);
                    } else {
                        setMonthOpening(null);
                        setDeductions([]);
                    }
                } catch (e) {
                    console.error('Błąd pobierania stanu Rachunki miesiąca:', e);
                }
            })();
            // Pobierz status miesiąca (zamknięty/otwarty)
            (async () => {
                try {
                    const mr = await fetch(`http://localhost:3001/api/months/${selectedMonthId}`);
                    if (mr.ok) {
                        const m = await mr.json();
                        setIsMonthClosed(!!m.is_closed);
                    } else {
                        setIsMonthClosed(false);
                    }
                } catch (e) {
                    console.warn('Nie udało się pobrać statusu miesiąca:', e);
                    setIsMonthClosed(false);
                }
            })();
            // Wczytaj rozbicia odjęć dla tego miesiąca
            try {
                const key = `billsDeductionBreakdowns::${selectedMonthId}`;
                const saved = localStorage.getItem(key);
                if (saved) setDeductionsBreakdown(JSON.parse(saved)); else setDeductionsBreakdown({});
            } catch { setDeductionsBreakdown({}); }
        }
    }, [currentBalance, selectedMonthId]);
    
    // Śledź przetworzone transfery i aktualizuj saldo konta
    useEffect(() => {
        // Przetwarzamy także przy pierwszym renderze – stan śledzonych transferów trzymamy w localStorage
        if (firstRender.current) {
            firstRender.current = false;
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
            if (selectedMonthId) {
                const key = `monthlyBills::${selectedMonthId}`;
                localStorage.setItem(key, JSON.stringify(bills));
            } else {
                // Fallback do starego klucza jeśli nie mamy monthId
                localStorage.setItem('monthlyBills', JSON.stringify(bills));
            }
        }
    }, [bills, selectedMonthId]);

    // Funkcja do rozpoczęcia edycji kwoty
    const handleEditAmount = async (bill) => {
        // Wymuś otwarcie miesiąca przed edycją pozycji
        const ok = await ensureMonthOpen();
        if (!ok) return;
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

    // Normalizacja kwot (obsługa przecinka jako separatora dziesiętnego)
    const toNumber = (v) => {
        if (v === null || v === undefined) return 0;
        const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
        return isFinite(n) ? n : 0;
    };

    // Wpływy na konto Rachunki w wybranym miesiącu (sumujemy wpływy oraz transfery przychodzące na Rachunki)
    const monthInflows = (() => {
        if (!Array.isArray(transactions) || !selectedMonthId) return { count: 0, sum: 0 };
        const isForMonth = (d) => typeof d === 'string' && d.startsWith(selectedMonthId);
        let count = 0; let sum = 0;
        for (const t of transactions) {
            if (!t || !isForMonth(t.date)) continue;
            if (t.type === 'income') {
                // Wpływ na konto Rachunki
                const amt = Number(t.cost || t.amount || 0);
                if (isFinite(amt) && amt > 0) { count++; sum += amt; }
            } else if (t.type === 'transfer') {
                // Transfer przychodzący na Rachunki
                const toRachunki = (t.description && t.description.includes('Transfer do: Rachunki')) || t.toAccount === 'Rachunki';
                if (toRachunki) {
                    const amt = Number(t.cost || t.amount || 0);
                    if (isFinite(amt) && amt > 0) { count++; sum += amt; }
                }
            }
        }
        return { count, sum };
    })();

    // Funkcja do obliczania sumy wszystkich opłaconych rachunków
    const calculateTotal = () => {
        return bills
            .filter(bill => bill.amount && String(bill.amount).trim() !== '')
            .reduce((total, bill) => total + toNumber(bill.amount), 0);
    };
    
    // Funkcja do odejmowania rachunków od salda
    const ensureMonthOpen = async () => {
        if (!selectedMonthId) return false;
        if (!isMonthClosed) return true;
        const cont = window.confirm(`Miesiąc ${selectedMonthId} jest zamknięty. Czy chcesz go otworzyć, aby wprowadzić zmiany w Rachunkach?`);
        if (!cont) return false;
        try {
            const rr = await fetch(`http://localhost:3001/api/months/${selectedMonthId}/reopen`, { method: 'POST' });
            if (rr.ok) {
                setIsMonthClosed(false);
                return true;
            }
        } catch (e) { console.error('Błąd otwierania miesiąca:', e); }
        alert('Nie udało się otworzyć miesiąca. Operacja przerwana.');
        return false;
    };

    const deductBillsFromBalance = async () => {
        const totalBills = calculateTotal();
        if (!selectedMonthId) {
            alert('Brak wybranego miesiąca.');
            return;
        }
        // Walidacja zamkniętego miesiąca
        const ok = await ensureMonthOpen();
        if (!ok) return;
        try {
            const resp = await fetch(`http://localhost:3001/api/accounts/bills/${selectedMonthId}/deduct`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: totalBills })
            });
            if (!resp.ok) throw new Error('Nie udało się zapisać odjęcia');
            const saved = await resp.json();
            setDeductions(prev => [...prev, saved]);
            // Zapisz rozbicie odjęcia (snapshot aktualnych pozycji rachunków z kwotą)
            const breakdownItems = bills
                .filter(b => b && b.amount && String(b.amount).trim() !== '' && toNumber(b.amount) > 0)
                .map(b => ({ name: b.name, amount: toNumber(b.amount) }));
            const breakdownSum = breakdownItems.reduce((s, it) => s + toNumber(it.amount), 0);
            setDeductionsBreakdown(prev => {
                const next = { ...prev, [saved.id]: { items: breakdownItems, sum: breakdownSum } };
                try {
                    const key = `billsDeductionBreakdowns::${selectedMonthId}`;
                    localStorage.setItem(key, JSON.stringify(next));
                } catch (err) { console.warn('Nie udało się zapisać breakdownu odjęcia', err); }
                return next;
            });
            let newBalance = accountBalance - totalBills;
            if (newBalance < 0) newBalance = 0;
            setAccountBalance(newBalance);
            localStorage.setItem('billsAccountBalance', newBalance.toString());
            updateAccountBalanceInDatabase(newBalance);
            alert(`Odliczono ${totalBills} zł z salda konta. Nowe saldo: ${newBalance.toFixed(2)} zł`);
        } catch (e) {
            console.error(e);
            alert('Wystąpił błąd podczas zapisywania odjęcia.');
        }
    };

    const showDeductionBreakdown = (dedId, fallbackSum) => {
        const bd = deductionsBreakdown[dedId];
        let itemsToShow;
        let sumToShow;
        if (!bd || !bd.items || !bd.items.length) {
            // Fallback: zbuduj rozbicie z aktualnych pozycji rachunków (z obsługą przecinka)
            const fallbackItems = bills
                .filter(b => b && b.amount && String(b.amount).trim() !== '' && toNumber(b.amount) > 0)
                .map(b => ({ name: b.name, amount: toNumber(b.amount) }));
            itemsToShow = fallbackItems;
            sumToShow = typeof fallbackSum === 'number' ? fallbackSum : fallbackItems.reduce((s, it) => s + toNumber(it.amount), 0);
        } else {
            itemsToShow = bd.items;
            sumToShow = bd.sum;
        }
        if (!itemsToShow || !itemsToShow.length) {
            alert(`Suma: ${formatCurrency(sumToShow)}`);
            return;
        }
        const lines = itemsToShow
            .filter(it => isFinite(Number(it.amount)) && Number(it.amount) > 0)
            .map(it => `• ${it.name}: ${formatCurrency(it.amount)}`);
        const text = `Składniki odjęcia:\n${lines.join('\n')}\n\nSuma: ${formatCurrency(sumToShow)}`;
        alert(text);
    };

    const handleSaveOpening = async () => {
        if (!selectedMonthId) return;
        // Walidacja zamkniętego miesiąca
        const ok = await ensureMonthOpen();
        if (!ok) return;
        const val = prompt('Podaj saldo początkowe dla tego miesiąca (np. 1208,06):', monthOpening ?? '');
        if (val === null) return;
        const parsed = parseFloat(String(val).replace(',', '.'));
        if (!isFinite(parsed) || parsed < 0) { alert('Nieprawidłowa kwota.'); return; }
        try {
            const resp = await fetch(`http://localhost:3001/api/accounts/bills/${selectedMonthId}/opening`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openingBalance: parsed })
            });
            if (!resp.ok) throw new Error('Nie udało się zapisać salda początkowego');
            setMonthOpening(parsed);
            alert('Zapisano saldo początkowe dla miesiąca.');
        } catch (e) { console.error(e); alert('Błąd zapisu salda początkowego.'); }
    };
    
    // Funkcja do resetowania salda do wartości początkowej
    const resetBalance = async () => {
        // Walidacja zamkniętego miesiąca
        const ok = await ensureMonthOpen();
        if (!ok) return;
        // Reset do miesięcznego salda otwarcia jeśli jest, inaczej do 1208.06
        const initialBalance = (monthOpening != null ? Number(monthOpening) : 1208.06);
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
                    className="action-button" 
                    onClick={handleSaveOpening}
                    title="Ustaw saldo początkowe dla miesiąca"
                >
                    🧭
                </button>
                <button 
                    className="action-button" 
                    onClick={async () => { const ok = await ensureMonthOpen(); if (ok) setShowAddForm(v => !v); }}
                    title="Dodaj rachunek"
                >
                    ➕
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
            
            {/* Informacje o miesiącu: saldo początkowe i lista odjęć */}
            {selectedMonthId && (
                <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <div>Saldo początkowe miesiąca {selectedMonthId}: {monthOpening != null ? formatCurrency(monthOpening) : '—'} (możesz zmienić przyciskiem 🧭)</div>
                    <div>Wpływy na konto w {selectedMonthId}: {formatCurrency(monthInflows.sum)}{monthInflows.count ? ` (liczba: ${monthInflows.count})` : ''}</div>
                    {deductions.length > 0 ? (
                        (() => {
                            // Pokaż tylko jeden (najnowszy) komunikat o odjęciu
                            const latest = deductions.reduce((acc, cur) => {
                                const accDate = acc ? new Date(acc.deducted_on) : null;
                                const curDate = cur ? new Date(cur.deducted_on) : null;
                                if (!acc) return cur;
                                if (!accDate || !curDate) return cur; // fallback
                                return curDate > accDate ? cur : acc;
                            }, null);
                            if (!latest) return null;
                            return (
                                <div>
                                    Odjęcia:
                                    <ul>
                                        <li key={latest.id}>
                                            odjęto <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => showDeductionBreakdown(latest.id, latest.amount)}>{formatCurrency(latest.amount)}</span> – dnia {new Date(latest.deducted_on).toLocaleDateString('pl-PL')}
                                        </li>
                                    </ul>
                                </div>
                            );
                        })()
                    ) : (
                        <div>Brak odjęć w tym miesiącu.</div>
                    )}
                </div>
            )}

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
            {/* Formularz dodawania rachunku do miesiąca (pokazywany po kliknięciu w ➕) */}
            {selectedMonthId && showAddForm && (
                <div style={{ marginTop: '1rem', padding: '0.5rem', border: '1px solid #ddd', borderRadius: 6 }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Dodaj rachunek</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                            placeholder="Za co"
                            value={newBill.name}
                            onChange={e => setNewBill(s => ({ ...s, name: e.target.value }))}
                            style={{ padding: '0.3rem 0.4rem' }}
                        />
                        <input
                            placeholder="Komu"
                            value={newBill.recipient}
                            onChange={e => setNewBill(s => ({ ...s, recipient: e.target.value }))}
                            style={{ padding: '0.3rem 0.4rem' }}
                        />
                        <input
                            placeholder="Kwota"
                            inputMode="decimal"
                            value={newBill.amount}
                            onChange={e => setNewBill(s => ({ ...s, amount: e.target.value }))}
                            style={{ width: 100, padding: '0.3rem 0.4rem' }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="checkbox" checked={newBill.isRecurring} onChange={e => setNewBill(s => ({ ...s, isRecurring: e.target.checked }))} />
                            Stały rachunek
                        </label>
                        <button onClick={async () => {
                            // Walidacja zamkniętego miesiąca przed dodaniem
                            const ok = await ensureMonthOpen();
                            if (!ok) return;
                            const name = newBill.name.trim();
                            const amount = parseFloat(String(newBill.amount).replace(',', '.'));
                            if (!name || !isFinite(amount) || amount < 0) { alert('Uzupełnij poprawnie pola Za co i Kwota'); return; }
                            try {
                                const resp = await fetch(`http://localhost:3001/api/accounts/bills/${selectedMonthId}/items`, {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ name, recipient: newBill.recipient.trim() || null, amount, isRecurring: newBill.isRecurring })
                                });
                                const js = await resp.json().catch(()=>({}));
                                if (!resp.ok) throw new Error(js.message || 'Błąd zapisu');
                                setNewBill({ name: '', recipient: '', amount: '', isRecurring: false });
                            } catch (e) { alert(e.message); }
                        }}>Dodaj</button>
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                        - Jednorazowy: tylko w tym miesiącu. Stały: pojawi się automatycznie w kolejnych miesiącach.
                    </div>
                </div>
            )}
        </div>
    );
}

export default BillsTable;
