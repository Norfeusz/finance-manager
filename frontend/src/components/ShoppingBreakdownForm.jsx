import { useState, useMemo, useEffect } from 'react';
import './ShoppingBreakdownForm.css';

// Domyślne podkategorie są teraz przeniesione do stanu komponentu
const defaultSubcategories = ['słodycze', 'chemia', 'apteka', 'alkohol', 'higiena', 'kwiatki', 'zakupy'];

// Bezpieczna funkcja do obliczania sumy z tekstu (np. "12.5+3.5")
const evaluateMath = (str) => {
    if (!str || typeof str !== 'string') return 0;
    return str.split('+').reduce((sum, val) => sum + (parseFloat(val.replace(',', '.')) || 0), 0);
};

function ShoppingBreakdownForm({ totalCost, onSave, onCancel }) {
    const [costs, setCosts] = useState({});
    
    // Stan dla własnych podkategorii
    const [subcategories, setSubcategories] = useState(() => {
        try {
            // Wczytaj zapisane podkategorie z localStorage lub użyj domyślnych
            const savedSubcategories = localStorage.getItem('userSubcategories');
            return savedSubcategories ? [...defaultSubcategories, ...JSON.parse(savedSubcategories)] : defaultSubcategories;
        } catch (e) {
            console.error('Błąd wczytywania podkategorii z localStorage:', e);
            return defaultSubcategories;
        }
    });
    
    // Stan dla zarządzania nazwami wyświetlania podkategorii
    const [categoryDisplayNames, setCategoryDisplayNames] = useState(() => {
        try {
            const savedNames = localStorage.getItem('subcategoryDisplayNames');
            return savedNames ? JSON.parse(savedNames) : {};
        } catch (e) {
            console.error('Błąd wczytywania nazw podkategorii z localStorage:', e);
            return {};
        }
    });
    
    // Stan dla nowej podkategorii
    const [newSubcategory, setNewSubcategory] = useState('');
    
    // Nasłuchiwanie na zmiany w podkategoriach
    useEffect(() => {
        const handleSubcategoryDeleted = (event) => {
            if (event.detail && event.detail.subcategoryName) {
                setSubcategories(prev => prev.filter(cat => cat !== event.detail.subcategoryName));
            }
        };
        
        const handleSubcategoryNamesChanged = (event) => {
            if (event.detail && event.detail.updatedNames) {
                setCategoryDisplayNames(prev => {
                    const newNames = { ...prev };
                    subcategories.forEach(cat => {
                        if (event.detail.updatedNames[cat]) {
                            newNames[cat] = event.detail.updatedNames[cat];
                        }
                    });
                    return newNames;
                });
            }
        };
        
        // Nasłuchuj zdarzeń
        window.addEventListener('subcategoryDeleted', handleSubcategoryDeleted);
        window.addEventListener('subcategoryNamesChanged', handleSubcategoryNamesChanged);
        
        return () => {
            window.removeEventListener('subcategoryDeleted', handleSubcategoryDeleted);
            window.removeEventListener('subcategoryNamesChanged', handleSubcategoryNamesChanged);
        };
    }, [subcategories]);

    const handleCostChange = (category, value) => {
        setCosts(prev => ({ ...prev, [category]: value }));
    };

    const { foodCost, breakdownSum } = useMemo(() => {
        const breakdownSum = Object.values(costs).reduce((sum, val) => sum + evaluateMath(val), 0);
        const foodCost = totalCost - breakdownSum;
        return { foodCost, breakdownSum };
    }, [costs, totalCost]);

    const handleSave = () => {
        const breakdown = [];
        if (foodCost > 0.005) {
            breakdown.push({ description: 'jedzenie', cost: foodCost.toFixed(2) });
        }
        subcategories.forEach(cat => {
            const evaluatedCost = evaluateMath(costs[cat]);
            if (evaluatedCost > 0) {
                breakdown.push({ 
                    description: cat, 
                    cost: evaluatedCost.toFixed(2),
                    // Dodaj informację o wyświetlanej nazwie dla niestandardowych podkategorii
                    displayName: categoryDisplayNames[cat] || null
                });
            }
        });
        onSave(breakdown);
    };
    
    // Funkcja do dodawania nowej podkategorii
    const addNewSubcategory = () => {
        if (!newSubcategory.trim()) return;
        
        // Sprawdź czy podkategoria już istnieje
        if (subcategories.includes(newSubcategory.trim().toLowerCase())) {
            alert('Ta podkategoria już istnieje!');
            return;
        }
        
        const newSubcategoryName = newSubcategory.trim().toLowerCase();
        
        // Dodaj do listy podkategorii
        const updatedSubcategories = [...subcategories, newSubcategoryName];
        setSubcategories(updatedSubcategories);
        
        // Zapisz własne podkategorie w localStorage
        try {
            const userSubcategories = updatedSubcategories.filter(cat => !defaultSubcategories.includes(cat));
            localStorage.setItem('userSubcategories', JSON.stringify(userSubcategories));
            
            // Wyemituj zdarzenie, aby poinformować inne komponenty o nowej podkategorii
            const customEvent = new CustomEvent('subcategoryAdded', {
                detail: { subcategory: newSubcategoryName, updatedSubcategories: userSubcategories }
            });
            window.dispatchEvent(customEvent);
        } catch (e) {
            console.error('Błąd przy zapisywaniu podkategorii:', e);
        }
        
        // Resetuj input
        setNewSubcategory('');
    };
    
    
    // Funkcja do wyświetlania nazwy podkategorii
    const getCategoryDisplayName = (category) => {
        // Użyj nazwy wyświetlania z localStorage lub sformatuj nazwę podkategorii
        return categoryDisplayNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
    };
    
    return (
        <div className="breakdown-form">
            <div className="summary">
                <p>Koszt całkowity: <strong>{totalCost.toFixed(2)} zł</strong></p>
                <p>Suma rozbicia: <strong style={{color: breakdownSum > totalCost ? 'red' : 'inherit'}}>{breakdownSum.toFixed(2)} zł</strong></p>
                <p>Obliczony koszt jedzenia: <strong>{foodCost.toFixed(2)} zł</strong></p>
            </div>
            <hr className="breakdown-divider"/>
            
            <div className="breakdown-grid">
                {subcategories.map(cat => (
                    <div className="form-group" key={cat}>
                        <label htmlFor={cat}>
                            {getCategoryDisplayName(cat)}:
                        </label>
                        <input 
                            type="text" 
                            id={cat} 
                            name={cat} 
                            placeholder="np. 15,99 + 2,50"
                            value={costs[cat] || ''}
                            onChange={(e) => handleCostChange(cat, e.target.value)}
                        />
                    </div>
                ))}
            </div>
            
            <div className="new-subcategory">
                <h3>Dodaj nową podkategorię:</h3>
                <div className="add-subcategory-container">
                    <input 
                        type="text" 
                        id="newSubcategory" 
                        placeholder="Nazwa nowej podkategorii" 
                        value={newSubcategory} 
                        onChange={(e) => setNewSubcategory(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addNewSubcategory()}
                        autoComplete="off"
                    />
                    <button 
                        type="button" 
                        className="add-subcategory" 
                        onClick={addNewSubcategory}
                        disabled={!newSubcategory.trim()}
                    >
                        Dodaj
                    </button>
                </div>
            </div>
            
            <div className="actions">
                <button type="button" onClick={onCancel}>Anuluj</button>
                <button type="button" className="primary" onClick={handleSave} disabled={breakdownSum > totalCost}>Zapisz Rozbicie</button>
            </div>
        </div>
    );
}

export default ShoppingBreakdownForm;