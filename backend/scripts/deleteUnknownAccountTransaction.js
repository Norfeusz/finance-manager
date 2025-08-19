// Skrypt do usunięcia nieprawidłowej transakcji do Nieznanego konta
const pool = require('../db/pool');

async function deleteUnknownAccountTransaction() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Znajdź ID miesiąca sierpień 2025
    const monthResult = await client.query(
      'SELECT id FROM months WHERE year = $1 AND month = $2',
      [2025, 8] // 8 to sierpień
    );
    
    if (monthResult.rows.length === 0) {
      console.log('Nie znaleziono miesiąca sierpień 2025 w bazie danych.');
      await client.query('COMMIT');
      return;
    }
    
    const monthId = monthResult.rows[0].id;
    console.log(`Znaleziono miesiąc sierpień 2025 o ID: ${monthId}`);
    
    // Wylistuj wszystkie transakcje z sierpnia 2025 by znaleźć nieprawidłową transakcję
    console.log('\nLista wszystkich transakcji z sierpnia 2025:');
    const transactionsResult = await client.query(`
      SELECT 
        t.id, 
        t.type, 
        t.amount, 
        a.name as account_name, 
        t.description, 
        t.date::text
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.month_id = $1
      ORDER BY t.date, t.id
    `, [monthId]);
    
    transactionsResult.rows.forEach(t => {
      console.log(`ID: ${t.id}, Typ: ${t.type}, Konto: ${t.account_name}, Kwota: ${t.amount}, Data: ${t.date}, Opis: ${t.description || '(brak)'}`);
    });
    
    // Znajdź transakcję z "Nieznane konto" z 18.08.2025 z kwotą -53.99
    const badTransactionResult = await client.query(`
      SELECT t.id, t.account_id, t.amount
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.month_id = $1
      AND t.type = 'transfer'
      AND t.description LIKE '%Nieznane konto%'
      AND t.amount::text LIKE '%53.99%'
    `, [monthId]);
    
    if (badTransactionResult.rows.length === 0) {
      console.log('\nNie znaleziono nieprawidłowej transakcji do Nieznanego konta.');
      await client.query('ROLLBACK');
      return;
    }
    
    const badTransaction = badTransactionResult.rows[0];
    console.log(`\nZnaleziono nieprawidłową transakcję ID: ${badTransaction.id}`);
    
    // Przywróć saldo konta
    await client.query(`
      UPDATE account_balances
      SET current_balance = current_balance + $1,
          last_updated = NOW()
      WHERE account_id = $2
    `, [parseFloat(badTransaction.amount), badTransaction.account_id]);
    
    console.log(`Przywrócono ${badTransaction.amount} zł na konto (ID: ${badTransaction.account_id}).`);
    
    // Usuń nieprawidłową transakcję
    const deleteResult = await client.query(
      'DELETE FROM transactions WHERE id = $1 RETURNING id',
      [badTransaction.id]
    );
    
    console.log(`\nUsunięto transakcję o ID ${deleteResult.rows[0].id}.`);
    
    // Pobierz stany kont po usunięciu transakcji
    const updatedAccountsResult = await client.query(`
      SELECT ab.account_id, a.name, ab.current_balance
      FROM account_balances ab
      JOIN accounts a ON ab.account_id = a.id
    `);
    
    console.log("\nStany kont po usunięciu transakcji:");
    updatedAccountsResult.rows.forEach(acc => {
      console.log(`${acc.name}: ${acc.current_balance}`);
    });
    
    await client.query('COMMIT');
    console.log('\nOperacja zakończona pomyślnie.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Wystąpił błąd podczas usuwania transakcji:', error);
    console.error(error.stack);
  } finally {
    client.release();
  }
}

// Wykonaj funkcję
deleteUnknownAccountTransaction()
  .then(() => {
    console.log('Skrypt zakończył działanie.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Błąd krytyczny:', err);
    process.exit(1);
  });
