import { useState, useEffect } from 'react';
import CategoryDetailsModal from './CategoryDetailsModal';
import './CategoryManagement.css';

const formatCurrency = (amount) => (amount || 0).toFixed(2).replace('.', ',') + ' zł';

// Domyślne podkategorie dla zakupów codziennych
const defaultSubCategories = ['jedzenie', 'słodycze', 'chemia', 'apteka', 'alkohol', 'higiena', 'kwiatki', 'zakupy'];
const defaultMainCategories = ['auta', 'dom', 'wyjścia i szama do domu', 'pies', 'prezenty', 'wyjazdy'];


// Funkcja która inicjalizuje mapę nazw kategorii
const initCategoryDisplayNames = () => {
    return {
        'jedzenie': 'Jedzenie', 'słodycze': 'Słodycze', 'chemia': 'Chemia', 'apteka': 'Apteka',
        'alkohol': 'Alkohol', 'higiena': 'Higiena', 'kwiatki': 'Kwiatki', 'zakupy': 'Inne zakupy',
        'auta': 'Auta', 'dom': 'Dom', 'wyjścia i szama do domu': 'Wyjścia i szama do domu',
        'pies': 'Pies', 'prezenty': 'Prezenty', 'wyjazdy': 'Wyjazdy', 'zakupy codzienne': 'Zakupy codzienne (suma)'
    };
};

// Kategorie wykluczone ze statystyk (ale nadal mogą być liczone w sumach globalnych gdzie indziej)
const EXCLUDED_STATS_CATEGORIES = ['transfer', 'transfer na kwnr'];
const isExcludedStatsCategory = (cat) => !!cat && EXCLUDED_STATS_CATEGORIES.includes(cat.trim().toLowerCase());

