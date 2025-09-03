// Test funkcjonalności is_open w tabeli statistics
const pool = require('./backend/db/pool');

async function testIsOpenFunctionality() {
    const client = await pool.connect();
    
    try {
        console.log('=== TEST FUNKCJONALNOŚCI IS_OPEN ===\n');
        
        // 1. Sprawdź istniejące rekordy w statistics
        console.log('1. Sprawdzanie istniejących rekordów w statistics:');
        const allStats = await client.query('SELECT month_id, category, subcategory, is_open FROM statistics ORDER BY month_id, category');
        console.log(`Znaleziono ${allStats.rows.length} rekordów w statistics`);
        
        if (allStats.rows.length > 0) {
            console.log('Przykładowe rekordy:');
            allStats.rows.slice(0, 5).forEach(row => {
                console.log(`  ${row.month_id} | ${row.category} | ${row.subcategory || 'NULL'} | is_open: ${row.is_open}`);
            });
        }
        
        // 2. Sprawdź status miesięcy
        console.log('\n2. Sprawdzanie statusu miesięcy:');
        const months = await client.query('SELECT id, is_closed FROM months ORDER BY id');
        console.log('Miesiące:');
        months.rows.forEach(row => {
            console.log(`  ${row.id} | is_closed: ${row.is_closed}`);
        });
        
        // 3. Sprawdź korelację między months.is_closed a statistics.is_open
        console.log('\n3. Sprawdzanie korelacji:');
        const correlation = await client.query(`
            SELECT 
                m.id as month_id,
                m.is_closed as month_closed,
                COUNT(s.id) as stats_count,
                COUNT(CASE WHEN s.is_open = true THEN 1 END) as open_stats,
                COUNT(CASE WHEN s.is_open = false THEN 1 END) as closed_stats
            FROM months m
            LEFT JOIN statistics s ON m.id = s.month_id
            GROUP BY m.id, m.is_closed
            ORDER BY m.id
        `);
        
        console.log('Korelacja month.is_closed vs statistics.is_open:');
        correlation.rows.forEach(row => {
            const expected = row.month_closed ? 'closed' : 'open';
            const actual_open = row.open_stats;
            const actual_closed = row.closed_stats;
            const status = row.month_closed ? 
                (actual_closed > 0 && actual_open === 0 ? '✓' : '✗') :
                (actual_open > 0 && actual_closed === 0 ? '✓' : '✗');
            
            console.log(`  ${row.month_id} | month_closed: ${row.month_closed} | stats: ${actual_open} open, ${actual_closed} closed | ${status}`);
        });
        
        console.log('\n=== TEST ZAKOŃCZONY ===');
        
    } catch (error) {
        console.error('Błąd podczas testowania:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

testIsOpenFunctionality();
