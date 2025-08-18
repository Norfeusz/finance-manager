import { useState, useEffect } from 'react';
import Modal from './Modal';
import ShoppingBreakdownForm from './ShoppingBreakdownForm';

// -- Komponenty pomocnicze --

const ExpenseFields = ({ onBreakdownChange, mainCategory, setMainCategory, shoppingBreakdown, onAccountChange, onBalanceOptionChange }) => {
    const [isShoppingModalOpen, setIsShoppingModalOpen] = useState(false);
    const [totalCost, setTotalCost] = useState('');
    const [account, setAccount] = useState('Wspólne');
    const [balanceOption, setBalanceOption] = useState('budget_increase');
    
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
    
    const expenseCategories = [ 'zakupy codzienne', 'auta', 'dom', 'wyjścia i szama do domu', 'pies', 'prezenty' ];
    
    // Pokazujemy opcje tylko dla kont Gabi lub Norf
    const showBalanceOptions = account === 'Gabi' || account === 'Norf';

    return (
    <>
        <div className="form-group">
            <label htmlFor="mainCategory">Kategoria główna:</label>
            <select id="mainCategory" name="mainCategory" required value={mainCategory} onChange={(e) => setMainCategory(e.target.value)}>
                <option value="">-- Wybierz kategorię --</option>
                {expenseCategories.map(cat => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
            </select>
        </div>

        {mainCategory === 'zakupy codzienne' ? (
            <div className="form-group">
                <label htmlFor="cost">Koszt całkowity zakupów:</label>
                <input type="number" id="cost" name="cost" step="0.01" placeholder="0,00" required value={totalCost} onChange={(e) => setTotalCost(e.target.value)} />
                <button type="button" onClick={() => setIsShoppingModalOpen(true)} disabled={!totalCost || totalCost <= 0} style={{marginTop: '10px'}}>
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

function DataEntryForm({ onNewEntry }) {
  const [flowType, setFlowType] = useState('expense');
  const [mainCategory, setMainCategory] = useState('');
  const [responseMessage, setResponseMessage] = useState({ text: '', type: '' });
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shoppingBreakdown, setShoppingBreakdown] = useState(null);

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

    if (flowType === 'expense' && mainCategory === 'zakupy codzienne') {
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
            dataPayload = { 
                ...dataPayload, 
                mainCategory: form.elements.mainCategory.value, 
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
    }
    
    try {
        const response = await fetch('http://localhost:3001/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok) {
            setResponseMessage({ text: result.message, type: 'success' });
            form.reset();
            setMainCategory('');
            setShoppingBreakdown(null);
            setDate(new Date().toISOString().slice(0, 10));
            setIncomeFrom('');
            setAdvanceType('current');
            onNewEntry();
        } else {
            setResponseMessage({ text: `Błąd: ${result.message}`, type: 'error' });
        }
    } catch (err) {
        console.error('Błąd podczas zapisywania danych:', err);
        setResponseMessage({ text: 'Błąd połączenia z serwerem.', type: 'error' });
    }
  };

  return (
    <div className="card form-card">
        <h2>Dodaj nowy przepływ</h2>
        <form id="expense-form" onSubmit={handleSubmit}>
            <div className="form-group flow-type">
                <label className={flowType === 'expense' ? 'active' : ''}><input type="radio" name="flowType" value="expense" checked={flowType === 'expense'} onChange={() => setFlowType('expense')} /> Wydatek</label>
                <label className={flowType === 'income' ? 'active' : ''}><input type="radio" name="flowType" value="income" checked={flowType === 'income'} onChange={() => setFlowType('income')} /> Wpływ</label>
                <label className={flowType === 'transfer' ? 'active' : ''}><input type="radio" name="flowType" value="transfer" checked={flowType === 'transfer'} onChange={() => setFlowType('transfer')} /> Transfer</label>
            </div>

            {flowType === 'expense' && (
                <ExpenseFields 
                    onBreakdownChange={setShoppingBreakdown} 
                    mainCategory={mainCategory} 
                    setMainCategory={setMainCategory} 
                    shoppingBreakdown={shoppingBreakdown}
                    onAccountChange={() => {}} // Usuwamy niewykorzystaną funkcję
                    onBalanceOptionChange={setBalanceOption}
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
        </form>
        {responseMessage.text && <div id="response-message" className={responseMessage.type}>{responseMessage.text}</div>}
    </div>
  );
}

export default DataEntryForm;