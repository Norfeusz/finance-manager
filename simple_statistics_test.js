const pool = require('./backend/db/pool');

async function simpleTest() {
    try {
        console.log('=== PROSTY TEST AKTUALIZACJI STATYSTYK ===');
        
        // 1. Sprawdź stan przed testem  
        const client = await pool.connect();
        const monthId = '2025-08';
        
        const beforeStats = await client.query(`
            SELECT category, subcategory, amount 
            FROM statistics 
            WHERE month_id = $1 AND category = 'ZC' AND subcategory = 'jedzenie'
        `, [monthId]);
        
        console.log('Stan przed:', beforeStats.rows);
        
        // 2. Symuluj dodanie wydatku bezpośrednio
        console.log('\n--- Testowanie funkcji updateStatistics ---');
        
        // Znajdź ID kategorii "zakupy codzienne" i podkategorii "jedzenie"
        const categoryRes = await client.query(`SELECT id FROM categories WHERE name = $1`, ['zakupy codzienne']);
        const subcategoryRes = await client.query(`SELECT id FROM subcategories WHERE name = $1`, ['jedzenie']);
        
        if (categoryRes.rows.length > 0 && subcategoryRes.rows.length > 0) {
            const categoryId = categoryRes.rows[0].id;
            const subcategoryId = subcategoryRes.rows[0].id;
            const testAmount = 25.50;
            
            console.log(`Category ID: ${categoryId}, Subcategory ID: ${subcategoryId}`);
            
            // Sprawdź czy miesiąc 2025-08 ma już jakieś statystyki
            const monthStatsCount = await client.query(`SELECT COUNT(*) FROM statistics WHERE month_id = $1`, [monthId]);
            console.log(`Liczba rekordów statystyk dla ${monthId}:`, monthStatsCount.rows[0].count);
            
            if (monthStatsCount.rows[0].count === '0') {
                console.log('Brak statystyk dla sierpnia 2025 - dodaję przykładowy rekord');
                await client.query(`
                    INSERT INTO statistics (month_id, category, subcategory, amount, last_edited, is_open)
                    VALUES ($1, $2, $3, $4, NOW(), true)
                `, [monthId, 'ZC', 'jedzenie', 0]);
            }
            
            // Przetestuj funkcję updateStatistics - symulacja
            console.log('\n--- Symulacja aktualizacji statystyk ---');
            
            // Znajdź rekord do aktualizacji
            const existingRecord = await client.query(`
                SELECT id, amount FROM statistics 
                WHERE month_id = $1 AND category = $2 AND subcategory = $3
            `, [monthId, 'ZC', 'jedzenie']);
            
            if (existingRecord.rows.length > 0) {
                const currentAmount = parseFloat(existingRecord.rows[0].amount);
                const newAmount = currentAmount + testAmount;
                
                await client.query(`
                    UPDATE statistics 
                    SET amount = $1, last_edited = NOW() 
                    WHERE id = $2
                `, [newAmount, existingRecord.rows[0].id]);
                
                console.log(`✅ Zaktualizowano: ${currentAmount} + ${testAmount} = ${newAmount}`);
                
                // Sprawdź stan po aktualizacji
                const afterStats = await client.query(`
                    SELECT category, subcategory, amount 
                    FROM statistics 
                    WHERE month_id = $1 AND category = 'ZC' AND subcategory = 'jedzenie'
                `, [monthId]);
                
                console.log('Stan po aktualizacji:', afterStats.rows);
                
                // Przywróć stan pierwotny
                await client.query(`
                    UPDATE statistics 
                    SET amount = $1, last_edited = NOW() 
                    WHERE id = $2
                `, [currentAmount, existingRecord.rows[0].id]);
                
                console.log(`✅ Przywrócono pierwotny stan: ${newAmount} -> ${currentAmount}`);
            } else {
                console.log('❌ Nie znaleziono rekordu do aktualizacji');
            }
        } else {
            console.log('❌ Nie znaleziono kategorii lub podkategorii');
        }
        
        client.release();
        console.log('\n=== TEST ZAKOŃCZONY ===');
        
    } catch (error) {
        console.error('Błąd testu:', error);
    }
    
    process.exit(0);
}

simpleTest();
