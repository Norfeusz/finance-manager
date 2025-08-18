// Skrypt do zresetowania sald kont do ich początkowych wartości
const pool = require('../db/pool');

async function resetAccountBalances() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Rozpoczynam resetowanie sald kont do wartości początkowych...');
    
    // Pobierz aktualne stany kont przed zmianami
    const beforeAccountsResult = await client.query(`
      SELECT ab.id, ab.account_id, a.name, ab.initial_balance, ab.current_balance
      FROM account_balances ab
      JOIN accounts a ON ab.account_id = a.id
      ORDER BY a.name
    `);
    
    console.log("\nAktualne stany kont przed resetowaniem:");
    beforeAccountsResult.rows.forEach(acc => {
      console.log(`${acc.name}: ${acc.current_balance} (początkowe: ${acc.initial_balance})`);
    });
    
    // Początkowe wartości sald dla standardowych kont
    const defaultBalances = {
      'Wspólne': 85.65,
      'Oszczędnościowe': 970.71,
      'Gotówka': 0,
      'Rachunki': 0,
      'KWNR': 0,
      'Gabi': 0,
      'Norf': 0
    };
    
    // Aktualizuj salda kont
    for (const account of beforeAccountsResult.rows) {
      // Jeśli konto znajduje się w liście domyślnych wartości, użyj tych wartości
      // W przeciwnym razie ustaw initial_balance jako current_balance
      const defaultBalance = defaultBalances[account.name] !== undefined 
        ? defaultBalances[account.name] 
        : account.initial_balance;
      
      await client.query(`
        UPDATE account_balances
        SET current_balance = $1,
            initial_balance = $1,
            last_updated = NOW()
        WHERE account_id = $2
      `, [defaultBalance, account.account_id]);
      
      console.log(`Zresetowano saldo konta ${account.name} do wartości: ${defaultBalance}`);
    }
    
    // Sprawdź, czy jakieś konta nie mają wpisów w tabeli account_balances
    // i dodaj je jeśli potrzeba
    const accountsWithoutBalances = await client.query(`
      SELECT a.id, a.name
      FROM accounts a
      LEFT JOIN account_balances ab ON a.id = ab.account_id
      WHERE ab.id IS NULL
    `);
    
    if (accountsWithoutBalances.rows.length > 0) {
      console.log("\nZnaleziono konta bez wpisu w tabeli account_balances:");
      
      for (const account of accountsWithoutBalances.rows) {
        const defaultBalance = defaultBalances[account.name] !== undefined 
          ? defaultBalances[account.name] 
          : 0;
        
        await client.query(`
          INSERT INTO account_balances (account_id, initial_balance, current_balance)
          VALUES ($1, $2, $2)
        `, [account.id, defaultBalance]);
        
        console.log(`Dodano wpis dla konta ${account.name} z saldem: ${defaultBalance}`);
      }
    }
    
    // Pobierz aktualne stany kont po zmianach
    const afterAccountsResult = await client.query(`
      SELECT ab.account_id, a.name, ab.initial_balance, ab.current_balance
      FROM account_balances ab
      JOIN accounts a ON ab.account_id = a.id
      ORDER BY a.name
    `);
    
    console.log("\nStany kont po resetowaniu:");
    afterAccountsResult.rows.forEach(acc => {
      console.log(`${acc.name}: ${acc.current_balance} (początkowe: ${acc.initial_balance})`);
    });
    
    await client.query('COMMIT');
    console.log('\nOperacja zakończona pomyślnie.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Wystąpił błąd podczas resetowania sald kont:', error);
    console.error(error.stack);
  } finally {
    client.release();
  }
}

// Wykonaj funkcję
resetAccountBalances()
  .then(() => {
    console.log('Skrypt zakończył działanie.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Błąd krytyczny:', err);
    process.exit(1);
  });
