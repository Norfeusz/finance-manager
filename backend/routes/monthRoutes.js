const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

/**
 * GET /api/months - pobieranie wszystkich miesięcy
 */
router.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM months ORDER BY year DESC, month DESC'
      );
      
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas pobierania miesięcy:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania miesięcy', error: error.message });
  }
});

/**
 * GET /api/months/current - pobieranie bieżącego miesiąca
 */
router.get('/current', async (req, res) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM months WHERE year = $1 AND month = $2',
        [currentYear, currentMonth]
      );
      
      if (result.rows.length === 0) {
        // Automatycznie utworzymy bieżący miesiąc, jeśli nie istnieje
        const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(currentDate);
        
        const insertResult = await client.query(
          'INSERT INTO months (year, month, label) VALUES ($1, $2, $3) RETURNING *',
          [currentYear, currentMonth, monthLabel]
        );
        
        return res.json(insertResult.rows[0]);
      }
      
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas pobierania bieżącego miesiąca:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania bieżącego miesiąca', error: error.message });
  }
});

/**
 * GET /api/months/:id - pobieranie miesiąca po ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM months WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono miesiąca o podanym ID' });
      }
      
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas pobierania miesiąca:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania miesiąca', error: error.message });
  }
});

/**
 * POST /api/months - dodawanie nowego miesiąca
 */
router.post('/', async (req, res) => {
  try {
    const { year, month } = req.body;
    
    if (!year || !month) {
      return res.status(400).json({ message: 'Rok i miesiąc są wymagane' });
    }
    
    // Walidacja danych
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Nieprawidłowe dane. Miesiąc musi być w zakresie 1-12.' });
    }
    
    const client = await pool.connect();
    
    try {
      // Sprawdź, czy miesiąc już istnieje
      const checkResult = await client.query(
        'SELECT id FROM months WHERE year = $1 AND month = $2',
        [year, month]
      );
      
      if (checkResult.rows.length > 0) {
        return res.status(400).json({ message: 'Miesiąc o podanych parametrach już istnieje' });
      }
      
      // Utwórz etykietę dla miesiąca
      const date = new Date(year, month - 1);
      const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(date);
      
      const result = await client.query(
        'INSERT INTO months (year, month, label) VALUES ($1, $2, $3) RETURNING *',
        [year, month, monthLabel]
      );
      
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas tworzenia miesiąca:', error);
    res.status(500).json({ message: 'Błąd serwera podczas tworzenia miesiąca', error: error.message });
  }
});

/**
 * DELETE /api/months/:id - usuwanie miesiąca
 */
/**
 * PATCH /api/months/:id - aktualizacja budżetu miesiąca
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { budget } = req.body;
    
    if (budget === undefined) {
      return res.status(400).json({ message: 'Budżet jest wymagany' });
    }

    if (isNaN(parseFloat(budget)) || parseFloat(budget) < 0) {
      return res.status(400).json({ message: 'Budżet musi być liczbą nieujemną' });
    }
    
    const client = await pool.connect();
    
    try {
      // Sprawdź, czy miesiąc istnieje
      const checkResult = await client.query('SELECT * FROM months WHERE id = $1', [id]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono miesiąca o podanym ID' });
      }
      
      // Zaktualizuj budżet miesiąca
      const result = await client.query(
        'UPDATE months SET budget = $1 WHERE id = $2 RETURNING *',
        [parseFloat(budget), id]
      );
      
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas aktualizacji budżetu miesiąca:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji budżetu miesiąca', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Sprawdź, czy miesiąc istnieje
      const checkResult = await client.query('SELECT * FROM months WHERE id = $1', [id]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono miesiąca o podanym ID' });
      }
      
      const month = checkResult.rows[0];
      
      // Sprawdź, czy miesiąc ma transakcje
      const transactionsCheck = await client.query(
        'SELECT COUNT(*) FROM transactions WHERE month_id = $1',
        [id]
      );
      
      if (parseInt(transactionsCheck.rows[0].count) > 0) {
        return res.status(400).json({
          message: 'Nie można usunąć miesiąca, który ma transakcje',
          transactionCount: parseInt(transactionsCheck.rows[0].count)
        });
      }
      
      // Usuń miesiąc
      await client.query('DELETE FROM months WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      res.json({ message: 'Miesiąc został pomyślnie usunięty', month });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas usuwania miesiąca:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania miesiąca', error: error.message });
  }
});

module.exports = router;
