import { useState, useEffect } from 'react';
import CategoryDetailsModal from './CategoryDetailsModal';

const formatCurrency = (amount) => (amount || 0).toFixed(2).replace('.', ',') + ' zł';

const subCategories = ['jedzenie', 'słodycze', 'chemia', 'apteka', 'alkohol', 'higiena', 'kwiatki', 'zakupy'];
const mainCategories = ['auta', 'dom', 'wyjścia i szama do domu', 'pies', 'prezenty'];
const categoryDisplayNames = {
    'jedzenie': 'Jedzenie', 'słodycze': 'Słodycze', 'chemia': 'Chemia', 'apteka': 'Apteka',
    'alkohol': 'Alkohol', 'higiena': 'Higiena', 'kwiatki': 'Kwiatki', 'zakupy': 'Inne zakupy',
    'auta': 'Auta', 'dom': 'Dom', 'wyjścia i szama do domu': 'Wyjścia / Jedzenie na mieście',
    'pies': 'Pies', 'prezenty': 'Prezenty', 'zakupy codzienne': 'Zakupy codzienne (suma)'
};

// ZMIANA TUTAJ: Komponent przyjmuje onDataChange
function ShoppingStats({ refreshKey, transactions, onDataChange }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalInfo, setModalInfo] = useState({ isOpen: false, category: '', transactions: [] });

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

    const handleCategoryClick = (categoryKey) => {
        let relevantTransactions = [];
        if (subCategories.includes(categoryKey)) {
            relevantTransactions = transactions.filter(t => t.category === 'zakupy codzienne' && t.description === categoryKey);
        } else {
            relevantTransactions = transactions.filter(t => t.category === categoryKey);
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

    if (loading) { return <div className="card"><h2>Statystyki wydatków</h2><p>Ładowanie statystyk...</p></div>; }
    if (!stats) { return <div className="card"><h2>Statystyki wydatków</h2><p>Brak danych do wyświetlenia.</p></div>; }
    
    const renderRow = (catKey) => {
        const currentValue = stats.currentMonth[catKey] || 0;
        const avgValue = stats.historicalAverage[catKey] || 0;
        let valueColor = '#333';
        if (currentValue > 0.005) {
            if (currentValue > avgValue) valueColor = '#dc3545';
            else valueColor = '#28a745';
        }

        const isClickable = currentValue > 0;

        return (
            <tr key={catKey}>
                <td className={subCategories.includes(catKey) ? 'subcategory' : ''}>{categoryDisplayNames[catKey] || catKey}</td>
                <td 
                    style={{ color: valueColor, fontWeight: 'bold' }}
                    className={isClickable ? 'clickable-amount' : ''}
                    onClick={isClickable ? () => handleCategoryClick(catKey) : undefined}
                >
                    {formatCurrency(currentValue)}
                </td>
                <td>{formatCurrency(avgValue)}</td>
            </tr>
        );
    };

    return (
        <>
            <div className="card shopping-stats">
                <h2>Statystyki wydatków</h2>
                <p className="subtitle">Średnia nie uwzględnia bieżącego miesiąca.</p>
                <table>
                    <thead><tr><th>Kategoria</th><th>Ten miesiąc</th><th>Średnio / msc</th></tr></thead>
                    <tbody>
                        <tr className="main-category-header"><td colSpan="3">Zakupy codzienne</td></tr>
                        {renderRow('zakupy codzienne')}
                        {subCategories.map(renderRow)}
                        <tr className="main-category-header"><td colSpan="3">Pozostałe kategorie</td></tr>
                        {mainCategories.map(renderRow)}
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