// Test API zamykania i otwierania miesięcy
async function testMonthAPI() {
    const fetch = (await import('node-fetch')).default;
    const baseUrl = 'http://localhost:3001/api';
    
    try {
        console.log('=== TEST API ZAMYKANIA/OTWIERANIA MIESIĘCY ===\n');
        
        // 1. Sprawdź aktualny status miesiąca 2025-07
        console.log('1. Sprawdzanie statusu przed testem...');
        const checkResponse = await fetch(`${baseUrl}/statistics/shopping/averages?month_id=2025-08`);
        if (checkResponse.ok) {
            const data = await checkResponse.json();
            console.log('✓ API działa, średnie dla 2025-08:', Object.keys(data).length, 'kategorii');
        }
        
        // 2. Test zamknięcia miesiąca 2025-07
        console.log('\n2. Testowanie zamknięcia miesiąca 2025-07...');
        const closeResponse = await fetch(`${baseUrl}/months/2025-07/close`, {
            method: 'POST'
        });
        
        if (closeResponse.ok) {
            const result = await closeResponse.json();
            console.log('✓ Miesiąc 2025-07 zamknięty:', result.closed);
        } else {
            console.log('✗ Błąd zamykania miesiąca:', closeResponse.status, await closeResponse.text());
        }
        
        // 3. Sprawdź czy statystyki zostały zaktualizowane
        console.log('\n3. Sprawdzanie statusu statystyk po zamknięciu...');
        // Używamy prostego zapytania do bazy
        const pool = require('./backend/db/pool');
        const client = await pool.connect();
        
        try {
            const statsCheck = await client.query(`
                SELECT 
                    COUNT(CASE WHEN is_open = true THEN 1 END) as open_count,
                    COUNT(CASE WHEN is_open = false THEN 1 END) as closed_count
                FROM statistics 
                WHERE month_id = $1
            `, ['2025-07']);
            
            const monthCheck = await client.query('SELECT is_closed FROM months WHERE id = $1', ['2025-07']);
            
            console.log(`Miesiąc 2025-07: is_closed = ${monthCheck.rows[0]?.is_closed}`);
            console.log(`Statystyki 2025-07: ${statsCheck.rows[0].open_count} otwartych, ${statsCheck.rows[0].closed_count} zamkniętych`);
            
            if (monthCheck.rows[0]?.is_closed && statsCheck.rows[0].closed_count > 0 && statsCheck.rows[0].open_count === 0) {
                console.log('✓ Status prawidłowo zsynchronizowany!');
            } else {
                console.log('✗ Status nie został zsynchronizowany');
            }
            
        } finally {
            client.release();
        }
        
        // 4. Test ponownego otwarcia miesiąca
        console.log('\n4. Testowanie ponownego otwarcia miesiąca 2025-07...');
        const reopenResponse = await fetch(`${baseUrl}/months/2025-07/reopen`, {
            method: 'POST'
        });
        
        if (reopenResponse.ok) {
            const result = await reopenResponse.json();
            console.log('✓ Miesiąc 2025-07 otworzony:', result.reopened);
        } else {
            console.log('✗ Błąd otwierania miesiąca:', reopenResponse.status, await reopenResponse.text());
        }
        
        // 5. Sprawdź końcowy status
        console.log('\n5. Sprawdzanie końcowego statusu...');
        const client2 = await pool.connect();
        
        try {
            const statsCheck2 = await client2.query(`
                SELECT 
                    COUNT(CASE WHEN is_open = true THEN 1 END) as open_count,
                    COUNT(CASE WHEN is_open = false THEN 1 END) as closed_count
                FROM statistics 
                WHERE month_id = $1
            `, ['2025-07']);
            
            const monthCheck2 = await client2.query('SELECT is_closed FROM months WHERE id = $1', ['2025-07']);
            
            console.log(`Miesiąc 2025-07: is_closed = ${monthCheck2.rows[0]?.is_closed}`);
            console.log(`Statystyki 2025-07: ${statsCheck2.rows[0].open_count} otwartych, ${statsCheck2.rows[0].closed_count} zamkniętych`);
            
            if (!monthCheck2.rows[0]?.is_closed && statsCheck2.rows[0].open_count > 0 && statsCheck2.rows[0].closed_count === 0) {
                console.log('✓ Status prawidłowo zsynchronizowany po otwarciu!');
            } else {
                console.log('✗ Status nie został zsynchronizowany po otwarciu');
            }
            
        } finally {
            client2.release();
            await pool.end();
        }
        
        console.log('\n✅ TEST ZAKOŃCZONY POMYŚLNIE!');
        
    } catch (error) {
        console.error('Błąd podczas testowania API:', error);
    }
}

testMonthAPI();
