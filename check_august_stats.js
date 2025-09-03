const pool = require('./backend/db/pool');

(async () => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM statistics WHERE month_id = $1 ORDER BY amount DESC', ['2025-08']);
        
        console.log('Statystyki dla sierpnia 2025:');
        result.rows.forEach(row => {
            console.log(`${row.category} / ${row.subcategory || 'Brak podkategorii'}: ${row.amount} (is_open: ${row.is_open})`);
        });
        
        console.log(`\nLiczba statystyk: ${result.rows.length}`);
        
    } catch (e) {
        console.error('Błąd:', e);
    } finally {
        client.release();
    }
})();
