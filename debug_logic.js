// Debug logiki warunków
const pool = require('./backend/db/pool');

async function debugLogic() {
    const client = await pool.connect();
    
    try {
        const month = await client.query('SELECT is_closed FROM months WHERE id = $1', ['2025-04']);
        const stats = await client.query(`
            SELECT 
                COUNT(CASE WHEN is_open = true THEN 1 END) as open_count,
                COUNT(CASE WHEN is_open = false THEN 1 END) as closed_count
            FROM statistics WHERE month_id = $1
        `, ['2025-04']);
        
        const isClosed = month.rows[0]?.is_closed;
        const openCount = parseInt(stats.rows[0].open_count);
        const closedCount = parseInt(stats.rows[0].closed_count);
        
        console.log('Debug logiki dla 2025-04:');
        console.log('isClosed:', isClosed, '(type:', typeof isClosed, ')');
        console.log('openCount:', openCount, '(type:', typeof openCount, ')');
        console.log('closedCount:', closedCount, '(type:', typeof closedCount, ')');
        console.log('!isClosed:', !isClosed);
        console.log('openCount > 0:', openCount > 0);
        console.log('closedCount === 0:', closedCount === 0);
        console.log('Wynik (!isClosed && openCount > 0 && closedCount === 0):', !isClosed && openCount > 0 && closedCount === 0);
        
    } finally {
        client.release();
        await pool.end();
    }
}

debugLogic();
