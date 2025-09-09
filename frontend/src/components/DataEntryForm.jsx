import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import ShoppingBreakdownForm from './ShoppingBreakdownForm';

// -- Komponenty pomocnicze --

const ExpenseFields = ({ onBreakdownChange, mainCategory, setMainCategory, shoppingBreakdown, onAccountChange, onBalanceOptionChange, userAddedCategories = [] }) => {
    const [isShoppingModalOpen, setIsShoppingModalOpen] = useState(false);
    const [totalCost, setTotalCost] = useState('');
    const [account, setAccount] = useState('Wspólne');
    const [balanceOption, setBalanceOption] = useState('budget_increase');
    
    // Reset pól specyficznych dla kategorii przy zmianie kategorii głównej
    useEffect(() => {
        if (mainCategory !== 'zakupy codzienne') {
            setTotalCost('');
        }
    }, [mainCategory]);
    
    // Stałe, zdefiniowane od początku kategorie
    const baseCategories = useMemo(() => [ 
        'zakupy codzienne', 'auta', 'dom', 'wyjścia i szama do domu', 'pies', 'prezenty', 'wyjazdy'
    ], []);
    
    // Pobierz nazwy wyświetlania dla kategorii
    const [categoryDisplayNames, setCategoryDisplayNames] = useState(() => {
        try {
            const savedNames = localStorage.getItem('categoryDisplayNames');
            return savedNames ? JSON.parse(savedNames) : {};
        } catch (e) {
            console.error('Błąd wczytywania nazw kategorii z localStorage:', e);
            return {};
        }
    });
    
    // Aktualizuj nazwy kategorii gdy localStorage się zmieni lub zostanie wyemitowane zdarzenie zmiany nazw
    useEffect(() => {
        const handleStorageChange = () => {
            try {
                const savedNames = localStorage.getItem('categoryDisplayNames');
                if (savedNames) {
                    setCategoryDisplayNames(JSON.parse(savedNames));
                }
            } catch (e) {
                console.error('Błąd przy aktualizacji nazw kategorii:', e);
            }
        };
        
        const handleCategoryNamesChanged = (event) => {
            if (event.detail && event.detail.updatedNames) {
                setCategoryDisplayNames(event.detail.updatedNames);
            } else {
                handleStorageChange(); // Awaryjnie wczytaj z localStorage
            }
        };
        
        // Nasłuchuj zmiany w localStorage (między kartami) oraz customowego zdarzenia (w tej samej karcie)
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('categoryNamesChanged', handleCategoryNamesChanged);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('categoryNamesChanged', handleCategoryNamesChanged);
        };
    }, []);
    
    // Łączymy bazowe kategorie z tymi dodanymi przez użytkownika
    const expenseCategories = useMemo(() => {
        // Sprawdź również czy kategoria istnieje w głównym rejestrze kategorii
        const mainCategories = JSON.parse(localStorage.getItem('usedMainCategories') || '[]');
        // Filtruj kategorie użytkownika, aby uwzględnić tylko te, które są w głównym rejestrze
        const activeUserCategories = userAddedCategories.filter(cat => 
            mainCategories.includes(cat)
        );
        return [...baseCategories, ...activeUserCategories];
    }, [baseCategories, userAddedCategories]);
    
    // Wywołaj funkcje zwrotne przy zmianie wartości
    useEffect(() => {
        if (onAccountChange) onAccountChange(account);
    }, [account, onAccountChange]);
    
    useEffect(() => {
        if (onBalanceOptionChange) onBalanceOptionChange(balanceOption);
        
        // Nie wyświetlamy alertu przy zmianie opcji
    }, [balanceOption, onBalanceOptionChange, account]);

    const handleBreakdownSave = (breakdown) => {
        onBreakdownChange(breakdown);
        setIsShoppingModalOpen(false);
    };
    
    // Nowy stan dla obsługi dodawania nowej kategorii
    const [isNewCategory, setIsNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    
    // Pokazujemy opcje tylko dla kont Gabi lub Norf
    const showBalanceOptions = account === 'Gabi' || account === 'Norf';

    return (
    <>
        <div className="form-group">
            <label htmlFor="mainCategory">Kategoria główna:</label>
            <select 
                id="mainCategory" 
                name="mainCategory" 
                required 
                value={mainCategory} 
                onChange={(e) => {
                    const value = e.target.value;
                    setMainCategory(value);
                    if (value === 'new') {
                        setIsNewCategory(true);
                    } else {
                        setIsNewCategory(false);
                        setNewCategoryName('');
                    }
                }}
            >
                <option value="">-- Wybierz kategorię --</option>
                {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>
                        {categoryDisplayNames[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                ))}
                <option value="new">+ Dodaj nową kategorię</option>
            </select>
        </div>
        
        {isNewCategory && (
            <div className="form-group">
                <label htmlFor="newCategoryName">Nazwa nowej kategorii:</label>
                <input 
                    type="text" 
                    id="newCategoryName" 
                    name="newCategoryName" 
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Wpisz nazwę nowej kategorii" 
                    required 
                />
            </div>
        )}

        {mainCategory === 'zakupy codzienne' ? (
            <div className="form-group">
                <label htmlFor="cost">Koszt całkowity zakupów:</label>
                <input 
                    type="number" 
                    id="cost" 
                    name="cost" 
                    step="0.01" 
                    placeholder="0,00" 
                    required 
                    value={totalCost} 
                    onChange={(e) => setTotalCost(e.target.value)} 
                />
                <button 
                    type="button" 
                    onClick={() => {
                        if (totalCost && parseFloat(totalCost) > 0) {
                            setIsShoppingModalOpen(true);
                        } else {
                            alert('Wprowadź prawidłową kwotę całkowitą zakupów!');
                        }
                    }} 
                    disabled={!totalCost || parseFloat(totalCost) <= 0} 
                    style={{marginTop: '10px'}}
                    className="breakdown-button"
                >
                    Rozbij paragon na podkategorie
                </button>
                {shoppingBreakdown && shoppingBreakdown.length > 0 && (
                    <div className="breakdown-summary">
                        <strong>Zapisano rozbicie:</strong>
                        <ul>
                            {shoppingBreakdown.map(item => (
                                <li key={item.description}>{item.description}: {item.cost} zł</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        ) : mainCategory ? (
            <>
                <div className="form-group"><label htmlFor="description">Opis:</label><input type="text" id="description" name="description" placeholder="Np. Ubezpieczenie OC/AC"/></div>
                <div className="form-group"><label htmlFor="cost">Koszt:</label><input type="number" id="cost" name="cost" step="0.01" placeholder="0,00" required/></div>
            </>
        ) : null}
        
                <div className="form-group">
                    <label htmlFor="account">Konto (obciążane):</label>
                    <select 
                        id="account" 
                        name="account" 
                        required 
                        value={account} 
                        onChange={(e) => setAccount(e.target.value)}
                    >
                        <option value="Wspólne">Wspólne</option>
                        <option value="Gotówka">Gotówka</option>
                        <option value="Oszczędnościowe">Oszczędnościowe</option>
                        <option value="Rachunki">Rachunki</option>
                        <option value="KWNR">KWNR</option>
                        <option value="Gabi">Gabi</option>
                        <option value="Norf">Norf</option>
                    </select>
                </div>
                
                {showBalanceOptions && (
                    <div className="form-group balance-options">
                        <label>Jak obsłużyć wydatek z konta {account}?</label>
                        <div className="balance-option-choices">
                            <label>
                                <input
                                    type="radio"
                                    name="balanceOption"
                                    value="budget_increase"
                                    checked={balanceOption === 'budget_increase'}
                                    onChange={() => setBalanceOption('budget_increase')}
                                    required
                                />
                                <span>Zwiększamy budżet</span>
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="balanceOption"
                                    value="balance_expense"
                                    checked={balanceOption === 'balance_expense'}
                                    onChange={() => setBalanceOption('balance_expense')}
                                />
                                <span>Bilansujemy wydatek</span>
                            </label>
                        </div>
                    </div>
                )}

        <Modal isOpen={isShoppingModalOpen} onClose={() => setIsShoppingModalOpen(false)} title="Rozbicie Paragonu">
            <ShoppingBreakdownForm 
                totalCost={parseFloat(totalCost) || 0} 
                onSave={handleBreakdownSave} 
                onCancel={() => setIsShoppingModalOpen(false)} 
            />
        </Modal>
    </>
    );
};

const IncomeFields = ({ incomeFrom, onFromChange, showAdvanceOption, advanceType, setAdvanceType }) => (
    <>
        <div className="form-group">
            <label htmlFor="toAccount">Na jakie konto?</label>
            <select id="toAccount" name="toAccount">
                <option value="Wspólne">Wspólne</option>
                <option value="Gotówka">Gotówka</option>
                <option value="Oszczędnościowe">Oszczędnościowe</option>
                <option value="Rachunki">Rachunki</option>
                <option value="KWNR">KWNR</option>
            </select>
        </div>
        <div className="form-group">
            <label htmlFor="from">Skąd?</label>
            <input type="text" id="from" name="from" list="suggestions" placeholder="Np. Gabi, Wypłata" value={incomeFrom} onChange={onFromChange} />
            <datalist id="suggestions">
                <option value="Gabi"/>
                <option value="Norf"/>
            </datalist>
        </div>
        <div className="form-group">
            <label htmlFor="amount">Kwota:</label>
            <input type="number" id="amount" name="amount" step="0.01" placeholder="0,00" required/>
        </div>
        {showAdvanceOption && (
            <div className="advance-type-group">
                <label>Czy podnosimy budżet tego miesiąca, czy to zaliczka z kolejnego?</label>
                <div className="advance-type-options">
                    <label>
                        <input
                            type="radio"
                            name="advanceType"
                            value="current"
                            checked={advanceType === 'current'}
                            onChange={() => setAdvanceType('current')}
                            required
                        />
                        <span>Podnosimy budżet tego miesiąca</span>
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="advanceType"
                            value="next"
                            checked={advanceType === 'next'}
                            onChange={() => setAdvanceType('next')}
                        />
                        <span>Zalicza się na kolejny miesiąc</span>
                    </label>
                </div>
            </div>
        )}
    </>
);

const TransferFields = () => {
    const [fromAccount, setFromAccount] = useState('Wspólne');
    const accountOptions = ['Wspólne', 'Gotówka', 'Oszczędnościowe', 'Rachunki', 'KWNR'];
    const defaultToAccount = accountOptions.find(acc => acc !== fromAccount);

    return (
        <>
            <div className="form-group">
                <label htmlFor="fromAccount">Skąd?</label>
                <select id="fromAccount" name="fromAccount" value={fromAccount} onChange={(e) => setFromAccount(e.target.value)}>
                    {accountOptions.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="toAccount">Dokąd?</label>
                <select id="toAccount" name="toAccount" defaultValue={defaultToAccount}>
                    {accountOptions.map(acc => (
                        <option key={acc} value={acc} disabled={acc === fromAccount}>
                            {acc}
                        </option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="amount">Kwota:</label>
                <input type="number" id="amount" name="amount" step="0.01" placeholder="0,00" required/></div>
        </>
    );
};


// -- Główny komponent formularza --

function DataEntryForm({ onNewEntry, selectedMonthId, isMonthClosed, onRefresh, onAddMonth, onToggleMonthLock }) {
    // informacyjne propsy dostępne niżej (blokada realizowana w części renderowania na dole)
  const [flowType, setFlowType] = useState('expense');
  const [mainCategory, setMainCategory] = useState('');
  const [responseMessage, setResponseMessage] = useState({ text: '', type: '' });
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shoppingBreakdown, setShoppingBreakdown] = useState(null);
  
  // Zresetuj rozbicie paragonu przy zmianie kategorii głównej
  useEffect(() => {
    if (mainCategory !== 'zakupy codzienne') {
      setShoppingBreakdown(null);
    }
  }, [mainCategory]);
  
  // Stan dla przechowywania kategorii dodanych przez użytkownika
  const [userAddedCategories, setUserAddedCategories] = useState(() => {
    try {
      // Próbujemy wczytać dodane kategorie z localStorage
      const saved = localStorage.getItem('userAddedCategories');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Błąd podczas wczytywania kategorii z localStorage:', e);
      return [];
    }
  });
  
  // Nasłuchuj zdarzenia usunięcia kategorii
  useEffect(() => {
    const handleCategoryDeleted = (event) => {
      if (event.detail && event.detail.updatedCategories) {
        setUserAddedCategories(event.detail.updatedCategories);
      } else {
        // Awaryjnie odczytaj z localStorage
        try {
          const saved = localStorage.getItem('userAddedCategories');
          if (saved) {
            setUserAddedCategories(JSON.parse(saved));
          }
        } catch (e) {
          console.error('Błąd przy aktualizacji kategorii użytkownika:', e);
        }
      }
    };
    
    window.addEventListener('categoryDeleted', handleCategoryDeleted);
    return () => window.removeEventListener('categoryDeleted', handleCategoryDeleted);
  }, []);

  // Nowe stany do obsługi wpływu od Gabi/Norf
  const [incomeFrom, setIncomeFrom] = useState('');
  const [advanceType, setAdvanceType] = useState('current');
  
  // Nowe stany do obsługi wydatków z konta Gabi/Norf
  const [balanceOption, setBalanceOption] = useState('budget_increase');

  // Pokazujemy pytanie tylko jeśli wybrano Gabi lub Norf
  const showAdvanceOption = flowType === 'income' && (incomeFrom.trim().toLowerCase() === 'gabi' || incomeFrom.trim().toLowerCase() === 'norf');

  const handleIncomeFromChange = (e) => {
    setIncomeFrom(e.target.value);
    setAdvanceType('current'); // resetuj wybór przy zmianie
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    let payload;

    const commonData = {
        date: form.elements.date.value,
        extraDescription: form.elements.extra_description.value,
    };

    if (flowType === 'expense' && form.elements.mainCategory && form.elements.mainCategory.value === 'zakupy codzienne') {
        if (!shoppingBreakdown || shoppingBreakdown.length === 0) {
            setResponseMessage({ text: 'Błąd: Rozbij paragon na podkategorie.', type: 'error' });
            return;
        }
        payload = shoppingBreakdown.map(item => ({
            flowType: 'expense',
            data: { 
                ...commonData, 
                mainCategory: 'zakupy codzienne', 
                account: form.elements.account.value, 
                cost: item.cost, 
                subCategory: item.description, 
                description: item.description, // Zapisujemy nazwę podkategorii również w description
            }
        }));
    } else {
        let dataPayload = { ...commonData };
        if (flowType === 'expense') {
            const accountValue = form.elements.account.value;
            
            // Sprawdź, czy wybrano nową kategorię
            let finalCategory;
            if (mainCategory === 'new' && form.elements.newCategoryName) {
                finalCategory = form.elements.newCategoryName.value.trim().toLowerCase();
                // Sprawdź, czy nazwa kategorii nie jest pusta
                if (!finalCategory) {
                    setResponseMessage({ text: 'Błąd: Nazwa nowej kategorii nie może być pusta.', type: 'error' });
                    return;
                }
            } else {
                finalCategory = form.elements.mainCategory.value;
            }
            
            dataPayload = { 
                ...dataPayload, 
                mainCategory: finalCategory, 
                isNewCategory: mainCategory === 'new',  // Dodaj flagę informującą o nowej kategorii
                account: accountValue, 
                cost: form.elements.cost.value, 
                subCategory: '', 
                description: form.elements.description?.value || '',
                // Dodajemy opcję bilansowania, jeśli konto to Gabi lub Norf
                balanceOption: (accountValue === 'Gabi' || accountValue === 'Norf') ? balanceOption : undefined
            };
        } else if (flowType === 'income') {
            dataPayload = {
                ...dataPayload,
                toAccount: form.elements.toAccount.value,
                from: form.elements.from.value,
                amount: form.elements.amount.value,
                advanceType: showAdvanceOption ? advanceType : undefined
            };
        } else if (flowType === 'transfer') {
            if (form.elements.fromAccount.value === form.elements.toAccount.value) {
                setResponseMessage({ text: 'Błąd: Konta muszą być różne.', type: 'error' });
                return;
            }
            dataPayload = { ...dataPayload, fromAccount: form.elements.fromAccount.value, toAccount: form.elements.toAccount.value, amount: form.elements.amount.value };
        }
        payload = [{ flowType, data: dataPayload }];
    }
    
    setResponseMessage({ text: 'Przetwarzanie...', type: '' });
    
    // Sprawdź, czy to wydatek z konta Gabi/Norf z opcją bilansowania wydatku
    if (flowType === 'expense') {
        const accountValue = form.elements.account.value;
        const cost = parseFloat(form.elements.cost.value);
        if ((accountValue === 'Gabi' || accountValue === 'Norf') && balanceOption === 'balance_expense' && !isNaN(cost)) {
            const confirmTransfer = window.confirm(
                `Wykonaj transfer w kwocie ${cost.toFixed(2)} zł z konta wspólnego na ${accountValue}.`
            );
            if (!confirmTransfer) {
                setResponseMessage({ text: '', type: '' });
                return;
            }
        }
        
        // Sprawdź saldo konta przed wykonaniem wydatku
        try {
            const checkResponse = await fetch(`http://localhost:3001/api/accounts/check-balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    account: accountValue,
                    amount: cost
                })
            });
            
            const checkResult = await checkResponse.json();
            
            if (checkResponse.status === 200 && checkResult.willBeNegative) {
                const proceedWithNegativeBalance = window.confirm(
                    `Po dokonaniu wydatku, saldo konta "${accountValue}" spadnie poniżej zera (${checkResult.projectedBalance.toFixed(2)} zł). Czy na pewno chcesz zaakceptować ten wydatek?`
                );
                
                if (!proceedWithNegativeBalance) {
                    setResponseMessage({ text: '', type: '' });
                    return;
                }
            }
        } catch (error) {
            console.error("Błąd podczas sprawdzania salda konta:", error);
            // Kontynuujemy mimo błędu sprawdzania, aby nie blokować funkcjonalności
        }
    } else if (flowType === 'transfer') {
        const fromAccount = form.elements.fromAccount.value;
        const amount = parseFloat(form.elements.amount.value);

        // Specjalna obsługa dla transferów na KWNR
        // Sprawdź saldo konta źródłowego przed wykonaniem transferu
        try {
            const checkResponse = await fetch(`http://localhost:3001/api/accounts/check-balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    account: fromAccount,
                    amount: amount
                })
            });
            
            const checkResult = await checkResponse.json();
            
            if (checkResponse.status === 200 && checkResult.willBeNegative) {
                const proceedWithNegativeBalance = window.confirm(
                    `Po dokonaniu transferu, saldo konta "${fromAccount}" spadnie poniżej zera (${checkResult.projectedBalance.toFixed(2)} zł). Czy na pewno chcesz zaakceptować ten transfer?`
                );
                
                if (!proceedWithNegativeBalance) {
                    setResponseMessage({ text: '', type: '' });
                    return;
                }
            }
        } catch (error) {
            console.error("Błąd podczas sprawdzania salda konta:", error);
            // Kontynuujemy mimo błędu sprawdzania, aby nie blokować funkcjonalności
        }
    }
    
    try {
        // Specjalne traktowanie transferu do KWNR
        if (flowType === 'transfer') {
            const toAccount = form.elements.toAccount.value;
            const fromAccount = form.elements.fromAccount.value;
            const amount = parseFloat(form.elements.amount.value);
            const dateVal = form.elements.date.value;
            const extraDescription = form.elements.extra_description?.value || '';
            if (toAccount === 'KWNR') {
                payload = [{
                    flowType: 'expense',
                    data: {
                        account: fromAccount,
                        cost: amount.toString(),
                        date: dateVal,
                        mainCategory: 'Transfer na KWNR',
                        description: 'Transfer na KWNR',
                        extra_description: extraDescription,
                        isKwnrTransfer: true
                    }
                }];
            }
        }

        // Helper do właściwego wysyłania + obsługi confirm
        const submitPayload = async (attemptPayload, depth = 0) => {
            const resp = await fetch('http://localhost:3001/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attemptPayload)
            });
            let json;
            try { json = await resp.json(); } catch { json = {}; }

            // Obsługa statusu 202 require confirm
            if (resp.status === 202 && json.needsConfirmation && depth < 2) {
                const monthId = json.month_id;
                if (json.action === 'create_month') {
                    const ok = window.confirm(json.message || `Miesiąc ${monthId} nie istnieje. Utworzyć?`);
                    if (!ok) { setResponseMessage({ text: 'Anulowano tworzenie miesiąca.', type: 'error' }); return; }
                    const ensureResp = await fetch('http://localhost:3001/api/months/ensure', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ month_id: monthId, allowCreate: true })
                    });
                    if (!ensureResp.ok) { setResponseMessage({ text: 'Nie udało się utworzyć miesiąca.', type: 'error' }); return; }
                    await submitPayload(attemptPayload, depth + 1);
                    return;
                }
                if (json.action === 'reopen_month') {
                    const ok = window.confirm(json.message || `Miesiąc ${monthId} jest zamknięty. Otworzyć i dodać przepływ?`);
                    if (!ok) { setResponseMessage({ text: 'Anulowano otwieranie miesiąca.', type: 'error' }); return; }
                    const ensureResp = await fetch('http://localhost:3001/api/months/ensure', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ month_id: monthId, allowReopen: true })
                    });
                    if (!ensureResp.ok) { setResponseMessage({ text: 'Nie udało się otworzyć miesiąca.', type: 'error' }); return; }
                    await submitPayload(attemptPayload, depth + 1);
                    return;
                }
            }

            if (resp.ok) {
                setResponseMessage({ text: json.message || 'Zapisano.', type: 'success' });
                                // Po sukcesie: jeśli to był wydatek, zapisz "ostatni wydatek" w localStorage
                                try {
                                    const first = Array.isArray(attemptPayload) ? attemptPayload[0] : null;
                                    const isExpense = first && first.flowType === 'expense';
                                    if (isExpense) {
                                        const d = first.data || {};
                                        const amount = d.cost || d.amount;
                                        const last = {
                                            category: d.mainCategory || d.category || 'wydatek',
                                            subcategory: d.subCategory || d.description || '',
                                            amount: amount,
                                            date: d.date,
                                        };
                                        localStorage.setItem('lastExpense', JSON.stringify(last));
                                        window.dispatchEvent(new CustomEvent('last-expense-updated', { detail: last }));
                                    }
                                } catch { /* ignore */ }
                form.reset();
                setMainCategory('');
                setShoppingBreakdown(null);
                setDate(new Date().toISOString().slice(0, 10));
                setIncomeFrom('');
                setAdvanceType('current');
                if (flowType === 'expense' && mainCategory === 'new' && form.elements.newCategoryName) {
                    const newCategory = form.elements.newCategoryName.value.trim().toLowerCase();
                    if (newCategory && !userAddedCategories.includes(newCategory)) {
                        const updated = [...userAddedCategories, newCategory];
                        setUserAddedCategories(updated);
                        localStorage.setItem('userAddedCategories', JSON.stringify(updated));
                    }
                }
                onNewEntry();
            } else {
                setResponseMessage({ text: `Błąd: ${json.message || 'Nieznany'}`, type: 'error' });
            }
        };

        await submitPayload(payload);
    } catch (err) {
        console.error('Błąd podczas zapisywania danych:', err);
        setResponseMessage({ text: 'Błąd połączenia z serwerem.', type: 'error' });
    }
  };

        const monthLocked = isMonthClosed; // alias używany w renderowaniu

  return (
    <div className="card form-card">
        <h2>Dodaj nowy przepływ</h2>
                <form id="expense-form" onSubmit={handleSubmit} className={monthLocked ? 'month-locked' : ''}>
                        {monthLocked && (
                            <div style={{background:'#fff4d6', border:'1px solid #e0a800', padding:'8px', marginBottom:'12px', fontSize:'0.9rem'}}>
                                Miesiąc {selectedMonthId} jest zamknięty — przy próbie zapisu zapytamy o otwarcie.
                            </div>
                        )}
            <div className="form-group flow-type">
                <label className={flowType === 'expense' ? 'active' : ''}><input type="radio" name="flowType" value="expense" checked={flowType === 'expense'} onChange={() => setFlowType('expense')} /> Wydatek</label>
                <label className={flowType === 'income' ? 'active' : ''}><input type="radio" name="flowType" value="income" checked={flowType === 'income'} onChange={() => setFlowType('income')} /> Wpływ</label>
                <label className={flowType === 'transfer' ? 'active' : ''}><input type="radio" name="flowType" value="transfer" checked={flowType === 'transfer'} onChange={() => setFlowType('transfer')} /> Transfer</label>
            </div>

            {flowType === 'expense' && (
                <ExpenseFields 
                    onBreakdownChange={(breakdown) => {
                        console.log('Zaktualizowano rozbicie:', breakdown);
                        setShoppingBreakdown(breakdown);
                    }} 
                    mainCategory={mainCategory} 
                    setMainCategory={(category) => {
                        if (category !== 'zakupy codzienne') {
                            setShoppingBreakdown(null); // Reset przy zmianie kategorii z zakupów codziennych
                        }
                        setMainCategory(category);
                    }} 
                    shoppingBreakdown={shoppingBreakdown}
                    onAccountChange={() => {}} // Usuwamy niewykorzystaną funkcję
                    onBalanceOptionChange={setBalanceOption}
                    userAddedCategories={userAddedCategories}
                />
            )}
            {flowType === 'income' && (
                <IncomeFields
                    incomeFrom={incomeFrom}
                    onFromChange={handleIncomeFromChange}
                    showAdvanceOption={showAdvanceOption}
                    advanceType={advanceType}
                    setAdvanceType={setAdvanceType}
                />
            )}
            {flowType === 'transfer' && <TransferFields />}
            
            <div className="form-group"><label htmlFor="date">Data:</label><input type="date" id="date" name="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
            
            <div className="form-group">
                <label htmlFor="extra_description">Opis dodatkowy (opcjonalny):</label>
                <textarea id="extra_description" name="extra_description" rows="3" placeholder="Np. notatki do transakcji..."></textarea>
            </div>

            <button type="submit">Dodaj wpis do archiwum</button>
            {/* Szybkie akcje przeniesione do stopki formularza, aby były zawsze widoczne */}
            <div className="quick-actions" style={{marginTop:'12px'}}>
                <div className="qa-title">Szybkie akcje</div>
                <div className="qa-buttons">
                    <button type="button" className="btn-sm" onClick={() => onRefresh && onRefresh()}>Odśwież</button>
                    <button type="button" className="btn-sm" onClick={() => onAddMonth && onAddMonth()}>Dodaj miesiąc</button>
                    <button type="button" className="btn-sm" onClick={() => onToggleMonthLock && onToggleMonthLock()}>
                        {isMonthClosed ? 'Otwórz miesiąc' : 'Zamknij miesiąc'}
                    </button>
                </div>
            </div>
        </form>
        {responseMessage.text && <div id="response-message" className={responseMessage.type}>{responseMessage.text}</div>}
    </div>
  );
}

export default DataEntryForm;