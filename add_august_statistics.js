const pool = require('./backend/db/pool');

(async () => {
    const client = await pool.connect();
    try {
        // Pobierz ID miesiąca sierpień 2025
        const monthResult = await client.query('SELECT id FROM months WHERE year = 2025 AND month = 8');
        if (monthResult.rows.length === 0) {
            console.log('Nie znaleziono miesiąca sierpień 2025');
            return;
        }
        const monthId = monthResult.rows[0].id;
        console.log('Month ID dla sierpień 2025:', monthId);

        // Pobierz wydatki z sierpnia 2025 pogrupowane po kategoriach i podkategoriach
        const expensesQuery = `
            SELECT 
                c.name as category_name,
                sc.name as subcategory_name,
                SUM(t.amount) as total_amount 
            FROM transactions t 
            LEFT JOIN categories c ON t.category_id = c.id 
            LEFT JOIN subcategories sc ON t.subcategory_id = sc.id 
            WHERE EXTRACT(YEAR FROM t.date) = 2025 
            AND EXTRACT(MONTH FROM t.date) = 8 
            AND t.type = 'expense'
            AND c.name != 'Transfer na KWNR'
            GROUP BY c.name, sc.name 
            HAVING SUM(t.amount) > 0 
            ORDER BY c.name, sc.name
        `;
        
        const expensesResult = await client.query(expensesQuery);
        console.log('Znalezione wydatki:', expensesResult.rows.length);

        // Usuń istniejące statystyki dla sierpnia 2025
        await client.query('DELETE FROM statistics WHERE month_id = $1', [monthId]);
        console.log('Usunięto istniejące statystyki dla sierpnia 2025');

        // Dodaj nowe statystyki
        for (const row of expensesResult.rows) {
            const insertQuery = `
                INSERT INTO statistics (month_id, category, subcategory, amount, is_open) 
                VALUES ($1, $2, $3, $4, $5)
            `;
            
            await client.query(insertQuery, [
                monthId,
                row.category_name,
                row.subcategory_name,
                row.total_amount,
                true // is_open = true
            ]);

            console.log(`Dodano: ${row.category_name || 'Brak kategorii'} / ${row.subcategory_name || 'Brak podkategorii'}: ${row.total_amount}`);
        }

        console.log(`\nDodano ${expensesResult.rows.length} statystyk dla sierpnia 2025`);
        
    } catch (e) {
        console.error('Błąd:', e);
    } finally {
        client.release();
    }
})();
