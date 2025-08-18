const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { getAccountBalances, updateAccountInitialBalance, recalculateAllAccountBalances } = require('../controllers/accountController');

/**
 * GET /api/accounts/balances - pobieranie stanów wszystkich kont
 */
router.get('/balances', getAccountBalances);

/**
 * POST /api/accounts/initial-balance - aktualizacja stanu początkowego konta
 */
router.post('/initial-balance', updateAccountInitialBalance);

/**
 * POST /api/accounts/recalculate - przeliczanie wszystkich stanów kont
 */
router.post('/recalculate', recalculateAllAccountBalances);

/**
 * GET /api/accounts - pobieranie wszystkich kont
 */
router.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM accounts ORDER BY name');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas pobierania kont:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania kont', error: error.message });
  }
});

/**
 * GET /api/accounts/:id - pobieranie konta po ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM accounts WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono konta o podanym ID' });
      }
      
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas pobierania konta:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania konta', error: error.message });
  }
});

/**
 * POST /api/accounts - dodawanie nowego konta
 */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Nazwa konta jest wymagana' });
    }
    
    const client = await pool.connect();
    
    try {
      // Sprawdź, czy konto o takiej nazwie już istnieje
      const checkResult = await client.query('SELECT id FROM accounts WHERE name = $1', [name]);
      
      if (checkResult.rows.length > 0) {
        return res.status(400).json({ message: 'Konto o podanej nazwie już istnieje' });
      }
      
      const result = await client.query(
        'INSERT INTO accounts (name) VALUES ($1) RETURNING *', 
        [name]
      );
      
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas tworzenia konta:', error);
    res.status(500).json({ message: 'Błąd serwera podczas tworzenia konta', error: error.message });
  }
});

/**
 * PUT /api/accounts/:id - aktualizacja konta
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Nazwa konta jest wymagana' });
    }
    
    const client = await pool.connect();
    
    try {
      // Sprawdź, czy konto o podanym ID istnieje
      const checkResult = await client.query('SELECT id FROM accounts WHERE id = $1', [id]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono konta o podanym ID' });
      }
      
      // Sprawdź, czy inna nazwa już istnieje
      const nameCheckResult = await client.query(
        'SELECT id FROM accounts WHERE name = $1 AND id <> $2',
        [name, id]
      );
      
      if (nameCheckResult.rows.length > 0) {
        return res.status(400).json({ message: 'Konto o podanej nazwie już istnieje' });
      }
      
      const result = await client.query(
        'UPDATE accounts SET name = $1 WHERE id = $2 RETURNING *',
        [name, id]
      );
      
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas aktualizacji konta:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji konta', error: error.message });
  }
});

/**
 * DELETE /api/accounts/:id - usuwanie konta
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      // Sprawdź, czy konto jest używane w transakcjach
      const transactionsCheck = await client.query(
        'SELECT COUNT(*) FROM transactions WHERE account_id = $1',
        [id]
      );
      
      if (parseInt(transactionsCheck.rows[0].count) > 0) {
        return res.status(400).json({
          message: 'Nie można usunąć konta, które jest używane w transakcjach',
          transactionCount: parseInt(transactionsCheck.rows[0].count)
        });
      }
      
      // Usuń konto
      const result = await client.query('DELETE FROM accounts WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono konta o podanym ID' });
      }
      
      res.json({ message: 'Konto zostało pomyślnie usunięte', account: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas usuwania konta:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania konta', error: error.message });
  }
});

module.exports = router;
