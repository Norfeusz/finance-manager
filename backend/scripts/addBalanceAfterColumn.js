const pool = require('../db/pool');

/**
 * Funkcja dodająca kolumnę balance_after do tabeli transactions
 */
async function addBalanceAfterColumn() {
  const client = await pool.connect();
  
  try {
    console.log('Sprawdzanie czy kolumna balance_after istnieje w tabeli transactions...');
    
    // Sprawdź czy kolumna już istnieje
    const columnExistsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' AND column_name = 'balance_after'
    `;
    
    const columnResult = await client.query(columnExistsQuery);
    
    if (columnResult.rows.length > 0) {
      console.log('Kolumna balance_after już istnieje w tabeli transactions.');
      return;
    }
    
    // Rozpocznij transakcję
    await client.query('BEGIN');
    
    try {
      console.log('Dodawanie kolumny balance_after do tabeli transactions...');
      
      // Dodaj kolumnę balance_after do tabeli transactions
      await client.query(`
        ALTER TABLE transactions 
        ADD COLUMN balance_after NUMERIC(12,2)
      `);
      
      console.log('Kolumna balance_after dodana pomyślnie do tabeli transactions.');
      
      // Zatwierdź transakcję
      await client.query('COMMIT');
    } catch (err) {
      // Wycofaj transakcję w przypadku błędu
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Błąd podczas dodawania kolumny balance_after:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Uruchomienie funkcji
addBalanceAfterColumn()
  .then(() => {
    console.log('Dodawanie kolumny zakończone.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Błąd podczas wykonywania migracji:', err);
    process.exit(1);
  });
