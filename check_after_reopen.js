// Sprawdzenie statusu po otwarciu miesiąca
const pool = require('./backend/db/pool');

async function checkAfterReopen() {
    const client = await pool.connect();
    
    try {
        console.log('=== SPRAWDZENIE PO OTWARCIU MIESIĄCA 2025-05 ===\n');
        
        const monthStatus = await client.query('SELECT is_closed FROM months WHERE id = $1', ['2025-05']);
        const statsStatus = await client.query(`
            SELECT 
                COUNT(CASE WHEN is_open = true THEN 1 END) as open_count,
                COUNT(CASE WHEN is_open = false THEN 1 END) as closed_count
            FROM statistics 
            WHERE month_id = $1
        `, ['2025-05']);
        
        console.log('Miesiąc 2025-05 po otwarciu:');
        console.log(`  months.is_closed: ${monthStatus.rows[0]?.is_closed}`);
        console.log(`  statistics: ${statsStatus.rows[0].open_count} otwartych, ${statsStatus.rows[0].closed_count} zamkniętych`);
        
        // Sprawdź czy są zsynchronizowane
        const isClosed = monthStatus.rows[0]?.is_closed;
        const openCount = parseInt(statsStatus.rows[0].open_count);
        const closedCount = parseInt(statsStatus.rows[0].closed_count);
        
        const isCorrect = !isClosed && openCount > 0 && closedCount === 0;
        console.log(`  Status: ${isCorrect ? '✓ POPRAWNIE ZSYNCHRONIZOWANY' : '✗ błąd synchronizacji'}`);
        
    } catch (error) {
        console.error('Błąd:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

checkAfterReopen();
