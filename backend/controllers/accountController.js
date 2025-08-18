const pool = require('../db/pool');

/**
 * Pobiera stany wszystkich kont
 */
const getAccountBalances = async (req, res) => {
    try {
        const client = await pool.connect();
        
        try {
            // Pobierz dane o kontach i ich saldach
            const result = await client.query(`
                SELECT 
                    a.id,
                    a.name,
                    COALESCE(ab.initial_balance, 0) AS initial_balance,
                    COALESCE(ab.current_balance, 0) AS current_balance,
                    ab.last_updated
                FROM 
                    accounts a
                LEFT JOIN 
                    account_balances ab ON a.id = ab.account_id
                WHERE 
                    a.name IN ('Wspólne', 'Gotówka', 'Oszczędnościowe', 'Rachunki', 'KWNR')
                ORDER BY 
                    CASE 
                        WHEN a.name = 'Wspólne' THEN 1
                        WHEN a.name = 'Gotówka' THEN 2
                        WHEN a.name = 'Oszczędnościowe' THEN 3
                        WHEN a.name = 'Rachunki' THEN 4
                        WHEN a.name = 'KWNR' THEN 5
                        ELSE 6
                    END
            `);
            
            res.status(200).json(result.rows);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Błąd podczas pobierania stanów kont:', error);
        res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message });
    }
};

/**
 * Aktualizuje stan początkowy konta
 */
const updateAccountInitialBalance = async (req, res) => {
    try {
        const { accountId, initialBalance } = req.body;
        
        if (!accountId || initialBalance === undefined) {
            return res.status(400).json({ message: 'Brakujące dane: accountId lub initialBalance' });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Sprawdź, czy konto istnieje
            const accountCheck = await client.query('SELECT id FROM accounts WHERE id = $1', [accountId]);
            
            if (accountCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Konto o podanym ID nie istnieje' });
            }
            
            // Upsert - wstaw lub zaktualizuj stan konta
            await client.query(`
                INSERT INTO account_balances (account_id, initial_balance, current_balance)
                VALUES ($1, $2, $2)
                ON CONFLICT (account_id) 
                DO UPDATE SET 
                    initial_balance = $2,
                    current_balance = account_balances.current_balance + ($2 - account_balances.initial_balance),
                    last_updated = NOW()
            `, [accountId, initialBalance]);
            
            await client.query('COMMIT');
            
            res.status(200).json({ 
                message: 'Stan początkowy konta zaktualizowany pomyślnie',
                accountId,
                initialBalance
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Błąd podczas aktualizacji stanu początkowego konta:', error);
        res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message });
    }
};

/**
 * Aktualizuje stan wszystkich kont na podstawie historycznych transakcji
 */
const recalculateAllAccountBalances = async (req, res) => {
    try {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Ustaw wszystkie salda na wartości początkowe
            await client.query(`
                UPDATE account_balances
                SET current_balance = initial_balance,
                    last_updated = NOW()
            `);
            
            // Pobierz wszystkie transakcje i zaktualizuj salda
            const transactions = await client.query(`
                SELECT 
                    type, 
                    account_id, 
                    amount
                FROM 
                    transactions
                WHERE 
                    type IN ('income', 'expense')
                ORDER BY
                    date ASC
            `);
            
            // Zaktualizuj salda na podstawie transakcji
            for (const tx of transactions.rows) {
                if (tx.type === 'income') {
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [tx.amount, tx.account_id]);
                } else if (tx.type === 'expense') {
                    await client.query(`
                        UPDATE account_balances 
                        SET current_balance = current_balance - $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `, [tx.amount, tx.account_id]);
                }
            }
            
            await client.query('COMMIT');
            
            // Pobierz zaktualizowane stany kont
            const updatedBalances = await client.query(`
                SELECT 
                    a.name,
                    ab.initial_balance,
                    ab.current_balance,
                    ab.last_updated
                FROM 
                    accounts a
                JOIN 
                    account_balances ab ON a.id = ab.account_id
                ORDER BY 
                    a.name
            `);
            
            res.status(200).json({
                message: 'Stany kont zostały przeliczone',
                balances: updatedBalances.rows
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Błąd podczas przeliczania stanów kont:', error);
        res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message });
    }
};

module.exports = {
    getAccountBalances,
    updateAccountInitialBalance,
    recalculateAllAccountBalances
};