// ZMIANA TUTAJ: Komponent przyjmuje onDataChange
function ShoppingStats({ refreshKey, transactions, onDataChange, selectedMonthId }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalInfo, setModalInfo] = useState({ isOpen: false, category: '', transactions: [] });
    const [prevMonthTransactions, setPrevMonthTransactions] = useState([]);
    const [closedMonthsAverages, setClosedMonthsAverages] = useState({});
    // Stan do edycji nazwy kategorii
    const [editingCategory, setEditingCategory] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    
    // Wczytaj zapisane kategorie z localStorage lub użyj domyślnych, jeśli ich nie ma
    const [mainCategories, setMainCategories] = useState(() => {
        try {
            const savedCategories = localStorage.getItem('usedMainCategories');
            return savedCategories ? JSON.parse(savedCategories) : defaultMainCategories;
        } catch (e) {
            console.error('Błąd wczytywania kategorii z localStorage:', e);
            return defaultMainCategories;
        }
    });
    
    // Wczytaj zapisane podkategorie z localStorage lub użyj domyślnych
    const [subCategories, setSubCategories] = useState(() => {
        try {
            const savedSubcategories = localStorage.getItem('userSubcategories');
            return savedSubcategories 
                ? [...defaultSubCategories, ...JSON.parse(savedSubcategories)] 
                : defaultSubCategories;
        } catch (e) {
            console.error('Błąd wczytywania podkategorii z localStorage:', e);
            return defaultSubCategories;
        }
    });
    
    const [categoryDisplayNames, setCategoryDisplayNames] = useState(() => {
        try {
            const savedNames = localStorage.getItem('categoryDisplayNames');
            const savedSubNames = localStorage.getItem('subcategoryDisplayNames');
            
            let allNames = initCategoryDisplayNames();
            if (savedNames) {
                allNames = { ...allNames, ...JSON.parse(savedNames) };
            }
            if (savedSubNames) {
                allNames = { ...allNames, ...JSON.parse(savedSubNames) };
            }
            
            return allNames;
        } catch (e) {
            console.error('Błąd wczytywania nazw kategorii z localStorage:', e);
            return initCategoryDisplayNames();
        }
    });

    // Nasłuchiwanie na zdarzenia związane z podkategoriami
    useEffect(() => {
        const handleSubcategoryAdded = (event) => {
            if (event.detail && event.detail.subcategory) {
                // Aktualizuj listę podkategorii
                setSubCategories(prevSubCategories => {
                    if (!prevSubCategories.includes(event.detail.subcategory)) {
                        return [...prevSubCategories, event.detail.subcategory];
                    }
                    return prevSubCategories;
                });
            }
        };
        
        // Nasłuchuj zdarzenia dodania podkategorii
        window.addEventListener('subcategoryAdded', handleSubcategoryAdded);
        
        return () => {
            window.removeEventListener('subcategoryAdded', handleSubcategoryAdded);
        };
    }, []);

    // Wykrywanie nowych kategorii z transakcji
    useEffect(() => {
        if (!transactions || transactions.length === 0) return;

        // Znajdź wszystkie unikalne kategorie główne w transakcjach
        const transactionCategories = [...new Set(
            transactions
                .filter(t => t.type === 'expense' && t.category !== 'zakupy codzienne')
                .map(t => t.category)
                .filter(cat => !isExcludedStatsCategory(cat))
        )];

        // Aktualizuj listę kategorii głównych
        const newMainCategories = [...mainCategories]; // Używamy bieżących kategorii jako bazy
        let categoriesChanged = false;
        
        // Dodaj nowe kategorie, które nie są jeszcze w głównych kategoriach
        transactionCategories.forEach(category => {
            if (category && !newMainCategories.includes(category) && !subCategories.includes(category)) {
                newMainCategories.push(category);
                categoriesChanged = true;
            }
        });

        // Aktualizuj nazwy wyświetlania kategorii
        const newCategoryDisplayNames = {...categoryDisplayNames};
        let namesChanged = false;
        
        transactionCategories.forEach(category => {
            if (category && !newCategoryDisplayNames[category]) {
                // Dodaj nową kategorię do mapy nazw (pierwsza litera wielka)
                newCategoryDisplayNames[category] = category.charAt(0).toUpperCase() + category.slice(1);
                namesChanged = true;
            }
        });

        // Zapisz tylko jeśli były zmiany
        if (categoriesChanged) {
            setMainCategories(newMainCategories);
            localStorage.setItem('usedMainCategories', JSON.stringify(newMainCategories));
        }
        
        if (namesChanged) {
            setCategoryDisplayNames(newCategoryDisplayNames);
            localStorage.setItem('categoryDisplayNames', JSON.stringify(newCategoryDisplayNames));
        }
    }, [transactions, categoryDisplayNames, mainCategories, subCategories]);

    // Pobierz transakcje z poprzedniego miesiąca do kolumny "Poprzedni miesiąc"
    useEffect(() => {
        const fetchPrev = async () => {
            try {
                if (!selectedMonthId || !/^\d{4}-\d{2}$/.test(selectedMonthId)) { setPrevMonthTransactions([]); return; }
                const [y, m] = selectedMonthId.split('-').map(Number);
                const d = new Date(y, m - 1, 1); d.setMonth(d.getMonth() - 1);
                const prevId = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const resp = await fetch(`http://localhost:3001/api/transactions?month_id=${prevId}`);
                if (!resp.ok) { setPrevMonthTransactions([]); return; }
                const data = await resp.json();
                setPrevMonthTransactions(Array.isArray(data) ? data : []);
            } catch {
                setPrevMonthTransactions([]);
            }
        };
        fetchPrev();
    }, [selectedMonthId]);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const response = await fetch('http://localhost:3001/api/statistics/shopping');
                const data = await response.json();
                setStats(data);
            } catch (error) {
                console.error("Błąd pobierania statystyk:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [refreshKey]);

    // Pobierz średnie z zamkniętych miesięcy wcześniejszych niż wybrany
    useEffect(() => {
        const fetchAverages = async () => {
            try {
                if (!selectedMonthId) { setClosedMonthsAverages({}); return; }
                const r = await fetch(`http://localhost:3001/api/statistics/shopping/averages?month_id=${selectedMonthId}`);
                if (!r.ok) { setClosedMonthsAverages({}); return; }
                const js = await r.json();
                setClosedMonthsAverages(js.averages || {});
            } catch (e) {
                console.warn('Błąd pobierania średnich:', e);
                setClosedMonthsAverages({});
            }
        };
        fetchAverages();
    }, [selectedMonthId]);

    const handleCategoryClick = (categoryKey) => {
        let relevantTransactions = [];
        // Filtrujemy do wybranego miesiąca, jeśli dostępny
        const inSelectedMonth = (t) => {
            if (!selectedMonthId) return true;
            if (!t || !t.date) return false;
            // t.date może być YYYY-MM-DD lub ISO z T
            const dateStr = String(t.date);
            if (dateStr.includes('T')) {
                const d = new Date(dateStr);
                const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                return ym === selectedMonthId;
            }
            return dateStr.startsWith(selectedMonthId);
        };

    const norm = (s) => (s || '').toString().trim().toLowerCase();
    const catKeyL = norm(categoryKey);
    const isSub = subCategories.map(norm).includes(catKeyL);

    if (isSub) {
            relevantTransactions = transactions.filter(t => {
        return inSelectedMonth(t)
            && t.type === 'expense'
            && norm(t.category) === 'zakupy codzienne'
            && (norm(t.description) === catKeyL || norm(t.subcategory) === catKeyL);
            });
        } else {
        relevantTransactions = transactions.filter(t => inSelectedMonth(t) && t.type === 'expense' && norm(t.category) === catKeyL);
        }

        setModalInfo({
            isOpen: true,
            category: categoryDisplayNames[categoryKey] || categoryKey,
            transactions: relevantTransactions
        });
    };

    const handleCloseModal = () => {
        setModalInfo({ isOpen: false, category: '', transactions: [] });
    };
    
    // Funkcja do rozpoczęcia edycji nazwy kategorii
    const handleEditCategory = (category) => {
        setEditingCategory(category);
        setEditingCategoryName(categoryDisplayNames[category] || category);
    };
    
    // Funkcja do zapisywania zmienionej nazwy kategorii
    const handleSaveCategory = (category) => {
        // Aktualizacja nazwy w mapie nazw kategorii
        const newCategoryDisplayNames = {...categoryDisplayNames};
        newCategoryDisplayNames[category] = editingCategoryName;
        setCategoryDisplayNames(newCategoryDisplayNames);
        localStorage.setItem('categoryDisplayNames', JSON.stringify(newCategoryDisplayNames));
        
        // Wyemituj zdarzenie o zmianie kategorii dla innych komponentów
        const customEvent = new CustomEvent('categoryNamesChanged', {
            detail: { updatedNames: newCategoryDisplayNames }
        });
        window.dispatchEvent(customEvent);
        
        // Zakończ edycję
        setEditingCategory(null);
        setEditingCategoryName('');
    };
    
    // Funkcja do anulowania edycji
    const handleCancelEdit = () => {
        setEditingCategory(null);
        setEditingCategoryName('');
    };
    
    // Funkcja do usuwania kategorii
    const handleDeleteCategory = (category) => {
        // Sprawdź czy w bieżącym miesiącu są wydatki w tej kategorii
        const currentMonthValue = stats.currentMonth[category] || 0;
        
        if (currentMonthValue > 0) {
            alert('Nie można usunąć kategorii. W bieżącym miesiącu są wydatki przypisane do tej kategorii.');
            return;
        }
        
        // Usuń kategorię z listy głównych kategorii
        const newMainCategories = mainCategories.filter(cat => cat !== category);
        setMainCategories(newMainCategories);
        localStorage.setItem('usedMainCategories', JSON.stringify(newMainCategories));
        
        // Usuń z listy kategorii użytkownika w localStorage
        try {
            const userAddedCategories = JSON.parse(localStorage.getItem('userAddedCategories') || '[]');
            const updatedUserCategories = userAddedCategories.filter(cat => cat !== category);
            localStorage.setItem('userAddedCategories', JSON.stringify(updatedUserCategories));
            
            // Wyemituj zdarzenie o usunięciu kategorii
            const customEvent = new CustomEvent('categoryDeleted', {
                detail: { categoryName: category, updatedCategories: updatedUserCategories }
            });
            window.dispatchEvent(customEvent);
        } catch (e) {
            console.error('Błąd przy aktualizacji listy kategorii użytkownika:', e);
        }
    };

    if (loading) { return <div className="card"><h2>Statystyki wydatków</h2><p>Ładowanie statystyk...</p></div>; }
    if (!stats) { return <div className="card"><h2>Statystyki wydatków</h2><p>Brak danych do wyświetlenia.</p></div>; }
    
    const renderRow = (catKey) => {
    if (isExcludedStatsCategory(catKey)) return null; // Ukrywamy w tabeli
        // Oblicz wartość “Ten miesiąc” na podstawie transakcji z wybranego miesiąca
        const monthFilter = (t) => {
            if (!selectedMonthId) return true;
            const dateStr = String(t.date || '');
            if (dateStr.includes('T')) {
                const d = new Date(dateStr);
                const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                return ym === selectedMonthId;
            }
            return dateStr.startsWith(selectedMonthId);
        };

    let currentValue = 0;
    if (Array.isArray(transactions) && transactions.length) {
        const norm = (s) => (s || '').toString().trim().toLowerCase();
        const catKeyL = norm(catKey);
        const isSub = subCategories.map(norm).includes(catKeyL);
        if (isSub) {
                currentValue = transactions
            .filter(t => t.type === 'expense' && monthFilter(t) && norm(t.category) === 'zakupy codzienne' && (norm(t.description) === catKeyL || norm(t.subcategory) === catKeyL))
                    .reduce((s, t) => s + Number(t.cost || t.amount || 0), 0);
            } else {
                currentValue = transactions
            .filter(t => t.type === 'expense' && monthFilter(t) && norm(t.category) === catKeyL)
                    .reduce((s, t) => s + Number(t.cost || t.amount || 0), 0);
            }
        }
        // Oblicz “Poprzedni miesiąc” z transakcji poprzedniego miesiąca
        let prevValue = 0;
        if (Array.isArray(prevMonthTransactions) && prevMonthTransactions.length) {
            const norm = (s) => (s || '').toString().trim().toLowerCase();
            const catKeyL = norm(catKey);
            const isSub = subCategories.map(norm).includes(catKeyL);
            if (isSub) {
                prevValue = prevMonthTransactions
                    .filter(t => t.type === 'expense' && norm(t.category) === 'zakupy codzienne' && (norm(t.description) === catKeyL || norm(t.subcategory) === catKeyL))
                    .reduce((s, t) => s + Number(t.cost || t.amount || 0), 0);
            } else {
                prevValue = prevMonthTransactions
                    .filter(t => t.type === 'expense' && norm(t.category) === catKeyL)
                    .reduce((s, t) => s + Number(t.cost || t.amount || 0), 0);
            }
        }
        // Specjalny override: dla sierpnia 2025 pokazuj sztywne wartości dla poprzedniego miesiąca
        if (selectedMonthId === '2025-08') {
            const overrides = {
                'zakupy codzienne': 1212.43,
                'jedzenie': 995.48,
                'słodycze': 56.78,
                'chemia': 62.28,
                'apteka': 30.01,
                'alkohol': 49.91,
                'higiena': 17.97,
                'kwiatki': 0,
                'auta': 8584.2,
                'dom': 254.27,
                'wyjścia i szama do domu': 202.97,
                'pies': 0,
                'prezenty': 746
            };
            const keyL = (catKey || '').toString().trim().toLowerCase();
            if (Object.prototype.hasOwnProperty.call(overrides, keyL)) {
                prevValue = overrides[keyL];
            }
        }
        // Fallback do backendowych statystyk, jeśli nie mamy danych transakcyjnych
        if (!prevValue && stats && stats.previousMonth && stats.previousMonth[catKey]) {
            prevValue = stats.previousMonth[catKey] || 0;
        }
    // Pierwszy wariant średniej: średnia ze wszystkich zamkniętych miesięcy wcześniejszych niż wybrany miesiąc
    const normKey = (catKey || '').toString().trim().toLowerCase();
    const avgValue = closedMonthsAverages[normKey] || 0;
        
        // Sprawdź, czy to nowa kategoria (dodana w bieżącym miesiącu)
        const isNewCategory = prevValue === 0 && avgValue === 0 && (currentValue > 0 || mainCategories.includes(catKey) || subCategories.includes(catKey));
        
        // Kolor dla wartości bieżącego miesiąca
        let valueColor = '#333';
        if (currentValue > 0.005) {
            if (currentValue > avgValue) valueColor = '#dc3545';
            else valueColor = '#28a745';
        }
        
        // Kolor dla wartości poprzedniego miesiąca
        let prevValueColor = '#333';
        if (prevValue > 0.005) {
            if (prevValue > avgValue) prevValueColor = '#dc3545';
            else prevValueColor = '#28a745';
        }

        // Wszystkie kategorie są teraz klikalne

        // Sprawdź czy to kategoria dodana przez użytkownika (nie jest z domyślnych)
        const isUserAddedCategory = mainCategories.includes(catKey) && !defaultMainCategories.includes(catKey);
        
        // Sprawdź czy to podkategoria dodana przez użytkownika (nie jest z domyślnych)
        const isUserAddedSubcategory = subCategories.includes(catKey) && !defaultSubCategories.includes(catKey);
        
        // Funkcja do usuwania podkategorii
        const handleDeleteSubcategory = (subcategory) => {
            // Sprawdź czy w bieżącym miesiącu są wydatki w tej podkategorii
            const currentMonthValue = stats.currentMonth[subcategory] || 0;
            
            if (currentMonthValue > 0) {
                alert('Nie można usunąć podkategorii. W bieżącym miesiącu są wydatki przypisane do tej podkategorii.');
                return;
            }
            
            // Usuń podkategorię z listy
            const newSubCategories = subCategories.filter(cat => cat !== subcategory);
            setSubCategories(newSubCategories);
            
            // Usuń z listy podkategorii użytkownika w localStorage
            try {
                const userSubcategories = JSON.parse(localStorage.getItem('userSubcategories') || '[]');
                const updatedUserSubcategories = userSubcategories.filter(cat => cat !== subcategory);
                localStorage.setItem('userSubcategories', JSON.stringify(updatedUserSubcategories));
                
                // Wyemituj zdarzenie o usunięciu podkategorii
                const customEvent = new CustomEvent('subcategoryDeleted', {
                    detail: { subcategoryName: subcategory }
                });
                window.dispatchEvent(customEvent);
            } catch (e) {
                console.error('Błąd przy aktualizacji listy podkategorii użytkownika:', e);
            }
        };
        
        // Funkcja do zapisania zmiany nazwy podkategorii
        const handleSaveSubcategory = (subcategory) => {
            // Aktualizacja nazwy w mapie nazw kategorii
            const newCategoryDisplayNames = {...categoryDisplayNames};
            newCategoryDisplayNames[subcategory] = editingCategoryName;
            setCategoryDisplayNames(newCategoryDisplayNames);
            
            // Zapisz oddzielnie nazwy podkategorii
            try {
                const subcategoryNames = {};
                subCategories.forEach(cat => {
                    if (newCategoryDisplayNames[cat]) {
                        subcategoryNames[cat] = newCategoryDisplayNames[cat];
                    }
                });
                localStorage.setItem('subcategoryDisplayNames', JSON.stringify(subcategoryNames));
                localStorage.setItem('categoryDisplayNames', JSON.stringify(newCategoryDisplayNames));
                
                // Wyemituj zdarzenie o zmianie nazwy podkategorii
                const customEvent = new CustomEvent('subcategoryNamesChanged', {
                    detail: { updatedNames: newCategoryDisplayNames }
                });
                window.dispatchEvent(customEvent);
            } catch (e) {
                console.error('Błąd przy zapisywaniu nazw podkategorii:', e);
            }
            
            // Zakończ edycję
            setEditingCategory(null);
            setEditingCategoryName('');
        };
        
        // Renderuj pole nazwy kategorii z ikonami zarządzania (jeśli to kategoria użytkownika)
        const renderCategoryName = () => {
            if (editingCategory === catKey) {
                return (
                    <div className="edit-category-form">
                        <input 
                            type="text" 
                            value={editingCategoryName} 
                            onChange={(e) => setEditingCategoryName(e.target.value)} 
                            autoFocus
                        />
                        <button className="save" onClick={() => {
                            if (isUserAddedSubcategory) {
                                handleSaveSubcategory(catKey);
                            } else {
                                handleSaveCategory(catKey);
                            }
                        }}>✓</button>
                        <button className="cancel" onClick={handleCancelEdit}>✗</button>
                    </div>
                );
            }
            
            return (
                <div className="category-name">
                    <span>{categoryDisplayNames[catKey] || catKey}</span>
                    {(isUserAddedCategory || isUserAddedSubcategory) && (
                        <div className="category-actions">
                            <button className="edit" onClick={() => handleEditCategory(catKey)}>✎</button>
                            <button className="delete" onClick={() => {
                                if (isUserAddedSubcategory) {
                                    handleDeleteSubcategory(catKey);
                                } else {
                                    handleDeleteCategory(catKey);
                                }
                            }}>🗑</button>
                        </div>
                    )}
                </div>
            );
        };
        
        return (
            <tr key={catKey}>
                <td className={subCategories.includes(catKey) ? 'subcategory' : ''}>
                    {renderCategoryName()}
                </td>
                <td 
                    style={{ color: valueColor, fontWeight: 'bold' }}
                    className={'clickable-amount'}
                    onClick={() => handleCategoryClick(catKey)}
                >
                    {formatCurrency(currentValue)}
                </td>
                <td style={{ color: prevValueColor }}>
                    {isNewCategory ? '-' : formatCurrency(prevValue)}
                </td>
                <td>{isNewCategory ? '-' : formatCurrency(avgValue)}</td>
            </tr>
        );
    };

    return (
        <>
            <div className="card shopping-stats">
                <h2>Statystyki wydatków</h2>
                <p className="subtitle">Średnia nie uwzględnia bieżącego miesiąca.</p>
                <table>
                    <thead><tr><th>Kategoria</th><th>Ten miesiąc</th><th>Poprzedni miesiąc</th><th>Średnio / msc</th></tr></thead>
                    <tbody>
                        <tr className="main-category-header"><td colSpan="4">Zakupy codzienne</td></tr>
                        {renderRow('zakupy codzienne')}
                        {subCategories
                            .filter(subcategory => subcategory !== 'zakupy') // Ukryj podkategorię "inne zakupy"
                            .map(renderRow)}
                        <tr className="main-category-header"><td colSpan="4">Pozostałe kategorie</td></tr>
                        {mainCategories.filter(c => !isExcludedStatsCategory(c)).map(renderRow)}
                    </tbody>
                </table>
            </div>
            
            <CategoryDetailsModal 
                isOpen={modalInfo.isOpen}
                onClose={handleCloseModal}
                categoryName={modalInfo.category}
                transactions={modalInfo.transactions}
                onDataChange={onDataChange} // Przekazujemy funkcję odświeżania
            />
        </>
    );
}

export default ShoppingStats;