const pool = require('./backend/db/pool');

(async () => {
    const client = await pool.connect();
    try {
        // Sprawdź wydatki w sierpniu 2025
        const expensesQuery = `
            SELECT 
                c.name as category, 
                sc.name as subcategory, 
                SUM(t.amount) as total_amount 
            FROM transactions t 
            LEFT JOIN categories c ON t.category_id = c.id 
            LEFT JOIN subcategories sc ON t.subcategory_id = sc.id 
            WHERE EXTRACT(YEAR FROM t.date) = 2025 
            AND EXTRACT(MONTH FROM t.date) = 8 
            AND t.type = 'expense' 
            GROUP BY c.name, sc.name 
            HAVING SUM(t.amount) > 0 
            ORDER BY SUM(t.amount) DESC
        `;
        
        const result = await client.query(expensesQuery);
        
        console.log('Wydatki sierpień 2025:');
        result.rows.forEach(row => {
            console.log(`${row.category || 'Brak kategorii'} / ${row.subcategory || 'Brak podkategorii'}: ${row.total_amount}`);
        });
        
    } catch (e) {
        console.error('Błąd:', e);
    } finally {
        client.release();
    }
})();
