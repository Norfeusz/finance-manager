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
        
        const client = await pool.connect();
        
        try {
            // Pobierz ID miesiąca
            const monthResult = await client.query(
                'SELECT id FROM months WHERE year = $1 AND month = $2',
                [year, month]
            );
            
            if (monthResult.rows.length === 0) {
                // Jeśli miesiąc nie istnieje, zwróć pustą tablicę
                return res.status(200).json([]);
            }
            
            const monthId = monthResult.rows[0].id;
            
            // Pobierz wszystkie transakcje dla danego miesiąca wraz z powiązanymi danymi
            const transactionsResult = await client.query(
                `SELECT 
                    t.id, t.type, t.amount, t.description, t.extra_description, t.date,
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
                WHERE 
                    t.month_id = $1
                ORDER BY 
                    t.date ASC`,
                [monthId]
            );
            
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
                // Formatuj datę z bazy danych do formatu YYYY-MM-DD
                let formattedDate = transaction.date;
                if (formattedDate instanceof Date) {
                    formattedDate = formattedDate.toISOString().split('T')[0];
                } else if (typeof formattedDate === 'string' && formattedDate.includes('T')) {
                    // Jeśli data zawiera 'T', jest w formacie ISO
                    formattedDate = formattedDate.split('T')[0];
                }
                
                // Mapuj kategorie z bazy danych na nazwy używane w frontendzie
                const frontendCategory = categoryMapping[transaction.category_name] || transaction.category_name;
                const frontendSubcategory = subcategoryMapping[transaction.subcategory_name] || transaction.subcategory_name;
                
                return {
                    id: transaction.id,
                    type: transaction.type,
                    category: frontendCategory,
                    subcategory: frontendSubcategory,
                    account: transaction.account_name,
                    cost: parseFloat(transaction.amount),
                    description: transaction.description || frontendSubcategory, // Używamy opisu lub nazwy podkategorii
                    extraDescription: transaction.extra_description,
                    date: formattedDate
                };
            });
            
            console.log('Zwracam transakcje, liczba:', formattedTransactions.length);
            res.status(200).json(formattedTransactions);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Błąd podczas pobierania transakcji:', error);
        res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message });
    }
};
module.exports = { getTransactions };