// Skrypt do bezpośredniej aktualizacji salda konta Wspólnego na wartość startową 85,65
const pool = require('../db/pool');

async function fixCommonAccount() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Najpierw sprawdźmy aktualne saldo konta Wspólnego
    const currentBalanceResult = await client.query(`
      SELECT ab.account_id, a.name, ab.initial_balance, ab.current_balance
      FROM account_balances ab
      JOIN accounts a ON ab.account_id = a.id
      WHERE a.name = 'Wspólne'
    `);
    
    if (currentBalanceResult.rows.length === 0) {
      console.log('Nie znaleziono konta o nazwie "Wspólne".');
      await client.query('COMMIT');
      return;
    }
    
    const commonAccount = currentBalanceResult.rows[0];
    console.log(`\nKonto Wspólne (ID: ${commonAccount.account_id}):`);
    console.log(`- Saldo początkowe: ${commonAccount.initial_balance}`);
    console.log(`- Aktualne (niepoprawne) saldo: ${commonAccount.current_balance}`);
    
    // Ustawiamy saldo na wartość startową 85,65
    const correctBalance = 85.65;
      
      // 2. Aktualizuj saldo konta Wspólnego bezpośrednio w bazie danych
      await client.query(`
        UPDATE account_balances
        SET current_balance = $1,
            last_updated = NOW()
        WHERE account_id = $2
      `, [correctBalance, commonAccount.account_id]);
      
      // 3. Sprawdź nowe saldo
      const updatedBalanceResult = await client.query(`
        SELECT ab.current_balance
        FROM account_balances ab
        WHERE ab.account_id = $1
      `, [commonAccount.account_id]);
      
      await client.query('COMMIT');
      
      console.log(`\nSaldo konta Wspólnego zostało zaktualizowane:`);
      console.log(`- Z: ${commonAccount.current_balance}`);
      console.log(`- Na: ${updatedBalanceResult.rows[0].current_balance}`);
      console.log('\nOperacja zakończona pomyślnie.');
      
      readline.close();
      client.release();
      setTimeout(() => process.exit(0), 500);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Wystąpił błąd podczas aktualizacji salda konta:', error);
    client.release();
    process.exit(1);
  }
}

// Uruchom funkcję
fixCommonAccount();
