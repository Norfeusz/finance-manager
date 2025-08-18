const pool = require('../db/pool');

/**
 * Skrypt czyszczący nieużywane konta w bazie danych
 */
async function cleanupAccounts() {
  const client = await pool.connect();
  
  try {
    console.log('Czyszczenie nieużywanych kont...');
    await client.query('BEGIN');

    // Usunięcie niechcianych kont
    const result = await client.query(`
      DELETE FROM accounts 
      WHERE name IN ('Konto bankowe', 'Kredyt', 'Oszczędności', 'Główne', 'wspólne') 
      AND name NOT IN ('Wspólne', 'Gotówka', 'Oszczędnościowe', 'Rachunki', 'KWNR')
    `);
    
    console.log(`Usunięto ${result.rowCount} niepotrzebnych kont`);
    
    // Upewnienie się, że pozostały tylko wymagane konta
    const requiredAccounts = ['Wspólne', 'Gotówka', 'Oszczędnościowe', 'Rachunki', 'KWNR'];
    
    for (const accountName of requiredAccounts) {
      const accountCheck = await client.query('SELECT id FROM accounts WHERE name = $1', [accountName]);
      
      if (accountCheck.rows.length === 0) {
        await client.query('INSERT INTO accounts (name) VALUES ($1)', [accountName]);
        console.log(`- Utworzono brakujące konto: ${accountName}`);
      }
    }
    
    // Ustaw początkowe salda dla kont
    await client.query(`
      INSERT INTO account_balances (account_id, initial_balance, current_balance)
      SELECT id, 
        CASE 
          WHEN name = 'Wspólne' THEN 85.65
          WHEN name = 'Oszczędnościowe' THEN 970.71
          ELSE 0
        END AS initial_balance,
        CASE 
          WHEN name = 'Wspólne' THEN 85.65
          WHEN name = 'Oszczędnościowe' THEN 970.71
          ELSE 0
        END AS current_balance
      FROM accounts
      WHERE name IN ('Wspólne', 'Gotówka', 'Oszczędnościowe', 'Rachunki', 'KWNR')
      ON CONFLICT (account_id) DO UPDATE SET
        initial_balance = EXCLUDED.initial_balance,
        current_balance = EXCLUDED.current_balance
    `);
    
    await client.query('COMMIT');
    console.log('Operacja czyszczenia kont zakończona pomyślnie');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Błąd podczas czyszczenia kont:', error);
  } finally {
    client.release();
  }
}

// Wykonaj skrypt
cleanupAccounts().then(() => {
  console.log('Skrypt czyszczenia kont zakończony');
  process.exit(0);
}).catch(err => {
  console.error('Błąd podczas wykonywania skryptu:', err);
  process.exit(1);
});
