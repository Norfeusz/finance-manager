const { getGoogleSheets } = require('../config/googleSheets'); // Zachowujemy na razie, do migracji danych
const { CATEGORY_CONFIG, addNewCategory } = require('../config/categoryConfig');
const path = require('path');
const pool = require('../db/pool');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const addTransaction = async (req, res) => {
  try {
    const transactions = Array.isArray(req.body) ? req.body : [req.body];
    if (transactions.length === 0) return res.status(400).json({ message: 'Brak transakcji.' });
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Sprawdź stan kont przed dodaniem transakcji
      for (const transaction of transactions) {
        const { flowType, data } = transaction;
        
        if (flowType === 'expense') {
          // Sprawdź saldo konta dla wydatku
          const accountName = data.account;
          const cost = parseFloat(data.cost || 0);
          
          if (accountName && cost > 0) {
            // Pobierz aktualne saldo konta
            const balanceRes = await client.query(`
              SELECT a.name, COALESCE(ab.current_balance, 0) AS current_balance
              FROM accounts a
              LEFT JOIN account_balances ab ON a.id = ab.account_id
              WHERE a.name = $1
            `, [accountName]);
            
            if (balanceRes.rows.length > 0) {
              const currentBalance = parseFloat(balanceRes.rows[0].current_balance);
              const projectedBalance = currentBalance - cost;
              
              // Jeśli po transakcji saldo będzie ujemne, zwracamy błąd (ale tylko w API, frontend pokaże alert)
              if (projectedBalance < 0 && !req.body.confirmNegativeBalance) {
                if (req.headers['x-ignore-negative-balance'] !== 'true') {
                  console.warn(`Ostrzeżenie: Wydatek spowodowałby ujemne saldo na koncie ${accountName} (${projectedBalance.toFixed(2)} zł)`);
                }
              }
            }
          }
        } else if (flowType === 'transfer') {
          // Sprawdź saldo konta dla transferu
          const fromAccount = data.fromAccount;
          const amount = parseFloat(data.amount || 0);
          
          if (fromAccount && amount > 0) {
            // Pobierz aktualne saldo konta źródłowego
            const balanceRes = await client.query(`
              SELECT a.name, COALESCE(ab.current_balance, 0) AS current_balance
              FROM accounts a
              LEFT JOIN account_balances ab ON a.id = ab.account_id
              WHERE a.name = $1
            `, [fromAccount]);
            
            if (balanceRes.rows.length > 0) {
              const currentBalance = parseFloat(balanceRes.rows[0].current_balance);
              const projectedBalance = currentBalance - amount;
              
              // Jeśli po transakcji saldo będzie ujemne, zwracamy błąd (ale tylko w API, frontend pokaże alert)
              if (projectedBalance < 0 && !req.body.confirmNegativeBalance) {
                if (req.headers['x-ignore-negative-balance'] !== 'true') {
                  console.warn(`Ostrzeżenie: Transfer spowodowałby ujemne saldo na koncie ${fromAccount} (${projectedBalance.toFixed(2)} zł)`);
                }
              }
            }
          }
        }
      }
      
      for (const transaction of transactions) {
        const { flowType, data } = transaction;
        const { date, extraDescription } = data;
        
        // Formatowanie daty - upewnij się, że jest to obiekt Date
        let transactionDate;
        if (date instanceof Date) {
          transactionDate = date;
        } else if (typeof date === 'string') {
          // Jeśli to string w formacie ISO, usuń część z czasem
          if (date.includes('T')) {
            transactionDate = new Date(date.split('T')[0]);
          } else {
            transactionDate = new Date(date);
          }
        } else {
          transactionDate = new Date();
        }
        
        const description = data.description || '';
        
        // Znajdź lub utwórz miesiąc
        const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(transactionDate);
        const monthYear = transactionDate.getFullYear();
        const monthNum = transactionDate.getMonth() + 1;
        
        let monthRes = await client.query(
          'SELECT id FROM months WHERE year = $1 AND month = $2',
          [monthYear, monthNum]
        );
        
        let monthId;
        if (monthRes.rows.length === 0) {
          const newMonthRes = await client.query(
            'INSERT INTO months (year, month, label) VALUES ($1, $2, $3) RETURNING id',
            [monthYear, monthNum, monthLabel]
          );
          monthId = newMonthRes.rows[0].id;
        } else {
          monthId = monthRes.rows[0].id;
        }
        
        switch (flowType) {
          case 'expense': {
            const mainCategory = data.mainCategory;
            const subCategory = data.subCategory || null;
            
            // Mapowanie kategorii frontendu na kategorie bazy danych
            const categoryMapping = {
              'zakupy codzienne': 'Zakupy spożywcze',
              'auta': 'Transport',
              'dom': 'Mieszkanie',
              'wyjścia i szama do domu': 'Rozrywka',
              'pies': 'Zwierzęta',
              'prezenty': 'Prezenty'
            };
            
            // Mapowanie podkategorii frontendu na podkategorie bazy danych
            const subcategoryMapping = {
              'jedzenie': 'Podstawowe',
              'słodycze': 'Przekąski',
              'alkohol': 'Napoje',
              'chemia': 'Chemia',
              'higiena': 'Higiena',
              'apteka': 'Leki',
              'kwiatki': 'Kwiaty'
            };
            
            // Znajdź lub utwórz konto
            let accountRes = await client.query(
              'SELECT id FROM accounts WHERE name = $1',
              [data.account]
            );
            
            let accountId;
            if (accountRes.rows.length === 0) {
              const newAccountRes = await client.query(
                'INSERT INTO accounts (name) VALUES ($1) RETURNING id',
                [data.account]
              );
              accountId = newAccountRes.rows[0].id;
            } else {
              accountId = accountRes.rows[0].id;
            }
            
            // Zmapuj nazwę kategorii z frontendu na nazwę w bazie danych
            const dbCategoryName = categoryMapping[mainCategory] || mainCategory;
            
            // Znajdź lub utwórz kategorię
            let categoryRes = await client.query(
              'SELECT id FROM categories WHERE name = $1',
              [dbCategoryName]
            );
            
            let categoryId;
            if (categoryRes.rows.length === 0) {
              // Dodajemy nową kategorię
              const newCategoryRes = await client.query(
                'INSERT INTO categories (name) VALUES ($1) RETURNING id',
                [dbCategoryName]
              );
              categoryId = newCategoryRes.rows[0].id;
              
              // Jeśli to jest nowa kategoria od użytkownika, zaktualizujmy konfigurację kategorii
              if (data.isNewCategory) {
                console.log(`Dodano nową kategorię: ${mainCategory}`);
                // Dodaj nową kategorię do konfiguracji
                addNewCategory(mainCategory);
              }
            } else {
              categoryId = categoryRes.rows[0].id;
            }
            
            let subcategoryId = null;
            if (subCategory) {
              // Zmapuj nazwę podkategorii z frontendu na nazwę w bazie danych
              const dbSubcategoryName = subcategoryMapping[subCategory] || subCategory;
              
              // Znajdź lub utwórz podkategorię
              let subcategoryRes = await client.query(
                'SELECT id FROM subcategories WHERE name = $1 AND category_id = $2',
                [dbSubcategoryName, categoryId]
              );
              
              if (subcategoryRes.rows.length === 0) {
                const newSubcategoryRes = await client.query(
                  'INSERT INTO subcategories (name, category_id) VALUES ($1, $2) RETURNING id',
                  [dbSubcategoryName, categoryId]
                );
                subcategoryId = newSubcategoryRes.rows[0].id;
              } else {
                subcategoryId = subcategoryRes.rows[0].id;
              }
            }
            
            // Zapisz transakcję w bazie
            await client.query(
              `INSERT INTO transactions 
               (month_id, account_id, category_id, subcategory_id, type, amount, description, extra_description, date)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [monthId, accountId, categoryId, subcategoryId, 'expense', parseFloat(data.cost), description, extraDescription || null, date]
            );
            
            // Sprawdź czy istnieje wpis w account_balances dla tego konta
            const balanceCheck = await client.query(
              'SELECT id FROM account_balances WHERE account_id = $1',
              [accountId]
            );
            
            if (balanceCheck.rows.length === 0) {
              // Jeśli nie istnieje, utwórz nowy wpis z początkowym saldem 0
              await client.query(`
                INSERT INTO account_balances (account_id, initial_balance, current_balance)
                VALUES ($1, 0, 0)
              `, [accountId]);
            }
            
            // Aktualizuj saldo konta dla WSZYSTKICH kont, w tym Gabi i Norf
            // Dla wszystkich kont wydatek zmniejsza saldo
            await client.query(`
              UPDATE account_balances 
              SET current_balance = current_balance - $1,
                  last_updated = NOW()
              WHERE account_id = $2
            `, [parseFloat(data.cost), accountId]);
            
            console.log(`Zaktualizowano saldo konta ${data.account}, odjęto kwotę ${parseFloat(data.cost)}`);
            
            // Specjalna logika dla wydatków z konta Gabi lub Norf
            // Dodaj adnotację o sposobie obsługi wydatku
            const balanceOption = data.balanceOption || 'budget_increase';
            let noteText = '';
            
            if (balanceOption === 'budget_increase') {
                noteText = `Wydatek z konta ${data.account} zwiększył budżet tego miesiąca`;
            } else if (balanceOption === 'balance_expense') {
                noteText = `Wydatek został zbilansowany transferem na konto ${data.account}`;
            }
            
            // Aktualizuj extraDescription z informacją o opcji bilansowania
            if (noteText) {
                const currentExtraDesc = extraDescription || '';
                const updatedExtraDesc = currentExtraDesc + (currentExtraDesc ? "\n" : "") + noteText;
                
                await client.query(`
                    UPDATE transactions 
                    SET extra_description = $1
                    WHERE id = (SELECT currval('transactions_id_seq'))
                `, [updatedExtraDesc]);
                
                console.log(`Dodano adnotację do transakcji: ${noteText}`);
            }
            
            // Automatycznie generujemy wpływ na konto Wspólne
            if (data.account === 'Gabi' || data.account === 'Norf') {
              // Znajdź konto Wspólne
              let commonAccountRes = await client.query(
                'SELECT id FROM accounts WHERE name = $1',
                ['Wspólne']
              );
              
              let commonAccountId;
              if (commonAccountRes.rows.length === 0) {
                const newAccountRes = await client.query(
                  'INSERT INTO accounts (name) VALUES ($1) RETURNING id',
                  ['Wspólne']
                );
                commonAccountId = newAccountRes.rows[0].id;
              } else {
                commonAccountId = commonAccountRes.rows[0].id;
              }
              
              const expenseAmount = parseFloat(data.cost);
              const wpływOpis = `Zwrot od: ${data.account} - ${description || 'wydatek'}`;
              
              // Zapisz transakcję wpływu z informacją o wybranej opcji bilansowania
              const extraDesc = `Automatycznie wygenerowane z wydatku z konta ${data.account} (opcja: ${balanceOption})`;
              
              await client.query(
                `INSERT INTO transactions 
                 (month_id, account_id, type, amount, description, extra_description, date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [monthId, commonAccountId, 'income', expenseAmount, wpływOpis, extraDesc, date]
              );
              
              // Sprawdź czy istnieje wpis w account_balances dla konta Wspólne
              const balanceCheck = await client.query(
                'SELECT id FROM account_balances WHERE account_id = $1',
                [commonAccountId]
              );
              
              if (balanceCheck.rows.length === 0) {
                // Jeśli nie istnieje, utwórz nowy wpis z początkowym saldem 0
                await client.query(`
                  INSERT INTO account_balances (account_id, initial_balance, current_balance)
                  VALUES ($1, 0, 0)
                `, [commonAccountId]);
              }
              
              // Nie aktualizujemy salda konta Wspólnego dla opcji "Zwiększamy budżet"
              // Wpływ jest rejestrowany tylko w celach raportowania, ale nie zmienia faktycznego stanu konta
              console.log(`Opcja "Zwiększamy budżet" - pominięto aktualizację salda konta Wspólne`)
            }
            
            break;
          }
          
          case 'income': {
            // Znajdź lub utwórz konto
            let accountRes = await client.query(
              'SELECT id FROM accounts WHERE name = $1',
              [data.toAccount]
            );
            
            let accountId;
            if (accountRes.rows.length === 0) {
              const newAccountRes = await client.query(
                'INSERT INTO accounts (name) VALUES ($1) RETURNING id',
                [data.toAccount]
              );
              accountId = newAccountRes.rows[0].id;
            } else {
              accountId = accountRes.rows[0].id;
            }
            
            // Zapisz transakcję wpływu
            const incomeAmount = parseFloat(data.amount);
            await client.query(
              `INSERT INTO transactions 
               (month_id, account_id, type, amount, description, extra_description, date)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [monthId, accountId, 'income', incomeAmount, data.from || description, extraDescription || null, date]
            );
            
            // Sprawdź czy istnieje wpis w account_balances dla tego konta
            const balanceCheck = await client.query(
              'SELECT id FROM account_balances WHERE account_id = $1',
              [accountId]
            );
            
            if (balanceCheck.rows.length === 0) {
              // Jeśli nie istnieje, utwórz nowy wpis z początkowym saldem 0
              await client.query(`
                INSERT INTO account_balances (account_id, initial_balance, current_balance)
                VALUES ($1, 0, 0)
              `, [accountId]);
            }
            
            // Aktualizuj saldo konta - dodaj kwotę wpływu
            await client.query(`
              UPDATE account_balances 
              SET current_balance = current_balance + $1,
                  last_updated = NOW()
              WHERE account_id = $2
            `, [incomeAmount, accountId]);
            
            break;
          }
          
          case 'transfer': {
            console.log(`Przetwarzanie transferu: ${JSON.stringify(data)}`);
            
            // Sprawdź czy wszystkie wymagane pola są dostępne
            if (!data.fromAccount || !data.toAccount || !data.amount) {
              console.error('Brakujące dane dla transferu:', {
                fromAccount: data.fromAccount,
                toAccount: data.toAccount,
                amount: data.amount
              });
              throw new Error('Brakujące dane dla transferu: konto źródłowe, konto docelowe lub kwota');
            }
            
            // Sprawdź, czy konta źródłowe i docelowe są różne
            if (data.fromAccount === data.toAccount) {
              console.error('Konto źródłowe i docelowe są takie same:', data.fromAccount);
              throw new Error('Konto źródłowe i docelowe muszą być różne');
            }
            
            // Znajdź lub utwórz konto źródłowe
            console.log(`Szukam konta źródłowego: ${data.fromAccount}`);
            let fromAccountRes = await client.query(
              'SELECT id FROM accounts WHERE name = $1',
              [data.fromAccount]
            );
            
            let fromAccountId;
            if (fromAccountRes.rows.length === 0) {
              console.log(`Tworzę nowe konto źródłowe: ${data.fromAccount}`);
              const newFromAccountRes = await client.query(
                'INSERT INTO accounts (name) VALUES ($1) RETURNING id',
                [data.fromAccount]
              );
              fromAccountId = newFromAccountRes.rows[0].id;
            } else {
              fromAccountId = fromAccountRes.rows[0].id;
            }
            
            // Znajdź lub utwórz konto docelowe
            console.log(`Szukam konta docelowego: ${data.toAccount}`);
            let toAccountRes = await client.query(
              'SELECT id FROM accounts WHERE name = $1',
              [data.toAccount]
            );
            
            let toAccountId;
            if (toAccountRes.rows.length === 0) {
              console.log(`Tworzę nowe konto docelowe: ${data.toAccount}`);
              const newToAccountRes = await client.query(
                'INSERT INTO accounts (name) VALUES ($1) RETURNING id',
                [data.toAccount]
              );
              toAccountId = newToAccountRes.rows[0].id;
            } else {
              toAccountId = toAccountRes.rows[0].id;
            }
            
            // Parsuj kwotę i upewnij się, że jest liczbą
            let amount;
            try {
              amount = parseFloat(data.amount);
              if (isNaN(amount) || amount <= 0) {
                throw new Error('Nieprawidłowa kwota');
              }
            } catch (err) {
              console.error('Błąd przy parsowaniu kwoty:', data.amount, err);
              throw new Error(`Nieprawidłowa kwota transferu: ${data.amount}`);
            }
            
            console.log(`Transfer: z ${data.fromAccount} (ID: ${fromAccountId}) do ${data.toAccount} (ID: ${toAccountId}), kwota: ${amount}`);
            
            try {
              // Zapisz transakcję transferu jako wydatek z konta źródłowego
              console.log(`Zapisuję transakcję transferu z konta źródłowego...`);
              const sourceTransferResult = await client.query(
                `INSERT INTO transactions 
                 (month_id, account_id, type, amount, description, extra_description, date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [monthId, fromAccountId, 'transfer', amount, `Transfer do: ${data.toAccount}`, extraDescription || null, date]
              );
              const sourceTransferId = sourceTransferResult.rows[0].id;
              console.log(`Zapisano transakcję transferu z konta źródłowego, ID: ${sourceTransferId}`);
              
              // Sprawdź czy istnieje wpis w account_balances dla konta źródłowego
              console.log(`Sprawdzam saldo konta źródłowego...`);
              const fromBalanceCheck = await client.query(
                'SELECT id, current_balance FROM account_balances WHERE account_id = $1',
                [fromAccountId]
              );
              
              if (fromBalanceCheck.rows.length === 0) {
                // Jeśli nie istnieje, utwórz nowy wpis z początkowym saldem 0
                console.log(`Tworzę nowy wpis salda dla konta źródłowego...`);
                await client.query(`
                  INSERT INTO account_balances (account_id, initial_balance, current_balance)
                  VALUES ($1, 0, 0)
                `, [fromAccountId]);
              } else {
                console.log(`Aktualne saldo konta źródłowego: ${fromBalanceCheck.rows[0].current_balance}`);
              }
              
              // Zmniejsz saldo konta źródłowego
              console.log(`Aktualizuję saldo konta źródłowego...`);
              await client.query(`
                UPDATE account_balances 
                SET current_balance = current_balance - $1,
                    last_updated = NOW()
                WHERE account_id = $2
              `, [amount, fromAccountId]);
              
              // Zapisz wpływ na konto docelowe
              console.log(`Zapisuję transakcję wpływu na konto docelowe...`);
              const targetTransferResult = await client.query(
                `INSERT INTO transactions 
                 (month_id, account_id, type, amount, description, extra_description, date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [monthId, toAccountId, 'transfer', amount, `Transfer z: ${data.fromAccount}`, extraDescription || null, date]
              );
              const targetTransferId = targetTransferResult.rows[0].id;
              console.log(`Zapisano transakcję wpływu na konto docelowe, ID: ${targetTransferId}`);
              
              console.log(`Powiązane ID transakcji: źródłowa=${sourceTransferId}, docelowa=${targetTransferId}`);
            } catch (err) {
              console.error('Błąd podczas zapisywania transakcji transferu:', err);
              throw err;
            }
            
            try {
              // Sprawdź czy istnieje wpis w account_balances dla konta docelowego
              console.log(`Sprawdzam saldo konta docelowego...`);
              const toBalanceCheck = await client.query(
                'SELECT id, current_balance FROM account_balances WHERE account_id = $1',
                [toAccountId]
              );
              
              if (toBalanceCheck.rows.length === 0) {
                // Jeśli nie istnieje, utwórz nowy wpis z początkowym saldem 0
                console.log(`Tworzę nowy wpis salda dla konta docelowego...`);
                await client.query(`
                  INSERT INTO account_balances (account_id, initial_balance, current_balance)
                  VALUES ($1, 0, 0)
                `, [toAccountId]);
              } else {
                console.log(`Aktualne saldo konta docelowego: ${toBalanceCheck.rows[0].current_balance}`);
              }
              
              // Zwiększ saldo konta docelowego
              console.log(`Aktualizuję saldo konta docelowego...`);
              await client.query(`
                UPDATE account_balances 
                SET current_balance = current_balance + $1,
                    last_updated = NOW()
                WHERE account_id = $2
              `, [amount, toAccountId]);
              
              console.log(`Transfer został pomyślnie zrealizowany.`);
            } catch (err) {
              console.error('Błąd podczas aktualizacji salda konta docelowego:', err);
              throw err;
            }
            
            break;
          }
        }
      }
      
      await client.query('COMMIT');
      res.status(200).json({ success: true, message: 'Transakcje zapisane pomyślnie' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Błąd krytyczny w addTransaction:`, error);
    console.error(`Stack trace:`, error.stack);
    console.error(`Data wejściowa:`, JSON.stringify(req.body, null, 2));
    res.status(500).json({ message: 'Krytyczny błąd serwera. Sprawdź logi na serwerze.', error: error.message, stack: error.stack });
  }
};

const deleteTransaction = async (req, res) => {
    try {
        const { id } = req.body;
        
        console.log(`=== Rozpoczynam proces usuwania transakcji o ID: ${id} ===`);
        
        if (!id) {
            console.log('Błąd: Brak ID transakcji do usunięcia');
            return res.status(400).json({ message: 'Brak ID transakcji do usunięcia.' });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            console.log(`Rozpoczęto transakcję SQL`);
            
            // Najpierw pobierz informacje o transakcji wraz z nazwą konta i datą
            const transactionResult = await client.query(
                `SELECT t.id, t.type, t.amount, t.account_id, t.description, t.date, a.name as account_name 
                 FROM transactions t
                 JOIN accounts a ON t.account_id = a.id
                 WHERE t.id = $1`,
                [id]
            );
            
            console.log(`Wynik zapytania o transakcję: ${transactionResult.rows.length} wierszy`);
            
            if (transactionResult.rows.length === 0) {
                await client.query('ROLLBACK');
                console.log(`Błąd: Nie znaleziono transakcji o ID: ${id}`);
                return res.status(404).json({ message: 'Nie znaleziono transakcji o podanym ID.' });
            }
            
            const transaction = transactionResult.rows[0];
            const amount = parseFloat(transaction.amount);
            const accountId = transaction.account_id;
            const accountName = transaction.account_name;
            
            // Zaktualizuj saldo konta w zależności od typu transakcji
            if (transaction.type === 'expense') {
                console.log(`Usuwanie wydatku o ID ${id} z konta ${accountName}, kwota: ${amount}`);
                
                // Sprawdzamy, czy to wydatek z konta Gabi lub Norf
                if (accountName === 'Gabi' || accountName === 'Norf') {
                    // Znajdź automatycznie wygenerowany wpływ związany z wydatkiem
                    // Dodajemy bardziej dokładne wyszukiwanie i lepsze logowanie dla debugowania
                    console.log(`Szukam automatycznego wpływu związanego z wydatkiem z konta ${accountName} z dnia ${transaction.date}`);
                    
                    const autoIncomeResult = await client.query(`
                        SELECT t.id, t.amount, t.account_id, t.description, a.name as target_account_name
                        FROM transactions t
                        JOIN accounts a ON t.account_id = a.id
                        WHERE t.type = 'income' 
                        AND t.description LIKE $1
                        AND t.extra_description LIKE $2
                        AND DATE(t.date) = DATE($3)
                        ORDER BY t.id DESC
                        LIMIT 1
                    `, [`Zwrot od: ${accountName}%`, `%Automatycznie wygenerowane%${accountName}%`, transaction.date]);
                    
                    console.log(`Znaleziono ${autoIncomeResult.rows.length} pasujących automatycznych wpływów`);
                    
                    if (autoIncomeResult.rows.length > 0) {
                        const autoIncome = autoIncomeResult.rows[0];
                        const targetAccountId = autoIncome.account_id;
                        const targetAccountName = autoIncome.target_account_name;
                        
                        console.log(`Znaleziono automatyczny wpływ o ID: ${autoIncome.id} na konto ${targetAccountName}`);
                        
                        // Nie odejmujemy kwoty automatycznego wpływu z salda konta docelowego,
                        // ponieważ dla opcji "Zwiększamy budżet" saldo konta nie jest aktualizowane
                        console.log(`Usuwanie automatycznego wpływu dla opcji "Zwiększamy budżet" - saldo konta ${targetAccountName} pozostaje bez zmian`);
                        
                        // Usuwamy automatycznie wygenerowaną transakcję wpływu
                        await client.query('DELETE FROM transactions WHERE id = $1', [autoIncome.id]);
                        console.log(`Usunięto wpływ o ID: ${autoIncome.id}`);
                    } else {
                        console.log(`UWAGA: Nie znaleziono automatycznego wpływu dla wydatku z konta ${accountName}`);
                    }
                    
                    // Dla specjalnych kont również przywracamy saldo, ponieważ wydatek nadal zmniejszał ich saldo
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [amount, accountId]);
                    
                    console.log(`Przywrócono saldo na koncie ${accountName}, dodano kwotę ${amount}`);
                } else {
                    // Standardowe konto - przywracamy środki
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [amount, accountId]);
                    
                    console.log(`Przywrócono saldo na standardowym koncie ${accountName}, dodano kwotę ${amount}`);
                }
            } 
            else if (transaction.type === 'income') {
                // Jeśli usuwamy wpływ, odejmujemy środki z konta
                await client.query(`
                    UPDATE account_balances 
                    SET current_balance = current_balance - $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                `, [amount, accountId]);
            } 
            else if (transaction.type === 'transfer') {
                // Jeśli usuwamy transfer, trzeba znaleźć powiązaną transakcję transferu i oba konta
                console.log(`Usuwanie transferu ID: ${id} z konta ${accountName}, kwota: ${amount}, data: ${transaction.date}`);
                
                // Znajdź powiązaną transakcję transferu - wersja bardziej elastyczna
                // Szukamy drugiej transakcji transferu z tą samą datą, która nie jest tą, którą usuwamy
                    const relatedTransferResult = await client.query(
                        `SELECT t.id, t.account_id, t.description, t.amount, a.name as target_account_name
                         FROM transactions t
                         JOIN accounts a ON t.account_id = a.id
                         WHERE t.type = 'transfer' 
                           AND DATE(t.date) = DATE($1) 
                           AND t.id != $2
                           AND (
                               t.description LIKE $3 
                               OR t.description LIKE $4
                           )
                           AND ABS(t.amount - $5) < 0.01
                         ORDER BY t.id DESC
                         LIMIT 1
                        `,
                        [transaction.date, id, `Transfer z: ${accountName}%`, `Transfer do: %`, amount]
                    );
                    
                    console.log(`Znaleziono ${relatedTransferResult.rows.length} powiązanych transakcji transferu`);
                    
                    if (relatedTransferResult.rows.length > 0) {
                        const targetAccountId = relatedTransferResult.rows[0].account_id;
                        const relatedTransferId = relatedTransferResult.rows[0].id;
                        const targetAccountName = relatedTransferResult.rows[0].target_account_name;
                        
                        console.log(`Znaleziono powiązaną transakcję transferu o ID: ${relatedTransferId} na konto ${targetAccountName}, kwota: ${relatedTransferResult.rows[0].amount}`);
                    
                    // Usuń najpierw powiązaną transakcję transferu
                    console.log(`Próbuję usunąć powiązaną transakcję transferu o ID: ${relatedTransferId}`);
                    
                    const deleteRelatedResult = await client.query('DELETE FROM transactions WHERE id = $1', [relatedTransferId]);
                    
                    if (deleteRelatedResult.rowCount === 1) {
                        console.log(`Pomyślnie usunięto powiązaną transakcję transferu o ID: ${relatedTransferId}`);
                    } else {
                        console.log(`UWAGA: Nie można usunąć powiązanej transakcji transferu o ID: ${relatedTransferId}. Liczba usuniętych wierszy: ${deleteRelatedResult.rowCount}`);
                    }
                    
                    // Zwróć środki na konto źródłowe
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [amount, accountId]);
                    
                    console.log(`Przywrócono saldo na koncie źródłowym ${accountName}, dodano kwotę ${amount}`);
                    
                    // Odejmij środki z konta docelowego
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance - $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [amount, targetAccountId]);
                    
                    console.log(`Zaktualizowano saldo konta docelowego ${targetAccountName}, odjęto kwotę ${amount}`);
                } else {
                    console.log(`UWAGA: Nie znaleziono powiązanej transakcji transferu!`);
                    // Przywracamy saldo konta źródłowego, ponieważ transfer zmniejszał jego saldo
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [amount, accountId]);
                    
                    console.log(`Przywrócono saldo na koncie źródłowym ${accountName}, dodano kwotę ${amount}`);
                }
            }
            
            // Usuń transakcję główną na końcu
            console.log(`Próbuję usunąć główną transakcję o ID: ${id}`);
            
            const deleteResult = await client.query('DELETE FROM transactions WHERE id = $1', [id]);
            
            if (deleteResult.rowCount === 1) {
                console.log(`Pomyślnie usunięto transakcję o ID: ${id}. Liczba usuniętych wierszy: ${deleteResult.rowCount}`);
            } else {
                console.log(`UWAGA: Nie można usunąć transakcji o ID: ${id}. Liczba usuniętych wierszy: ${deleteResult.rowCount}`);
                // Jeśli nie usunięto żadnej transakcji, to wykonaj rollback
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Nie udało się usunąć transakcji. Sprawdź logi serwera.' });
            }
            
            // Zatwierdź wszystkie zmiany
            await client.query('COMMIT');
            console.log(`=== Pomyślnie zakończono usuwanie transakcji o ID: ${id} ===`);
            
            // Zwróć sukces
            return res.status(200).json({ message: 'Transakcja została pomyślnie usunięta.' });
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('=== BŁĄD podczas usuwania transakcji ===');
            console.error('Treść błędu:', error);
            console.error('Szczegóły zapytania:', { id: id });
            
            if (error.constraint) {
                console.error('Naruszenie ograniczenia bazy danych:', error.constraint);
                return res.status(500).json({ 
                    message: 'Błąd integralności bazy danych podczas usuwania transakcji.', 
                    error: error.message,
                    constraint: error.constraint 
                });
            }
            
            res.status(500).json({ 
                message: 'Błąd serwera podczas usuwania transakcji.', 
                error: error.message 
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('=== BŁĄD KRYTYCZNY w deleteTransaction ===');
        console.error('Treść błędu:', error);
        console.error('Stack trace:', error.stack);
        console.error('Data wejściowa:', JSON.stringify(req.body, null, 2));
        
        res.status(500).json({ 
            message: 'Błąd krytyczny serwera podczas usuwania transakcji. Sprawdź logi na serwerze.', 
            error: error.message, 
            stack: error.stack 
        });
    }
};

const updateTransaction = async (req, res) => {
    try {
        const { original, updated } = req.body;
        if (!original || !updated || !original.id) {
            return res.status(400).json({ message: 'Brak danych do aktualizacji.' });
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Pobierz aktualną transakcję z bazy wraz z nazwą konta
            const transactionResult = await client.query(
                `SELECT t.id, t.type, t.amount, t.account_id, t.description, t.date, a.name as account_name 
                 FROM transactions t
                 JOIN accounts a ON t.account_id = a.id
                 WHERE t.id = $1`,
                [original.id]
            );
            
            if (transactionResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Nie znaleziono transakcji o podanym ID.' });
            }
            
            const transaction = transactionResult.rows[0];
            const originalAmount = parseFloat(transaction.amount);
            const originalAccountId = transaction.account_id;
            const originalAccountName = transaction.account_name;
            const transactionType = transaction.type;
            
            // Znajdź ID konta z aktualizowanych danych
            let updatedAccountId = originalAccountId;
            let updatedAmount = updated.cost || updated.amount || originalAmount;
            let updatedAccountName = originalAccountName;
            
            // Jeśli zmieniono konto, znajdź nowe ID konta
            if (updated.account && updated.account !== original.account) {
                const accountResult = await client.query(
                    'SELECT id, name FROM accounts WHERE name = $1',
                    [updated.account]
                );
                
                if (accountResult.rows.length > 0) {
                    updatedAccountId = accountResult.rows[0].id;
                    updatedAccountName = accountResult.rows[0].name;
                } else {
                    // Jeśli konto nie istnieje, utwórz je
                    const newAccountResult = await client.query(
                        'INSERT INTO accounts (name) VALUES ($1) RETURNING id, name',
                        [updated.account]
                    );
                    updatedAccountId = newAccountResult.rows[0].id;
                    updatedAccountName = newAccountResult.rows[0].name;
                }
            }
            
            // Aktualizacja stanów kont w zależności od typu transakcji
            if (transactionType === 'expense') {
                // Przywróć poprzednią kwotę wydatku na oryginalne konto - ZAWSZE
                // Dla WSZYSTKICH kont, w tym Gabi i Norf, wydatek zmniejsza saldo, więc musimy je przywrócić
                await client.query(`
                    UPDATE account_balances 
                    SET current_balance = current_balance + $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                `, [originalAmount, originalAccountId]);
                
                console.log(`Przywrócono saldo konta ${originalAccountName}, dodano kwotę ${originalAmount}`);
                
                // Odejmij nową kwotę wydatku z nowego konta - ZAWSZE
                // Dla WSZYSTKICH kont, w tym Gabi i Norf, wydatek zmniejsza saldo
                await client.query(`
                    UPDATE account_balances 
                    SET current_balance = current_balance - $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                `, [updatedAmount, updatedAccountId]);
                
                console.log(`Zaktualizowano saldo konta ${updatedAccountName}, odjęto kwotę ${updatedAmount}`);
                
                // Obsługa specjalnej logiki dla kont Gabi/Norf
                
                // 1. Jeśli oryginalne konto było Gabi/Norf - znajdź i usuń automatyczny wpływ
                if (originalAccountName === 'Gabi' || originalAccountName === 'Norf') {
                    // Znajdź powiązany automatyczny wpływ
                    const autoIncomeResult = await client.query(`
                        SELECT t.id, t.amount, t.account_id
                        FROM transactions t
                        WHERE t.type = 'income' 
                        AND t.description LIKE $1
                        AND t.extra_description LIKE $2
                        AND DATE(t.date) = DATE($3)
                    `, [`Zwrot od: ${originalAccountName}%`, `%Automatycznie wygenerowane%${originalAccountName}%`, transaction.date]);
                    
                    if (autoIncomeResult.rows.length > 0) {
                        const autoIncome = autoIncomeResult.rows[0];
                        const commonAccountId = autoIncome.account_id;
                        
                            // Dla opcji "Zwiększamy budżet" nie cofamy aktualizacji salda konta Wspólnego,
                        // ponieważ saldo nie zostało zaktualizowane przy dodawaniu transakcji
                        console.log(`Usuwanie automatycznego wpływu dla opcji "Zwiększamy budżet" - saldo konta Wspólne pozostaje bez zmian`);
                        
                        // Usuwamy automatycznie wygenerowaną transakcję wpływu
                        await client.query('DELETE FROM transactions WHERE id = $1', [autoIncome.id]);
                        console.log(`Usunięto automatyczny wpływ o ID: ${autoIncome.id}`);
                    }
                }
                
                // 2. Jeśli nowe konto jest Gabi/Norf - utwórz nowy automatyczny wpływ
                if (updatedAccountName === 'Gabi' || updatedAccountName === 'Norf') {
                    // Znajdź konto Wspólne
                    const commonAccountRes = await client.query(
                        'SELECT id FROM accounts WHERE name = $1',
                        ['Wspólne']
                    );
                    
                    let commonAccountId;
                    if (commonAccountRes.rows.length === 0) {
                        const newAccountRes = await client.query(
                            'INSERT INTO accounts (name) VALUES ($1) RETURNING id',
                            ['Wspólne']
                        );
                        commonAccountId = newAccountRes.rows[0].id;
                    } else {
                        commonAccountId = commonAccountRes.rows[0].id;
                    }
                    
                    const expenseAmount = updatedAmount;
                    const wpływOpis = `Zwrot od: ${updatedAccountName} - ${updated.description || original.description || 'wydatek'}`;
                    
                    // Zapisz nową transakcję wpływu
                    await client.query(
                        `INSERT INTO transactions 
                        (month_id, account_id, type, amount, description, extra_description, date)
                        VALUES (
                            (SELECT month_id FROM transactions WHERE id = $1),
                            $2, $3, $4, $5, $6, $7
                        )`,
                        [original.id, commonAccountId, 'income', expenseAmount, wpływOpis, 
                        `Automatycznie wygenerowane z wydatku z konta ${updatedAccountName}`, 
                        updated.date || transaction.date]
                    );
                    
                    // Dla opcji "Zwiększamy budżet" nie aktualizujemy salda konta Wspólnego
                    // Transakcja wpływu jest rejestrowana tylko w celach raportowania
                    console.log(`Opcja "Zwiększamy budżet" - pominięto aktualizację salda konta Wspólne`);
                }
            } 
            else if (transactionType === 'income') {
                // Odejmij poprzednią kwotę wpływu z oryginalnego konta
                await client.query(`
                    UPDATE account_balances 
                    SET current_balance = current_balance - $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                `, [originalAmount, originalAccountId]);
                
                // Dodaj nową kwotę wpływu do nowego konta
                await client.query(`
                    UPDATE account_balances 
                    SET current_balance = current_balance + $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                `, [updatedAmount, updatedAccountId]);
            }
            else if (transactionType === 'transfer') {
                console.log(`Aktualizacja transferu ID: ${original.id}`);
                
                // Znajdź powiązaną transakcję transferu
                const relatedTransferResult = await client.query(`
                    SELECT t.id, t.account_id, a.name as target_account_name
                    FROM transactions t
                    JOIN accounts a ON t.account_id = a.id
                    WHERE t.type = 'transfer' AND 
                          t.description LIKE $1 AND
                          t.date = $2
                `, [`Transfer z: ${originalAccountName}%`, transaction.date]);
                
                if (relatedTransferResult.rows.length > 0) {
                    const targetTransferId = relatedTransferResult.rows[0].id;
                    const targetAccountId = relatedTransferResult.rows[0].account_id;
                    const targetAccountName = relatedTransferResult.rows[0].target_account_name;
                    
                    console.log(`Znaleziono powiązaną transakcję transferu ID: ${targetTransferId} na konto ${targetAccountName}`);
                    
                    // 1. Przywróć stan konta źródłowego (dodaj kwotę transferu)
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [originalAmount, originalAccountId]);
                    
                    console.log(`Przywrócono saldo na koncie ${originalAccountName}, dodano kwotę ${originalAmount}`);
                    
                    // 2. Przywróć stan konta docelowego (odejmij kwotę transferu)
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance - $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [originalAmount, targetAccountId]);
                    
                    console.log(`Zaktualizowano saldo konta ${targetAccountName}, odjęto kwotę ${originalAmount}`);
                    
                    // 3. Zaktualizuj również powiązaną transakcję transferu
                    await client.query(`
                        UPDATE transactions 
                        SET account_id = $1, 
                            amount = $2, 
                            description = $3,
                            extra_description = $4,
                            date = $5
                        WHERE id = $6
                    `, [
                        updatedAccountId !== originalAccountId ? targetAccountId : updatedAccountId, 
                        updatedAmount, 
                        `Transfer z: ${updatedAccountName}`, 
                        updated.extraDescription || original.extraDescription,
                        updated.date || original.date,
                        targetTransferId
                    ]);
                    
                    console.log(`Zaktualizowano powiązaną transakcję transferu ID: ${targetTransferId}`);
                    
                    // 4. Zastosuj nowe kwoty na kontach
                    // Zmniejsz saldo nowego konta źródłowego
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance - $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [updatedAmount, updatedAccountId]);
                    
                    console.log(`Zaktualizowano saldo konta ${updatedAccountName}, odjęto kwotę ${updatedAmount}`);
                    
                    // Zwiększ saldo nowego konta docelowego
                    let updatedTargetAccountId = targetAccountId;
                    if (updated.toAccount && updated.toAccount !== original.toAccount) {
                        // Jeśli zmieniono konto docelowe, znajdź nowe ID
                        const targetAccountResult = await client.query(
                            'SELECT id, name FROM accounts WHERE name = $1',
                            [updated.toAccount]
                        );
                        
                        if (targetAccountResult.rows.length > 0) {
                            updatedTargetAccountId = targetAccountResult.rows[0].id;
                            
                            // Zaktualizuj ID konta w transakcji transfer_in
                            await client.query(`
                                UPDATE transactions 
                                SET account_id = $1
                                WHERE id = $2
                            `, [updatedTargetAccountId, targetTransferId]);
                        }
                    }
                    
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [updatedAmount, updatedTargetAccountId]);
                    
                    console.log(`Zaktualizowano saldo konta docelowego, dodano kwotę ${updatedAmount}`);
                } else {
                    console.log(`UWAGA: Nie znaleziono powiązanej transakcji transferu!`);
                    // Przywracamy saldo konta źródłowego, ponieważ transfer zmniejszał jego saldo
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [amount, accountId]);
                    
                    console.log(`Przywrócono saldo na koncie źródłowym ${accountName}, dodano kwotę ${amount}`);
                }
            }
            
            // Aktualizuj transakcję w bazie danych
            await client.query(`
                UPDATE transactions 
                SET account_id = $1, 
                    amount = $2, 
                    description = $3,
                    extra_description = $4,
                    date = $5
                WHERE id = $6
            `, [
                updatedAccountId, 
                updatedAmount, 
                updated.description || original.description, 
                updated.extraDescription || original.extraDescription,
                updated.date || original.date,
                original.id
            ]);
            
            await client.query('COMMIT');
            res.status(200).json({ message: 'Transakcja została pomyślnie zaktualizowana.' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Błąd podczas aktualizacji transakcji:', error);
            res.status(500).json({ message: 'Błąd serwera podczas aktualizacji.', error: error.message });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Błąd krytyczny w updateTransaction:', error);
        console.error(`Stack trace:`, error.stack);
        console.error(`Data wejściowa:`, JSON.stringify(req.body, null, 2));
        res.status(500).json({ message: 'Błąd serwera podczas aktualizacji. Sprawdź logi na serwerze.', error: error.message, stack: error.stack });
    }
};

