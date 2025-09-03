// Debugowanie logiki sprawdzania synchronizacji
const pool = require('./backend/db/pool');

async function debugSync() {
    const client = await pool.connect();
    
    try {
        console.log('=== DEBUG LOGIKI SYNCHRONIZACJI ===\n');
        
        const monthId = '2025-05';
        
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
        
        const isClosed = monthStatus.rows[0]?.is_closed;
        const openCount = parseInt(statsStatus.rows[0].open_count);
        const closedCount = parseInt(statsStatus.rows[0].closed_count);
        
        console.log(`Miesiąc ${monthId}:`);
        console.log(`  isClosed: ${isClosed} (type: ${typeof isClosed})`);
        console.log(`  openCount: ${openCount} (type: ${typeof openCount})`);
        console.log(`  closedCount: ${closedCount} (type: ${typeof closedCount})`);
        
        console.log('\nLogika sprawdzania:');
        if (isClosed) {
            console.log('  Miesiąc jest zamknięty, sprawdzam czy:');
            console.log(`    openCount === 0: ${openCount === 0}`);
            console.log(`    closedCount > 0: ${closedCount > 0}`);
            const statsMatch = (openCount === 0 && closedCount > 0);
            console.log(`    Wynik: ${statsMatch}`);
        } else {
            console.log('  Miesiąc jest otwarty, sprawdzam czy:');
            console.log(`    openCount > 0: ${openCount > 0}`);
            console.log(`    closedCount === 0: ${closedCount === 0}`);
            const statsMatch = (openCount > 0 && closedCount === 0);
            console.log(`    Wynik: ${statsMatch}`);
        }
        
    } catch (error) {
        console.error('Błąd:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

debugSync();
