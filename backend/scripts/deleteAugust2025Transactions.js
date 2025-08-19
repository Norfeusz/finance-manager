// Skrypt do usunięcia nieprawidłowych transferów dla miesiąca sierpień 2025
const pool = require('../db/pool');

async function deleteAugust2025Transactions() {
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
    
    // Pobierz informacje o transakcjach do logowania
    const transactionsResult = await client.query(
      `SELECT t.id, t.type, t.amount, a.name as account_name, t.description, t.date
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.month_id = $1`,
      [monthId]
    );
    
    const transactionCount = transactionsResult.rows.length;
    console.log(`Znaleziono ${transactionCount} transakcji do usunięcia.`);
    
    if (transactionCount > 0) {
      console.log('Przykładowe transakcje do usunięcia:');
      transactionsResult.rows.slice(0, 5).forEach(t => {
        console.log(`ID: ${t.id}, Typ: ${t.type}, Konto: ${t.account_name}, Kwota: ${t.amount}, Data: ${t.date.toLocaleDateString()}, Opis: ${t.description || '(brak)'}`);
      });
      
      // 1. Pobierz aktualne stany kont przed zmianami
      const accountsResult = await client.query(`
        SELECT ab.account_id, a.name, ab.current_balance
        FROM account_balances ab
        JOIN accounts a ON ab.account_id = a.id
      `);
      
      console.log("\nAktualne stany kont przed zmianami:");
      accountsResult.rows.forEach(acc => {
        console.log(`${acc.name}: ${acc.current_balance}`);
      });
      
      // 2. Pobierz tylko transakcję do "Nieznane konto" z sierpnia 2025
      const detailedTransactionsResult = await client.query(`
        SELECT 
          t.id, 
          t.type, 
          t.amount, 
          t.account_id, 
          a.name as account_name, 
          t.description, 
          t.extra_description,
          t.date
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE t.month_id = $1
        AND t.type = 'transfer'
        AND t.description = '→ Nieznane konto'
        ORDER BY t.date, t.id
      `, [monthId]);
      
      console.log(`\nPrzywracam stany kont dla ${detailedTransactionsResult.rowCount} transakcji do Nieznanego konta...`);
      
      // 3. Iteruj przez każdą znalezioną transakcję i wycofaj jej efekt na saldo konta
      for (const transaction of detailedTransactionsResult.rows) {
        const { id, type, amount, account_id, account_name, description, extra_description } = transaction;
        
        if (type === 'expense') {
          // Dla wydatku: przywróć środki na konto (dodaj kwotę)
          await client.query(`
            UPDATE account_balances
            SET current_balance = current_balance + $1,
                last_updated = NOW()
            WHERE account_id = $2
          `, [parseFloat(amount), account_id]);
          
          console.log(`Przywrócono ${amount} na konto ${account_name} (ID: ${account_id}) z wydatku ID: ${id}`);
          
          // Sprawdź czy to wydatek z konta Gabi lub Norf - wtedy trzeba wycofać automatyczny wpływ na konto Wspólne
          if (account_name === 'Gabi' || account_name === 'Norf') {
            // Znajdź powiązany automatyczny wpływ
            const autoIncomeResult = await client.query(`
              SELECT t.id, t.amount, t.account_id, a.name as target_account_name
              FROM transactions t
              JOIN accounts a ON t.account_id = a.id
              WHERE t.month_id = $1
              AND t.type = 'income' 
              AND t.description LIKE $2
              AND t.extra_description LIKE $3
            `, [
              monthId, 
              `Zwrot od: ${account_name}%`,
              `%Automatycznie wygenerowane%${account_name}%`
            ]);
            
            if (autoIncomeResult.rows.length > 0) {
              const autoIncome = autoIncomeResult.rows[0];
              
              // Odejmij kwotę automatycznego wpływu z konta docelowego (zwykle Wspólne)
              await client.query(`
                UPDATE account_balances
                SET current_balance = current_balance - $1,
                    last_updated = NOW()
                WHERE account_id = $2
              `, [parseFloat(autoIncome.amount), autoIncome.account_id]);
              
              console.log(`Wycofano automatyczny wpływ ${autoIncome.amount} z konta ${autoIncome.target_account_name} (ID: ${autoIncome.account_id})`);
            }
          }
        } 
        else if (type === 'income') {
          // Dla wpływu: odejmij środki z konta
          await client.query(`
            UPDATE account_balances
            SET current_balance = current_balance - $1,
                last_updated = NOW()
            WHERE account_id = $2
          `, [parseFloat(amount), account_id]);
          
          console.log(`Odjęto ${amount} z konta ${account_name} (ID: ${account_id}) z wpływu ID: ${id}`);
        }
        else if (type === 'transfer' || type === 'transfer_in') {
          // Dla transferów nic nie robimy - są one już bilansowane w parach
          console.log(`Pomijam transfer ID: ${id}, kwota: ${amount}, konto: ${account_name}`);
        }
      }
      // Pobierz stany kont po przywróceniu transakcji
      const updatedAccountsResult = await client.query(`
        SELECT ab.account_id, a.name, ab.current_balance
        FROM account_balances ab
        JOIN accounts a ON ab.account_id = a.id
      `);
      
      console.log("\nStany kont po wycofaniu transakcji:");
      updatedAccountsResult.rows.forEach(acc => {
        console.log(`${acc.name}: ${acc.current_balance}`);
      });
      
      // Usuń tylko transakcję transferu do "Nieznane konto"
      const deleteResult = await client.query(
        `DELETE FROM transactions 
         WHERE month_id = $1 
         AND type = 'transfer' 
         AND description = '→ Nieznane konto'
         RETURNING id`,
        [monthId]
      );
      
      console.log(`\nUsunięto ${deleteResult.rowCount} transakcji do Nieznanego konta dla miesiąca sierpień 2025.`);
      
      // Opcjonalnie, jeśli chcesz również usunąć miesiąc z tabeli months
      // await client.query('DELETE FROM months WHERE id = $1', [monthId]);
      // console.log(`Usunięto miesiąc o ID ${monthId}.`);
    } else {
      console.log('Brak transakcji do usunięcia.');
    }
    
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
deleteAugust2025Transactions()
  .then(() => {
    console.log('Skrypt zakończył działanie.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Błąd krytyczny:', err);
    process.exit(1);
  });
