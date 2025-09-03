// Sprawdzenie czy miesiąc 2025-08 istnieje i inicjalizacja jeśli potrzeba
const pool = require('./backend/db/pool');

async function initializeMonth() {
    const client = await pool.connect();
    
    try {
        console.log('=== SPRAWDZENIE I INICJALIZACJA MIESIĄCA 2025-08 ===\n');
        
        // Sprawdź czy miesiąc 2025-08 istnieje
        const monthCheck = await client.query('SELECT * FROM months WHERE id = $1', ['2025-08']);
        console.log(`Miesiąc 2025-08: ${monthCheck.rows.length > 0 ? 'istnieje' : 'nie istnieje'}`);
        
        if (monthCheck.rows.length > 0) {
            console.log('Szczegóły miesiąca:', monthCheck.rows[0]);
        }
        
        // Sprawdź statystyki dla 2025-08
        const statsCheck = await client.query('SELECT COUNT(*) FROM statistics WHERE month_id = $1', ['2025-08']);
        console.log(`Statystyki dla 2025-08: ${statsCheck.rows[0].count} rekordów`);
        
        // Jeśli miesiąc istnieje ale nie ma statystyk, zainicjalizuj je
        if (monthCheck.rows.length > 0 && parseInt(statsCheck.rows[0].count) === 0) {
            console.log('\nInicjalizuję statystyki dla miesiąca 2025-08...');
            
            await client.query('BEGIN');
            
            try {
                // Pobierz wszystkie kategorie wydatków
                const categories = await client.query(`
                    SELECT id, name FROM categories 
                    WHERE name NOT IN ('Wpływy') 
                    ORDER BY name
                `);
                
                // Pobierz podkategorie dla "zakupy codzienne" 
                const shoppingCategoryId = await client.query(`
                    SELECT id FROM categories WHERE LOWER(name) = 'zakupy codzienne'
                `);
                
                let subcategories = [];
                if (shoppingCategoryId.rows.length > 0) {
                    const subcatResult = await client.query(`
                        SELECT id, name FROM subcategories 
                        WHERE category_id = $1 
                        ORDER BY name
                    `, [shoppingCategoryId.rows[0].id]);
                    subcategories = subcatResult.rows;
                }
                
                // Wstaw rekordy dla kategorii głównych
                for (const category of categories.rows) {
                    await client.query(`
                        INSERT INTO statistics (month_id, category, subcategory, amount, last_edited, is_open)
                        VALUES ($1, $2, NULL, 0, NOW(), true)
                        ON CONFLICT DO NOTHING
                    `, ['2025-08', category.name]);
                }
                
                // Wstaw rekordy dla podkategorii zakupów codziennych
                for (const subcategory of subcategories) {
                    await client.query(`
                        INSERT INTO statistics (month_id, category, subcategory, amount, last_edited, is_open)
                        VALUES ($1, $2, $3, 0, NOW(), true)
                        ON CONFLICT DO NOTHING
                    `, ['2025-08', 'zakupy codzienne', subcategory.name]);
                }
                
                await client.query('COMMIT');
                console.log(`✓ Zainicjalizowano ${categories.rows.length} kategorii i ${subcategories.length} podkategorii dla miesiąca 2025-08`);
                
                // Sprawdź końcowy stan
                const finalCheck = await client.query('SELECT COUNT(*) FROM statistics WHERE month_id = $1', ['2025-08']);
                console.log(`✓ Końcowy stan: ${finalCheck.rows[0].count} rekordów statystyk dla 2025-08`);
                
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }
        
    } catch (error) {
        console.error('Błąd:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

initializeMonth();
