// Prosty skrypt przywracający wartość konta Wspólnego do 85,65
const pool = require('../db/pool');

async function resetCommonAccount() {
  const client = await pool.connect();
  
  try {
    // Znajdź ID konta Wspólnego
    const accountResult = await client.query(
      "SELECT id FROM accounts WHERE name = 'Wspólne'"
    );
    
    if (accountResult.rows.length === 0) {
      console.log("Konto 'Wspólne' nie istnieje w bazie danych.");
      return;
    }
    
    const commonAccountId = accountResult.rows[0].id;
    
    // Sprawdź aktualne saldo
    const balanceResult = await client.query(
      "SELECT current_balance FROM account_balances WHERE account_id = $1",
      [commonAccountId]
    );
    
    const currentBalance = balanceResult.rows.length > 0 
      ? balanceResult.rows[0].current_balance 
      : 'brak wpisu';
    
    console.log(`Aktualne saldo konta Wspólnego: ${currentBalance}`);
    
    // Aktualizuj saldo do wartości startowej 85.65
    await client.query(
      "UPDATE account_balances SET current_balance = 85.65, last_updated = NOW() WHERE account_id = $1",
      [commonAccountId]
    );
    
    console.log("Saldo konta Wspólnego zostało przywrócone do wartości 85.65");
    
  } catch (error) {
    console.error("Błąd podczas aktualizacji salda konta:", error);
  } finally {
    client.release();
    process.exit(0);
  }
}

resetCommonAccount();
