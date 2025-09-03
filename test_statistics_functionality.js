const pool = require('./backend/db/pool');

async function testStatisticsUpdate() {
    const client = await pool.connect();
    try {
        console.log('=== TEST AKTUALIZACJI STATYSTYK ===');
        
        // 1. Sprawdź obecny stan statystyk dla sierpnia 2025
        const monthId = '2025-08';
        console.log(`\n--- Stan statystyk przed testem (${monthId}) ---`);
        
        const beforeStats = await client.query(`
            SELECT category, subcategory, amount 
            FROM statistics 
            WHERE month_id = $1 
            ORDER BY category, subcategory
        `, [monthId]);
        
        console.log('Statystyki przed:', beforeStats.rows.slice(0, 5)); // pokazuj tylko pierwsze 5
        
        // 2. Dodaj testowy wydatek w kategorii "zakupy codzienne" z podkategorią "jedzenie"
        const testExpenseData = {
            flowType: 'expense',
            data: {
                account: 'Gabi',
                cost: '50.00',
                category: 'zakupy codzienne',
                subcategory: 'jedzenie',
                description: 'test statystyk',
                extraDescription: '',
                date: '2025-08-15',
                balanceOption: 'Zwiększamy budżet',
                isKwnrTransfer: false,
                isKwnrExpense: false
            }
        };
        
        console.log('\n--- Symulacja dodania wydatku ---');
        console.log('Wydatek:', JSON.stringify(testExpenseData, null, 2));
        
        // Wywołaj funkcję dodania przez API (symulowane)
        const response = await fetch('http://localhost:3001/api/transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([testExpenseData])
        });
        
        if (response.ok) {
            console.log('✅ Wydatek został dodany');
            
            // 3. Sprawdź stan po dodaniu
            console.log('\n--- Stan statystyk po dodaniu wydatku ---');
            const afterStats = await client.query(`
                SELECT category, subcategory, amount 
                FROM statistics 
                WHERE month_id = $1 AND (category = 'ZC' OR category = 'zakupy codzienne')
                ORDER BY category, subcategory
            `, [monthId]);
            
            console.log('Statystyki po dodaniu:', afterStats.rows);
            
            // 4. Znajdź dodaną transakcję i usuń ją
            const addedTransaction = await client.query(`
                SELECT id FROM transactions 
                WHERE description = 'test statystyk' AND amount = 50.00
                ORDER BY id DESC LIMIT 1
            `);
            
            if (addedTransaction.rows.length > 0) {
                const transactionId = addedTransaction.rows[0].id;
                console.log(`\n--- Usuwanie testowej transakcji ID: ${transactionId} ---`);
                
                const deleteResponse = await fetch('http://localhost:3001/api/transactions', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ id: transactionId })
                });
                
                if (deleteResponse.ok) {
                    console.log('✅ Transakcja została usunięta');
                    
                    // 5. Sprawdź stan końcowy
                    console.log('\n--- Stan statystyk po usunięciu ---');
                    const finalStats = await client.query(`
                        SELECT category, subcategory, amount 
                        FROM statistics 
                        WHERE month_id = $1 AND (category = 'ZC' OR category = 'zakupy codzienne')
                        ORDER BY category, subcategory
                    `, [monthId]);
                    
                    console.log('Statystyki końcowe:', finalStats.rows);
                } else {
                    console.log('❌ Błąd podczas usuwania transakcji');
                }
            }
        } else {
            console.log('❌ Błąd podczas dodawania wydatku:', await response.text());
        }
        
    } catch (error) {
        console.error('Błąd testu:', error);
    } finally {
        client.release();
    }
}

// Sprawdź czy serwer działa i uruchom test
async function runTest() {
    try {
        const healthCheck = await fetch('http://localhost:3001/health');
        if (healthCheck.ok) {
            console.log('✅ Serwer działa, rozpoczynam test...');
            await testStatisticsUpdate();
        } else {
            console.log('❌ Serwer nie odpowiada. Uruchom serwer: npm start');
        }
    } catch (error) {
        console.log('❌ Nie można połączyć się z serwerem. Uruchom serwer: npm start');
        console.log('Błąd:', error.message);
    }
    
    process.exit(0);
}

runTest();
