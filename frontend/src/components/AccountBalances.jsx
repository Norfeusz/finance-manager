import { useState, useEffect } from 'react';

function AccountBalances({ refreshKey }) {
    const [accountBalances, setAccountBalances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAccountBalances = async () => {
            setLoading(true);
            try {
                const response = await fetch('http://localhost:3001/api/accounts/balances');
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                const data = await response.json();
                // Filtruj tylko dozwolone konta
                const allowedAccounts = ['Wspólne', 'Gotówka', 'Oszczędnościowe', 'Rachunki', 'KWNR'];
                const filteredData = data.filter(account => allowedAccounts.includes(account.name));
                setAccountBalances(filteredData);
                setError(null);
            } catch (err) {
                console.error('Błąd pobierania stanów kont:', err);
                setError('Nie udało się pobrać stanów kont. Spróbuj ponownie później.');
            } finally {
                setLoading(false);
            }
        };

        fetchAccountBalances();
    }, [refreshKey]);

    // Funkcja pomocnicza do formatowania waluty
    const formatCurrency = (value) => {
        if (value === null || value === undefined) return '-';
        return parseFloat(value).toLocaleString('pl-PL', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }) + ' zł';
    };

    if (loading) return <div className="loading">Ładowanie danych o kontach...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="account-balances">
            <h3>Stany kont</h3>
            <table>
                <thead>
                    <tr>
                        <th>Konto</th>
                        <th>Stan bieżący</th>
                    </tr>
                </thead>
                <tbody>
                    {accountBalances.map(account => (
                        <tr key={account.id}>
                            <td>{account.name}</td>
                            <td 
                                className="current-balance" 
                                title={`Stan początkowy: ${formatCurrency(account.initial_balance)}`}
                            >
                                {formatCurrency(account.current_balance)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default AccountBalances;
