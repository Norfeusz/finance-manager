const pool = require('../db/pool');
const fs = require('fs');
const path = require('path');

/**
 * Funkcja do utworzenia tabel w bazie danych
 */
async function createTables() {
  const client = await pool.connect();
  
  try {
    console.log('Tworzenie tabel w bazie danych...');
    
    // Sprawdź czy tabele już istnieją
    const tablesExist = await checkIfTablesExist(client);
    if (tablesExist) {
      console.log('Tabele już istnieją w bazie danych.');
      // Upewnij się, że kolumna is_closed istnieje w months
      try {
        await client.query(`ALTER TABLE months ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE`);
  await client.query(`ALTER TABLE months ADD COLUMN IF NOT EXISTS budget NUMERIC(12,2)`);
      } catch (e) {
        console.error('Nie udało się dodać kolumny is_closed:', e.message);
      }
  // Sprawdź czy tabela account_balances istnieje
      const balancesExist = await checkIfAccountBalancesExist(client);
      if (!balancesExist) {
        // Jeśli tabele główne istnieją, ale nie ma tabeli account_balances, dodaj ją ręcznie
        console.log('Dodawanie tabeli account_balances ręcznie...');
        
        try {
          // Utwórz tabelę account_balances
          await client.query(`
            CREATE TABLE account_balances (
              id SERIAL PRIMARY KEY,
              account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
              initial_balance NUMERIC(12,2) DEFAULT 0,
              current_balance NUMERIC(12,2) DEFAULT 0,
              last_updated TIMESTAMP DEFAULT NOW(),
              UNIQUE(account_id)
            )
          `);
          
          console.log('Tabela account_balances utworzona pomyślnie');
          
          // Utwórz indeks dla wydajności
          await client.query(`
            CREATE INDEX idx_account_balances_account ON account_balances(account_id)
          `);
          
          console.log('Indeks dla account_balances utworzony pomyślnie');
        } catch (error) {
          console.error('Błąd podczas tworzenia tabeli account_balances:', error);
          throw error;
        }
        
        // Dodaj początkowe salda ręcznie, bez używania skryptu SQL
        console.log('Dodawanie początkowych sald kont...');
        
        try {
          // Najpierw znajdź wszystkie istniejące konta
          const existingAccounts = await client.query('SELECT id, name FROM accounts');
          const existingNames = existingAccounts.rows.map(row => row.name);
          
          // Sprawdź, które konta trzeba zaktualizować
          if (existingNames.includes('Główne') && !existingNames.includes('Wspólne')) {
            // Zaktualizuj 'Główne' na 'Wspólne'
            await client.query(`UPDATE accounts SET name = 'Wspólne' WHERE name = 'Główne'`);
            console.log('Zaktualizowano konto: Główne -> Wspólne');
          }
          
          // Zaktualizuj pozostałe konta, jeśli istnieją
          const mappings = {
            'Konto bankowe': 'Gotówka',
            'Oszczędności': 'Oszczędnościowe'
          };
          
          for (const [oldName, newName] of Object.entries(mappings)) {
            if (existingNames.includes(oldName) && !existingNames.includes(newName)) {
              await client.query('UPDATE accounts SET name = $1 WHERE name = $2', [newName, oldName]);
              console.log(`Zaktualizowano konto: ${oldName} -> ${newName}`);
            }
          }
          
          // Znajdź ID kont
          const commonAccountRes = await client.query("SELECT id FROM accounts WHERE name = 'Wspólne'");
          const cashAccountRes = await client.query("SELECT id FROM accounts WHERE name = 'Gotówka'");
          const savingsAccountRes = await client.query("SELECT id FROM accounts WHERE name = 'Oszczędnościowe'");
          const billsAccountRes = await client.query("SELECT id FROM accounts WHERE name = 'Rachunki'");
          const kwnrAccountRes = await client.query("SELECT id FROM accounts WHERE name = 'KWNR'");
          
          // Jeśli konta istnieją, dodaj ich początkowe salda
          if (commonAccountRes.rows.length > 0) {
            await client.query(`
              INSERT INTO account_balances (account_id, initial_balance, current_balance) 
              VALUES ($1, 85.65, 85.65)
              ON CONFLICT (account_id) DO NOTHING
            `, [commonAccountRes.rows[0].id]);
            console.log('Dodano saldo dla konta Wspólne');
          }
          
          if (cashAccountRes.rows.length > 0) {
            await client.query(`
              INSERT INTO account_balances (account_id, initial_balance, current_balance) 
              VALUES ($1, 0, 0)
              ON CONFLICT (account_id) DO NOTHING
            `, [cashAccountRes.rows[0].id]);
            console.log('Dodano saldo dla konta Gotówka');
          }
          
          if (savingsAccountRes.rows.length > 0) {
            await client.query(`
              INSERT INTO account_balances (account_id, initial_balance, current_balance) 
              VALUES ($1, 970.71, 970.71)
              ON CONFLICT (account_id) DO NOTHING
            `, [savingsAccountRes.rows[0].id]);
            console.log('Dodano saldo dla konta Oszczędnościowe');
          }
          
          if (billsAccountRes.rows.length > 0) {
            await client.query(`
              INSERT INTO account_balances (account_id, initial_balance, current_balance) 
              VALUES ($1, 0, 0)
              ON CONFLICT (account_id) DO NOTHING
            `, [billsAccountRes.rows[0].id]);
            console.log('Dodano saldo dla konta Rachunki');
          }
          
          if (kwnrAccountRes.rows.length > 0) {
            await client.query(`
              INSERT INTO account_balances (account_id, initial_balance, current_balance) 
              VALUES ($1, 0, 0)
              ON CONFLICT (account_id) DO NOTHING
            `, [kwnrAccountRes.rows[0].id]);
            console.log('Dodano saldo dla konta KWNR');
          }
        } catch (error) {
          console.error('Błąd podczas dodawania początkowych sald kont:', error);
        }
      }

      // Utwórz pomocnicze tabele dla logiki "Rachunki" per miesiąc
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS account_month_openings (
            id SERIAL PRIMARY KEY,
            account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
            month_id VARCHAR(7) NOT NULL,
            opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
            UNIQUE(account_id, month_id)
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS bills_deductions (
            id SERIAL PRIMARY KEY,
            account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
            month_id VARCHAR(7) NOT NULL,
            amount NUMERIC(12,2) NOT NULL CHECK(amount >= 0),
            deducted_on DATE NOT NULL DEFAULT CURRENT_DATE
          )
        `);
        // Tabele definicji rachunków: stałe (recurring) i jednorazowe per miesiąc
        await client.query(`
          CREATE TABLE IF NOT EXISTS recurring_bills (
            id SERIAL PRIMARY KEY,
            name VARCHAR(128) NOT NULL,
            recipient VARCHAR(128),
            amount NUMERIC(12,2) NOT NULL CHECK(amount >= 0),
            start_month_id VARCHAR(7) NOT NULL,
            end_month_id VARCHAR(7),
            is_active BOOLEAN DEFAULT TRUE
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS monthly_bills (
            id SERIAL PRIMARY KEY,
            month_id VARCHAR(7) NOT NULL,
            name VARCHAR(128) NOT NULL,
            recipient VARCHAR(128),
            amount NUMERIC(12,2) NOT NULL CHECK(amount >= 0)
          )
        `);
      } catch (e) {
        console.error('Nie udało się utworzyć tabel pomocniczych dla Rachunki:', e.message);
      }
      return;
    }
    
    // Odczytaj plik SQL ze schematem bazy danych
    const sqlFilePath = path.join(__dirname, '../../db_schema.sql');
    let sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Odczytaj plik SQL z definicją stanów kont
    const accountBalancesPath = path.join(__dirname, '../../db_account_balances_simple.sql');
    const accountBalancesScript = fs.readFileSync(accountBalancesPath, 'utf8');
    
    // Połącz oba skrypty
    sqlScript = sqlScript + ";\n" + accountBalancesScript;
    
    // Użyj funkcji executeSQL do wykonania skryptów SQL
    await executeSQL(client, sqlScript);
    console.log('Tabele zostały pomyślnie utworzone w bazie danych.');
    
  } catch (error) {
    // Wycofaj transakcję w przypadku błędu
    await client.query('ROLLBACK');
    console.error('Błąd podczas tworzenia tabel:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Funkcja sprawdzająca, czy tabele już istnieją w bazie danych
 */
async function checkIfTablesExist(client) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'accounts'
      );
    `);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error('Błąd podczas sprawdzania tabel:', error);
    return false;
  }
}

/**
 * Funkcja sprawdzająca, czy tabela account_balances istnieje
 */
async function checkIfAccountBalancesExist(client) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'account_balances'
      );
    `);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error('Błąd podczas sprawdzania tabeli account_balances:', error);
    return false;
  }
}

/**
 * Funkcja do wykonywania skryptu SQL
 */
async function executeSQL(client, sqlScript) {
  // Dodaj "IF NOT EXISTS" do instrukcji CREATE TABLE
  sqlScript = sqlScript.replace(/CREATE TABLE /g, 'CREATE TABLE IF NOT EXISTS ');
  
  // Podziel skrypt na pojedyncze instrukcje SQL
  const sqlStatements = sqlScript.split(';')
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0);
  
  // Rozpocznij transakcję
  await client.query('BEGIN');
  
  try {
    // Wykonaj każdą instrukcję SQL
    for (const statement of sqlStatements) {
      try {
        // Pomiń instrukcje INSERT, które mogą powodować konflikty
        if (statement.trim().toUpperCase().startsWith('INSERT INTO')) {
          try {
            await client.query(statement);
            console.log('Wykonano instrukcję SQL:', statement.substring(0, 50) + '...');
          } catch (insertError) {
            // Jeśli wystąpi błąd podczas wstawiania, po prostu go zignoruj i kontynuuj
            console.log('Pominięto wstawianie danych - prawdopodobnie już istnieją:', statement.substring(0, 50) + '...');
          }
        } else {
          // Dla innych instrukcji (CREATE TABLE itp.) normalnie wykonaj
          await client.query(statement);
          console.log('Wykonano instrukcję SQL:', statement.substring(0, 50) + '...');
        }
      } catch (error) {
        console.error('Błąd podczas wykonywania instrukcji SQL:', error);
        throw error;
      }
    }
    
    // Zatwierdź transakcję
    await client.query('COMMIT');
  } catch (error) {
    // Wycofaj transakcję w przypadku błędu
    await client.query('ROLLBACK');
    throw error;
  }
}

module.exports = { createTables };
