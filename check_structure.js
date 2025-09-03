const pool = require('./backend/db/pool');

async function checkStructure() {
    const client = await pool.connect();
    try {
        console.log('=== STRUKTURA TABELI STATISTICS ===');
        const statsDesc = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = $1 
            ORDER BY ordinal_position
        `, ['statistics']);
        statsDesc.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type} (${r.is_nullable})`));
        
        console.log('\n=== PRZYKŁAD DANYCH STATISTICS ===');
        const statsData = await client.query('SELECT * FROM statistics LIMIT 3');
        console.log(statsData.rows);
        
        console.log('\n=== KATEGORIE ===');
        const catData = await client.query('SELECT id, name FROM categories ORDER BY id');
        console.log(catData.rows);
        
        console.log('\n=== PODKATEGORIE ===');
        const subcatData = await client.query('SELECT id, name, category_id FROM subcategories ORDER BY category_id, id');
        console.log(subcatData.rows);
        
        console.log('\n=== PRZYKŁAD TRANSAKCJI Z KATEGORIAMI ===');
        const transData = await client.query(`
            SELECT t.id, t.amount, t.description, c.name as category_name, s.name as subcategory_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN subcategories s ON t.subcategory_id = s.id
            WHERE t.type = 'expense'
            LIMIT 5
        `);
        console.log(transData.rows);
        
    } catch (error) {
        console.error('Błąd:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

checkStructure();