// Funkcja do usuwania transferu (oba rekordy - wychodzący i przychodzący)
const deleteTransfer = async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { id, date, fromAccount, toAccount, amount } = req.body;
        
        if (!fromAccount || !toAccount || !amount) {
            return res.status(400).json({ message: 'Brakujące dane: konto źródłowe, konto docelowe lub kwota' });
        }
        
        await client.query('BEGIN');
        
        // Znajdź konto źródłowe
        let fromAccountRes = await client.query('SELECT id FROM accounts WHERE name = $1', [fromAccount]);
        if (fromAccountRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `Nie znaleziono konta źródłowego: ${fromAccount}` });
        }
        const fromAccountId = fromAccountRes.rows[0].id;
        
        // Znajdź konto docelowe
        let toAccountRes = await client.query('SELECT id FROM accounts WHERE name = $1', [toAccount]);
        if (toAccountRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `Nie znaleziono konta docelowego: ${toAccount}` });
        }
        const toAccountId = toAccountRes.rows[0].id;
        
        // Znajdź miesiąc dla tej daty
        const transactionDate = new Date(date);
        const monthYear = transactionDate.getFullYear();
        const monthNum = transactionDate.getMonth() + 1;
        
        let monthRes = await client.query(
            'SELECT id FROM months WHERE year = $1 AND month = $2',
            [monthYear, monthNum]
        );
        
        if (monthRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Nie znaleziono miesiąca dla podanej daty.' });
        }
        
        const monthId = monthRes.rows[0].id;
        
        // Usuń rekord transferu wychodzącego
        await client.query(`
            DELETE FROM transactions 
            WHERE month_id = $1 AND account_id = $2 AND type = 'transfer' AND amount = $3
        `, [monthId, fromAccountId, amount]);
        
        // Usuń rekord transferu przychodzącego
        await client.query(`
            DELETE FROM transactions 
            WHERE month_id = $1 AND account_id = $2 AND type = 'transfer' AND amount = $3
        `, [monthId, toAccountId, amount]);
        
        // Aktualizuj saldo konta źródłowego - dodaj kwotę (cofamy odjęcie)
        await client.query(`
            UPDATE account_balances
            SET current_balance = current_balance + $1,
                last_updated = NOW()
            WHERE account_id = $2
        `, [parseFloat(amount), fromAccountId]);
        
        // Aktualizuj saldo konta docelowego - odejmij kwotę (cofamy dodanie)
        await client.query(`
            UPDATE account_balances
            SET current_balance = current_balance - $1,
                last_updated = NOW()
            WHERE account_id = $2
        `, [parseFloat(amount), toAccountId]);
        
        await client.query('COMMIT');
        
        res.status(200).json({ message: 'Transfer został pomyślnie usunięty.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Błąd podczas usuwania transferu:', error);
        res.status(500).json({ message: 'Błąd serwera podczas usuwania transferu.', error: error.message });
    } finally {
        client.release();
    }
};

module.exports = { addTransaction, deleteTransaction, updateTransaction, deleteTransfer };