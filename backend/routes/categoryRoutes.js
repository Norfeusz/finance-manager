const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

/**
 * GET /api/categories - pobieranie wszystkich kategorii z podkategoriami
 */
router.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      // Pobieramy wszystkie kategorie
      const categoriesResult = await client.query('SELECT * FROM categories ORDER BY name');
      const categories = categoriesResult.rows;
      
      // Dla każdej kategorii pobieramy jej podkategorie
      for (let category of categories) {
        const subcategoriesResult = await client.query(
          'SELECT * FROM subcategories WHERE category_id = $1 ORDER BY name',
          [category.id]
        );
        
        category.subcategories = subcategoriesResult.rows;
      }
      
      res.json(categories);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas pobierania kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania kategorii', error: error.message });
  }
});

/**
 * GET /api/categories/:id - pobieranie kategorii po ID z podkategoriami
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      const categoryResult = await client.query('SELECT * FROM categories WHERE id = $1', [id]);
      
      if (categoryResult.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono kategorii o podanym ID' });
      }
      
      const category = categoryResult.rows[0];
      
      const subcategoriesResult = await client.query(
        'SELECT * FROM subcategories WHERE category_id = $1 ORDER BY name',
        [category.id]
      );
      
      category.subcategories = subcategoriesResult.rows;
      
      res.json(category);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas pobierania kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania kategorii', error: error.message });
  }
});

/**
 * POST /api/categories - dodawanie nowej kategorii
 */
router.post('/', async (req, res) => {
  try {
    const { name, subcategories = [] } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Nazwa kategorii jest wymagana' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Sprawdź, czy kategoria o takiej nazwie już istnieje
      const checkResult = await client.query('SELECT id FROM categories WHERE name = $1', [name]);
      
      if (checkResult.rows.length > 0) {
        return res.status(400).json({ message: 'Kategoria o podanej nazwie już istnieje' });
      }
      
      // Dodaj nową kategorię
      const categoryResult = await client.query(
        'INSERT INTO categories (name) VALUES ($1) RETURNING *', 
        [name]
      );
      
      const categoryId = categoryResult.rows[0].id;
      const createdSubcategories = [];
      
      // Dodaj podkategorie, jeśli istnieją
      for (const subcategory of subcategories) {
        if (subcategory && typeof subcategory === 'string') {
          const subcategoryResult = await client.query(
            'INSERT INTO subcategories (name, category_id) VALUES ($1, $2) RETURNING *',
            [subcategory, categoryId]
          );
          
          createdSubcategories.push(subcategoryResult.rows[0]);
        }
      }
      
      await client.query('COMMIT');
      
      const result = {
        ...categoryResult.rows[0],
        subcategories: createdSubcategories
      };
      
      res.status(201).json(result);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas tworzenia kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera podczas tworzenia kategorii', error: error.message });
  }
});

/**
 * PUT /api/categories/:id - aktualizacja kategorii
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Nazwa kategorii jest wymagana' });
    }
    
    const client = await pool.connect();
    
    try {
      // Sprawdź, czy kategoria o podanym ID istnieje
      const checkResult = await client.query('SELECT id FROM categories WHERE id = $1', [id]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono kategorii o podanym ID' });
      }
      
      // Sprawdź, czy inna kategoria o tej nazwie już istnieje
      const nameCheckResult = await client.query(
        'SELECT id FROM categories WHERE name = $1 AND id <> $2',
        [name, id]
      );
      
      if (nameCheckResult.rows.length > 0) {
        return res.status(400).json({ message: 'Kategoria o podanej nazwie już istnieje' });
      }
      
      const result = await client.query(
        'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
        [name, id]
      );
      
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas aktualizacji kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji kategorii', error: error.message });
  }
});

/**
 * DELETE /api/categories/:id - usuwanie kategorii
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Sprawdź, czy kategoria jest używana w transakcjach
      const transactionsCheck = await client.query(
        'SELECT COUNT(*) FROM transactions WHERE category_id = $1',
        [id]
      );
      
      if (parseInt(transactionsCheck.rows[0].count) > 0) {
        return res.status(400).json({
          message: 'Nie można usunąć kategorii, która jest używana w transakcjach',
          transactionCount: parseInt(transactionsCheck.rows[0].count)
        });
      }
      
      // Usuń wszystkie podkategorie należące do tej kategorii
      await client.query('DELETE FROM subcategories WHERE category_id = $1', [id]);
      
      // Usuń kategorię
      const result = await client.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Nie znaleziono kategorii o podanym ID' });
      }
      
      await client.query('COMMIT');
      res.json({ message: 'Kategoria została pomyślnie usunięta', category: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas usuwania kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania kategorii', error: error.message });
  }
});

/**
 * POST /api/categories/:categoryId/subcategories - dodawanie nowej podkategorii
 */
