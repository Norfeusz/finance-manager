const path = require('path');
const pool = require('../db/pool');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Pobiera transakcje z bazy danych PostgreSQL
 */
const getTransactions = async (req, res) => {
    console.log('START getTransactions');
    try {
        const year = req.query.year || new Date().getFullYear();
        const month = req.query.month || new Date().getMonth() + 1;
        const accountName = req.query.account || req.params.accountName;
        
        const client = await pool.connect();
        
        try {
            // Pobierz ID miesiąca
            let monthResult;
            let monthId;
            let whereClause = '';
            let queryParams = [];
            
            if (accountName) {
                // Jeśli podano nazwę konta, pobierz transakcje tylko dla tego konta, niezależnie od miesiąca
                console.log(`Pobieranie transakcji dla konta: ${accountName}`);
                
                const accountResult = await client.query(
                    'SELECT id FROM accounts WHERE name = $1',
                    [accountName]
                );
                
                if (accountResult.rows.length === 0) {
                    // Jeśli konto nie istnieje, zwróć pustą tablicę
                    return res.status(200).json({ transactions: [], balance: 0 });
                }
                
                const accountId = accountResult.rows[0].id;
                whereClause = 'WHERE t.account_id = $1';
                queryParams = [accountId];
                
                // Pobierz aktualne saldo konta
                const balanceResult = await client.query(
                    'SELECT current_balance FROM account_balances WHERE account_id = $1',
                    [accountId]
                );
                
                const balance = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].current_balance) : 0;
                
            } else {
                // Standardowe przetwarzanie dla miesiąca
                monthResult = await client.query(
                    'SELECT id FROM months WHERE year = $1 AND month = $2',
                    [year, month]
                );
                
                if (monthResult.rows.length === 0) {
                    // Jeśli miesiąc nie istnieje, zwróć pustą tablicę
                    return res.status(200).json([]);
                }
                
                monthId = monthResult.rows[0].id;
                whereClause = 'WHERE t.month_id = $1';
                queryParams = [monthId];
            }
            
            // Najpierw sprawdźmy, czy tabela ma nowe kolumny
            const checkColumnsResult = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'transactions' 
                AND column_name IN ('source_account_id', 'source_account_name')
            `);
            
            // Sprawdź, czy obie kolumny istnieją
            const hasSourceColumns = checkColumnsResult.rows.length === 2;
            console.log(`Tabela transactions ${hasSourceColumns ? 'ma' : 'nie ma'} kolumn source_account_id i source_account_name`);
            
            // Pobierz wszystkie transakcje dla danego kryterium (miesiąc lub konto) wraz z powiązanymi danymi
            let query;
            if (hasSourceColumns) {
                query = `SELECT 
                    t.id, t.type, t.amount, t.description, t.extra_description, t.date AS raw_date, t.date, t.balance_after,
                    t.source_account_id, t.source_account_name, -- Nowe kolumny
                    a.name AS account_name,
                    c.name AS category_name,
                    sc.name AS subcategory_name
                FROM 
                    transactions t
                LEFT JOIN 
                    accounts a ON t.account_id = a.id
                LEFT JOIN 
                    categories c ON t.category_id = c.id
                LEFT JOIN 
                    subcategories sc ON t.subcategory_id = sc.id
                ${whereClause}
                ORDER BY 
                    t.date DESC`;
            } else {
                // Zapytanie bez nowych kolumn
                query = `SELECT 
                    t.id, t.type, t.amount, t.description, t.extra_description, t.date AS raw_date, t.date, t.balance_after,
                    a.name AS account_name,
                    c.name AS category_name,
                    sc.name AS subcategory_name
                FROM 
                    transactions t
                LEFT JOIN 
                    accounts a ON t.account_id = a.id
                LEFT JOIN 
                    categories c ON t.category_id = c.id
                LEFT JOIN 
                    subcategories sc ON t.subcategory_id = sc.id
                ${whereClause}
                ORDER BY 
                    t.date DESC`;
            }
            
            const transactionsResult = await client.query(query, queryParams);
            
            // Mapowanie kategorii z bazy danych na kategorie frontendu
            const categoryMapping = {
                'Zakupy spożywcze': 'zakupy codzienne',
                'Transport': 'auta',
                'Mieszkanie': 'dom',
                'Rozrywka': 'wyjścia i szama do domu',
                'Zwierzęta': 'pies',
                'Prezenty': 'prezenty'
            };
            
            // Mapowanie podkategorii z bazy danych na podkategorie frontendu
            const subcategoryMapping = {
                'Podstawowe': 'jedzenie',
                'Przekąski': 'słodycze',
                'Napoje': 'alkohol',
                'Chemia': 'chemia',
                'Higiena': 'higiena',
                'Leki': 'apteka',
                'Kwiaty': 'kwiatki'
            };
            
            // Formatuj dane do struktury, która jest oczekiwana przez frontend
            const formattedTransactions = transactionsResult.rows.map(transaction => {
                console.log("Przetwarzam transakcję z bazy:", JSON.stringify(transaction, null, 2));
                if (transaction.raw_date && transaction.date) {
                    console.log('[DBG DATE] raw_date=', transaction.raw_date, 'date field=', transaction.date, 'id=', transaction.id);
                }
                
                // Formatuj datę z bazy danych do formatu YYYY-MM-DD
                let formattedDate = transaction.date;
                // Normalizacja: jeśli driver zwrócił ISO z Z (np. 2025-08-05T22:00:00.000Z) dla daty 2025-08-06 lokalnie
                if (typeof formattedDate === 'string' && /T\d{2}:\d{2}:\d{2}(.\d+)?Z$/.test(formattedDate)) {
                    const d = new Date(formattedDate);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    formattedDate = `${y}-${m}-${day}`;
                }
                if (formattedDate instanceof Date) {
                    const y = formattedDate.getFullYear();
                    const m = String(formattedDate.getMonth() + 1).padStart(2, '0');
                    const dLocal = String(formattedDate.getDate()).padStart(2, '0');
                    formattedDate = `${y}-${m}-${dLocal}`;
                } else if (typeof formattedDate === 'string' && formattedDate.includes('T')) {
                    // Jeśli data zawiera 'T', jest w formacie ISO
                    formattedDate = formattedDate.split('T')[0];
                }
                console.log('[DBG DATE AFTER FORMAT]', transaction.id, formattedDate);
                
                // Mapuj kategorie z bazy danych na nazwy używane w frontendzie
                const frontendCategory = categoryMapping[transaction.category_name] || transaction.category_name;
                const frontendSubcategory = subcategoryMapping[transaction.subcategory_name] || transaction.subcategory_name;
                
                // Sprawdź czy to wydatek KWNR
                const isKwnrExpense = transaction.category_name === 'Wydatek KWNR';
                
                // Dla wydatków KWNR zwracamy dokładnie te same dane, które zostały zapisane
                if (isKwnrExpense) {
                    // Dla wydatków KWNR, zachowaj datę w jej oryginalnym formacie
                    // Najpierw sprawdź jaki format ma data w bazie danych
                    console.log("Format daty w bazie:", typeof transaction.date, transaction.date);
                    
                    // Konwertujemy datę do formatu DD.MM.YYYY dla wydatków KWNR, ale uwzględniamy strefę czasową
                    let displayDate = formattedDate;
                    try {
                        // Pobierz datę z bazy danych i utwórz nowy obiekt daty bez wpływu strefy czasowej
                        let dateObj;
                        if (transaction.date instanceof Date) {
                            dateObj = new Date(transaction.date.getTime());
                            // Dodaj offset, aby uniknąć wpływu strefy czasowej
                            dateObj.setHours(12, 0, 0, 0);
                        } else if (typeof transaction.date === 'string') {
                            // Parsuj datę ze stringa, utrzymując oryginalny dzień
                            if (transaction.date.includes('T')) {
                                // Jeśli data zawiera T, jest to ISO format
                                dateObj = new Date(transaction.date);
                                dateObj.setHours(12, 0, 0, 0);
                            } else if (transaction.date.includes('-')) {
                                // Format YYYY-MM-DD
                                const [year, month, day] = transaction.date.split('-');
                                dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
                            }
                        }
                        
                        // Formatuj datę do DD.MM.YYYY
                        if (dateObj) {
                            const day = String(dateObj.getDate()).padStart(2, '0');
                            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                            const year = dateObj.getFullYear();
                            displayDate = `${day}.${month}.${year}`;
                        } else if (formattedDate && formattedDate.includes('-')) {
                            // Fallback dla formatów YYYY-MM-DD
                            const [year, month, day] = formattedDate.split('-');
                            if (year && month && day) {
                                displayDate = `${day}.${month}.${year}`;
                            }
                        }
                    } catch (e) {
                        console.error("Błąd podczas przetwarzania daty:", e, "dla transakcji:", transaction);
                    }
                    
                    console.log(`Przygotowano datę dla wydatku KWNR: ${displayDate}`);
                    
                    return {
                        id: transaction.id,
                        type: transaction.type,
                        category: 'Wydatek KWNR',
                        account: transaction.account_name,
                        amount: parseFloat(transaction.amount),
                        cost: parseFloat(transaction.amount),
                        description: transaction.description, // Dokładnie to co wpisał użytkownik w polu "za co"
                        extra_description: transaction.extra_description, // Dokładnie to co użytkownik wybrał w polu "kto"
                        date: displayDate // Użyj przetworzonej daty
                    };
                }
                
                // Dla innych transakcji zwracamy standardowy format
                // Dodajemy nowe pola source_account_id i source_account_name, jeśli są dostępne
                const result = {
                    id: transaction.id,
                    type: transaction.type,
                    category: frontendCategory,
                    subcategory: frontendSubcategory,
                    account: transaction.account_name,
                    // Zachowujemy obie nazwy pól dla zgodności z różnymi częściami frontendu
                    cost: parseFloat(transaction.amount),
                    amount: parseFloat(transaction.amount),
                    description: transaction.description || frontendSubcategory, // Używamy opisu lub nazwy podkategorii
                    extraDescription: transaction.extra_description,
                    date: formattedDate
                };
                
                // Dodaj pola source_account tylko jeśli istnieją
                if (transaction.source_account_id !== undefined) {
                    result.source_account_id = transaction.source_account_id;
                }
                
                if (transaction.source_account_name !== undefined) {
                    result.source_account_name = transaction.source_account_name;
                }
                
                return result;
            });
            
            console.log('Zwracam transakcje, liczba:', formattedTransactions.length);
            
            if (accountName) {
                // Jeśli to zapytanie o konto, zwróć również saldo konta
                const balanceResult = await client.query(
                    `SELECT current_balance FROM account_balances 
                     JOIN accounts ON account_balances.account_id = accounts.id
                     WHERE accounts.name = $1`,
                    [accountName]
                );
                
                const balance = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].current_balance) : 0;
                
                // Dla każdej transakcji wydatku KWNR, dodajmy informacje potrzebne do wyświetlania
                formattedTransactions.forEach(transaction => {
                    // Sprawdź czy to wydatek KWNR
                    if (transaction.category === 'Wydatek KWNR') {
                        // Dla wydatków KWNR używamy description i extra_description bezpośrednio z bazy
                        console.log("Dla wydatku KWNR zwracam:", JSON.stringify(transaction, null, 2));
                    }
                });
                
                res.status(200).json({ 
                    transactions: formattedTransactions,
                    balance: balance
                });
            } else {
                // Standardowe zwrócenie transakcji dla miesiąca
                res.status(200).json(formattedTransactions);
            }
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Błąd podczas pobierania transakcji:', error);
        res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message });
    }
};
module.exports = { getTransactions };