// Sprawdzenie bieżącego statusu is_open
const pool = require('./backend/db/pool');

async function checkCurrentStatus() {
    const client = await pool.connect();
    
    try {
        console.log('=== SPRAWDZENIE BIEŻĄCEGO STATUSU ===\n');
        
        // Sprawdź miesiąc 2025-08
        const stats2025_08 = await client.query('SELECT * FROM statistics WHERE month_id = $1 ORDER BY category', ['2025-08']);
        console.log(`Statistics dla 2025-08: ${stats2025_08.rows.length} rekordów`);
        
        if (stats2025_08.rows.length > 0) {
            console.log('Rekordy dla 2025-08:');
            stats2025_08.rows.forEach(row => {
                console.log(`  ${row.category} | ${row.subcategory || 'NULL'} | is_open: ${row.is_open}`);
            });
        } else {
            console.log('Brak rekordów dla 2025-08 - miesiąc nie został zainicjalizowany');
        }
        
        // Sprawdź który miesiąc powinien być otwarty
        console.log('\n=== AKTUALIZACJA STATUSU ===');
        console.log('Zakładam, że miesiąc 2025-08 powinien być otwarty (is_open = true)');
        
        // Ustaw wszystkie miesiące jako zamknięte, tylko 2025-08 jako otwarty
        await client.query('UPDATE statistics SET is_open = false');
        console.log('Ustawiono wszystkie statystyki jako zamknięte');
        
        // Jeśli 2025-08 nie ma rekordów, nie będzie co aktualizować
        if (stats2025_08.rows.length > 0) {
            await client.query('UPDATE statistics SET is_open = true WHERE month_id = $1', ['2025-08']);
            console.log('Ustawiono statystyki dla 2025-08 jako otwarte');
        }
        
        // Sprawdź końcowy stan
        const finalCheck = await client.query(`
            SELECT month_id, COUNT(*) as total, COUNT(CASE WHEN is_open THEN 1 END) as open_count
            FROM statistics 
            GROUP BY month_id 
            ORDER BY month_id
        `);
        
        console.log('\nKońcowy stan:');
        finalCheck.rows.forEach(row => {
            console.log(`  ${row.month_id}: ${row.open_count}/${row.total} otwartych`);
        });
        
    } catch (error) {
        console.error('Błąd:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

checkCurrentStatus();