router.post('/:categoryId/subcategories', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Nazwa podkategorii jest wymagana' });
    }
    
    const client = await pool.connect();
    
    try {
      // Sprawdź, czy kategoria istnieje
      const categoryCheck = await client.query('SELECT id FROM categories WHERE id = $1', [categoryId]);
      
      if (categoryCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono kategorii o podanym ID' });
      }
      
      // Sprawdź, czy podkategoria o takiej nazwie już istnieje w tej kategorii
      const subcategoryCheck = await client.query(
        'SELECT id FROM subcategories WHERE name = $1 AND category_id = $2',
        [name, categoryId]
      );
      
      if (subcategoryCheck.rows.length > 0) {
        return res.status(400).json({ message: 'Podkategoria o podanej nazwie już istnieje w tej kategorii' });
      }
      
      // Dodaj nową podkategorię
      const result = await client.query(
        'INSERT INTO subcategories (name, category_id) VALUES ($1, $2) RETURNING *',
        [name, categoryId]
      );
      
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas dodawania podkategorii:', error);
    res.status(500).json({ message: 'Błąd serwera podczas dodawania podkategorii', error: error.message });
  }
});

/**
 * PUT /api/categories/:categoryId/subcategories/:id - aktualizacja podkategorii
 */
router.put('/:categoryId/subcategories/:id', async (req, res) => {
  try {
    const { categoryId, id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Nazwa podkategorii jest wymagana' });
    }
    
    const client = await pool.connect();
    
    try {
      // Sprawdź, czy podkategoria istnieje w podanej kategorii
      const subcategoryCheck = await client.query(
        'SELECT id FROM subcategories WHERE id = $1 AND category_id = $2',
        [id, categoryId]
      );
      
      if (subcategoryCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono podkategorii o podanym ID w tej kategorii' });
      }
      
      // Sprawdź, czy inna podkategoria o tej nazwie już istnieje w tej kategorii
      const nameCheckResult = await client.query(
        'SELECT id FROM subcategories WHERE name = $1 AND category_id = $2 AND id <> $3',
        [name, categoryId, id]
      );
      
      if (nameCheckResult.rows.length > 0) {
        return res.status(400).json({ message: 'Podkategoria o podanej nazwie już istnieje w tej kategorii' });
      }
      
      const result = await client.query(
        'UPDATE subcategories SET name = $1 WHERE id = $2 AND category_id = $3 RETURNING *',
        [name, id, categoryId]
      );
      
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas aktualizacji podkategorii:', error);
    res.status(500).json({ message: 'Błąd serwera podczas aktualizacji podkategorii', error: error.message });
  }
});

/**
 * DELETE /api/categories/:categoryId/subcategories/:id - usuwanie podkategorii
 */
router.delete('/:categoryId/subcategories/:id', async (req, res) => {
  try {
    const { categoryId, id } = req.params;
    const client = await pool.connect();
    
    try {
      // Sprawdź, czy podkategoria jest używana w transakcjach
      const transactionsCheck = await client.query(
        'SELECT COUNT(*) FROM transactions WHERE subcategory_id = $1',
        [id]
      );
      
      if (parseInt(transactionsCheck.rows[0].count) > 0) {
        return res.status(400).json({
          message: 'Nie można usunąć podkategorii, która jest używana w transakcjach',
          transactionCount: parseInt(transactionsCheck.rows[0].count)
        });
      }
      
      // Usuń podkategorię
      const result = await client.query(
        'DELETE FROM subcategories WHERE id = $1 AND category_id = $2 RETURNING *',
        [id, categoryId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono podkategorii o podanym ID w tej kategorii' });
      }
      
      res.json({ message: 'Podkategoria została pomyślnie usunięta', subcategory: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas usuwania podkategorii:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania podkategorii', error: error.message });
  }
});

module.exports = router;
