import { useState, useMemo } from 'react';

const subcategories = ['słodycze', 'chemia', 'apteka', 'alkohol', 'higiena', 'kwiatki'];

// Bezpieczna funkcja do obliczania sumy z tekstu (np. "12.5+3.5")
const evaluateMath = (str) => {
    if (!str || typeof str !== 'string') return 0;
    return str.split('+').reduce((sum, val) => sum + (parseFloat(val.replace(',', '.')) || 0), 0);
};

function ShoppingBreakdownForm({ totalCost, onSave, onCancel }) {
    const [costs, setCosts] = useState({});

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
                breakdown.push({ description: cat, cost: evaluatedCost.toFixed(2) });
            }
        });
        onSave(breakdown);
    };
    
    return (
        <div className="breakdown-form">
            <div className="summary">
                <p>Koszt całkowity: <strong>{totalCost.toFixed(2)} zł</strong></p>
                <p>Suma rozbicia: <strong style={{color: breakdownSum > totalCost ? 'red' : 'inherit'}}>{breakdownSum.toFixed(2)} zł</strong></p>
                <p>Obliczony koszt jedzenia: <strong>{foodCost.toFixed(2)} zł</strong></p>
            </div>
            <hr/>
            <div className="breakdown-grid">
                {subcategories.map(cat => (
                    <div className="form-group" key={cat}>
                        <label htmlFor={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}:</label>
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
            <div className="actions">
                <button type="button" onClick={onCancel}>Anuluj</button>
                <button type="button" className="primary" onClick={handleSave} disabled={breakdownSum > totalCost}>Zapisz Rozbicie</button>
            </div>
        </div>
    );
}

export default ShoppingBreakdownForm;