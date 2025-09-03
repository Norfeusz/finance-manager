// Sprawdź czy aktualizacja statistics rzeczywiście nastąpiła
const pool = require('./backend/db/pool');

async function checkStatsAfterClose() {
    const client = await pool.connect();
    
    try {
        console.log('=== SPRAWDZENIE STATYSTYK PO ZAMKNIĘCIU ===\n');
        
        // Sprawdź miesiące 2025-05 i 2025-06 (które zamknęliśmy)
        const months = ['2025-05', '2025-06'];
        
        for (const monthId of months) {
            // Status miesiąca
            const monthStatus = await client.query('SELECT is_closed FROM months WHERE id = $1', [monthId]);
            
            // Status statystyk
            const statsStatus = await client.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN is_open = true THEN 1 END) as open_count,
                    COUNT(CASE WHEN is_open = false THEN 1 END) as closed_count
                FROM statistics 
                WHERE month_id = $1
            `, [monthId]);
            
            console.log(`Miesiąc ${monthId}:`);
            console.log(`  months.is_closed: ${monthStatus.rows[0]?.is_closed}`);
            console.log(`  statistics: ${statsStatus.rows[0].open_count} otwartych, ${statsStatus.rows[0].closed_count} zamkniętych z ${statsStatus.rows[0].total} łącznie`);
            
            // Sprawdź czy są zsynchronizowane
            const isClosed = monthStatus.rows[0]?.is_closed;
            const statsMatch = isClosed ? 
                (statsStatus.rows[0].open_count === 0 && statsStatus.rows[0].closed_count > 0) :
                (statsStatus.rows[0].open_count > 0 && statsStatus.rows[0].closed_count === 0);
            
            console.log(`  Status: ${statsMatch ? '✓ zsynchronizowany' : '✗ niezsynchronizowany'}\n`);
        }
        
    } catch (error) {
        console.error('Błąd:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

checkStatsAfterClose();
