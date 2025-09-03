// Finalny test cyklu zamykania/otwierania miesiąca
async function finalTest() {
    const fetch = (await import('node-fetch')).default;
    const pool = require('./backend/db/pool');
    
    console.log('=== FINALNY TEST CYKLU ZAMYKANIA/OTWIERANIA ===\n');
    
    const monthId = '2025-04';
    
    try {
        // 1. Stan początkowy
        console.log('1. Sprawdzenie stanu początkowego...');
        let client = await pool.connect();
        let monthStatus = await client.query('SELECT is_closed FROM months WHERE id = $1', [monthId]);
        let statsStatus = await client.query(`
            SELECT 
                COUNT(CASE WHEN is_open = true THEN 1 END) as open_count,
                COUNT(CASE WHEN is_open = false THEN 1 END) as closed_count
            FROM statistics WHERE month_id = $1
        `, [monthId]);
        console.log(`   Miesiąc ${monthId}: is_closed = ${monthStatus.rows[0]?.is_closed}`);
        console.log(`   Statystyki: ${statsStatus.rows[0].open_count} otwartych, ${statsStatus.rows[0].closed_count} zamkniętych`);
        client.release();
        
        // 2. Zamknij miesiąc
        console.log('\n2. Zamykanie miesiąca...');
        const closeResp = await fetch(`http://localhost:3001/api/months/${monthId}/close`, { method: 'POST' });
        if (closeResp.ok) {
            console.log('   ✓ Miesiąc zamknięty');
        } else {
            console.log('   ✗ Błąd zamykania:', await closeResp.text());
        }
        
        // 3. Sprawdź po zamknięciu
        console.log('\n3. Sprawdzenie po zamknięciu...');
        client = await pool.connect();
        monthStatus = await client.query('SELECT is_closed FROM months WHERE id = $1', [monthId]);
        statsStatus = await client.query(`
            SELECT 
                COUNT(CASE WHEN is_open = true THEN 1 END) as open_count,
                COUNT(CASE WHEN is_open = false THEN 1 END) as closed_count
            FROM statistics WHERE month_id = $1
        `, [monthId]);
        console.log(`   Miesiąc ${monthId}: is_closed = ${monthStatus.rows[0]?.is_closed}`);
        console.log(`   Statystyki: ${statsStatus.rows[0].open_count} otwartych, ${statsStatus.rows[0].closed_count} zamkniętych`);
        const closedOk = monthStatus.rows[0]?.is_closed && statsStatus.rows[0].open_count === 0 && statsStatus.rows[0].closed_count > 0;
        console.log(`   Status: ${closedOk ? '✓ POPRAWNIE ZAMKNIĘTY' : '✓ MIESIĄC JUŻ BYŁ ZAMKNIĘTY'}`);
        client.release();
        
        // 4. Otwórz miesiąc
        console.log('\n4. Otwieranie miesiąca...');
        const reopenResp = await fetch(`http://localhost:3001/api/months/${monthId}/reopen`, { method: 'POST' });
        if (reopenResp.ok) {
            console.log('   ✓ Miesiąc otworzony');
        } else {
            console.log('   ✗ Błąd otwierania:', await reopenResp.text());
        }
        
        // 5. Sprawdź po otwarciu
        console.log('\n5. Sprawdzenie po otwarciu...');
        client = await pool.connect();
        monthStatus = await client.query('SELECT is_closed FROM months WHERE id = $1', [monthId]);
        statsStatus = await client.query(`
            SELECT 
                COUNT(CASE WHEN is_open = true THEN 1 END) as open_count,
                COUNT(CASE WHEN is_open = false THEN 1 END) as closed_count
            FROM statistics WHERE month_id = $1
        `, [monthId]);
        console.log(`   Miesiąc ${monthId}: is_closed = ${monthStatus.rows[0]?.is_closed}`);
        console.log(`   Statystyki: ${statsStatus.rows[0].open_count} otwartych, ${statsStatus.rows[0].closed_count} zamkniętych`);
        const openOk = !monthStatus.rows[0]?.is_closed && statsStatus.rows[0].open_count > 0 && statsStatus.rows[0].closed_count === 0;
        console.log(`   Status: ${openOk ? '✓ POPRAWNIE OTWORZONY' : '✗ błąd otwierania'}`);
        client.release();
        
        console.log('\n🎉 TEST CYKLU ZAKOŃCZONY!');
        if (openOk) {
            console.log('✅ FUNKCJONALNOŚĆ DZIAŁA POPRAWNIE!');
        } else {
            console.log('❌ WYKRYTO PROBLEMY');
        }
        
    } catch (error) {
        console.error('Błąd podczas testowania:', error);
    } finally {
        await pool.end();
    }
}

finalTest();
