const pool = require('../db/pool');

async function addSourceAccountColumns() {
    console.log('Dodawanie kolumn source_account_id i source_account_name do tabeli transactions...');
    const client = await pool.connect();
    
    try {
        // Sprawdź czy kolumna source_account_id już istnieje
        const checkColumnQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' 
            AND column_name = 'source_account_id'
        `;
        
        const checkResult = await client.query(checkColumnQuery);
        
        if (checkResult.rows.length === 0) {
            console.log('Kolumna source_account_id nie istnieje. Dodaję kolumny...');
            
            // Dodaj kolumnę source_account_id
            await client.query(`
                ALTER TABLE transactions 
                ADD COLUMN source_account_id INT REFERENCES accounts(id)
            `);
            
            console.log('Dodano kolumnę source_account_id.');
            
            // Dodaj kolumnę source_account_name
            await client.query(`
                ALTER TABLE transactions 
                ADD COLUMN source_account_name VARCHAR(255)
            `);
            
            console.log('Dodano kolumnę source_account_name.');
            
            console.log('Kolumny zostały dodane pomyślnie.');
        } else {
            console.log('Kolumny już istnieją. Nic nie zmieniono.');
        }
    } catch (error) {
        console.error('Wystąpił błąd podczas dodawania kolumn:', error);
    } finally {
        client.release();
    }
}

// Uruchom funkcję
addSourceAccountColumns()
    .then(() => {
        console.log('Skrypt zakończył działanie.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Błąd podczas wykonywania skryptu:', err);
        process.exit(1);
    });
