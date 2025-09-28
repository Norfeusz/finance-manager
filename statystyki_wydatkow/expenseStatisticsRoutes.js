const express = require('express')
const router = express.Router()
const pool = require('../db/pool')

/**
 * GET /api/expense-statistics/:monthId
 * Pobierz statystyki wydatków dla danego miesiąca
 */
router.get('/:monthId', async (req, res) => {
	try {
		const { monthId } = req.params
		
		const client = await pool.connect()
		try {
			const query = `
				SELECT 
					es.id,
					es.month_id,
					es.category_section,
					es.subcategory_section,
					es.amount,
					es.is_open,
					es.last_edited
				FROM expense_statistics es
				WHERE es.month_id = $1
				ORDER BY es.category_section ASC, es.subcategory_section ASC NULLS FIRST
			`
			
			const result = await client.query(query, [monthId])
			res.json(result.rows)
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd pobierania statystyk wydatków:', error)
		res.status(500).json({ error: 'Błąd serwera podczas pobierania statystyk wydatków' })
	}
})

/**
 * POST /api/expense-statistics
 * Utwórz lub zaktualizuj statystykę wydatków
 */
router.post('/', async (req, res) => {
	try {
		const { monthId, categorySection, subcategorySection, amount } = req.body
		
		if (!monthId || !categorySection || amount === undefined) {
			return res.status(400).json({ error: 'Brak wymaganych pól: monthId, categorySection, amount' })
		}
		
		const client = await pool.connect()
		try {
			// Sprawdź czy rekord już istnieje
			const existingQuery = `
				SELECT id FROM expense_statistics 
				WHERE month_id = $1 AND category_section = $2
			`
			const existingResult = await client.query(existingQuery, [monthId, categorySection])
			
			if (existingResult.rows.length > 0) {
				// Aktualizuj istniejący rekord
				const updateQuery = `
					UPDATE expense_statistics 
					SET amount = $3, last_edited = NOW()
					WHERE month_id = $1 AND category_section = $2
					RETURNING *
				`
				const result = await client.query(updateQuery, [monthId, categorySection, amount])
				res.json(result.rows[0])
			} else {
				// Utwórz nowy rekord
				const insertQuery = `
					INSERT INTO expense_statistics (month_id, category_section, amount, is_open, last_edited)
					VALUES ($1, $2, $3, true, NOW())
					RETURNING *
				`
				const result = await client.query(insertQuery, [monthId, categorySection, amount])
				res.json(result.rows[0])
			}
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd zapisywania statystyki wydatków:', error)
		res.status(500).json({ error: 'Błąd serwera podczas zapisywania statystyki' })
	}
})

/**
 * PATCH /api/expense-statistics/:id/status
 * Zmień status otwarcia/zamknięcia statystyki
 */
router.patch('/:id/status', async (req, res) => {
	try {
		const { id } = req.params
		const { isOpen } = req.body
		
		const client = await pool.connect()
		try {
			const query = `
				UPDATE expense_statistics 
				SET is_open = $1, last_edited = NOW()
				WHERE id = $2
				RETURNING *
			`
			const result = await client.query(query, [isOpen, id])
			
			if (result.rows.length === 0) {
				return res.status(404).json({ error: 'Nie znaleziono statystyki o podanym ID' })
			}
			
			res.json(result.rows[0])
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd zmiany statusu statystyki:', error)
		res.status(500).json({ error: 'Błąd serwera podczas zmiany statusu' })
	}
})

/**
 * DELETE /api/expense-statistics/:id
 * Usuń statystykę wydatków
 */
router.delete('/:id', async (req, res) => {
	try {
		const { id } = req.params
		
		const client = await pool.connect()
		try {
			const query = 'DELETE FROM expense_statistics WHERE id = $1 RETURNING *'
			const result = await client.query(query, [id])
			
			if (result.rows.length === 0) {
				return res.status(404).json({ error: 'Nie znaleziono statystyki o podanym ID' })
			}
			
			res.json({ message: 'Statystyka została usunięta', deleted: result.rows[0] })
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd usuwania statystyki:', error)
		res.status(500).json({ error: 'Błąd serwera podczas usuwania statystyki' })
	}
})

/**
 * POST /api/expense-statistics/initialize
 * Inicjalizuj statystyki dla nowego miesiąca na podstawie kategorii z transakcji
 */
router.post('/initialize', async (req, res) => {
	try {
		const { monthId } = req.body
		
		if (!monthId) {
			return res.status(400).json({ error: 'Brak wymaganego pola: monthId' })
		}
		
		const client = await pool.connect()
		try {
			// Pobierz wszystkie kategorie z transakcji dla danego miesiąca
			const categoriesQuery = `
				SELECT DISTINCT c.name as category_name
				FROM transactions t
				JOIN categories c ON t.category_id = c.id
				WHERE t.month_id = $1 AND t.type = 'expense' AND c.name IS NOT NULL
				ORDER BY c.name
			`
			const categoriesResult = await client.query(categoriesQuery, [monthId])
			
			// Pobierz podkategorie dla wydatków codziennych z transakcji
			const subcategoriesQuery = `
				SELECT DISTINCT s.name as subcategory_name, c.name as category_name
				FROM transactions t
				JOIN categories c ON t.category_id = c.id
				JOIN subcategories s ON t.subcategory_id = s.id
				WHERE t.month_id = $1 AND t.type = 'expense' 
					AND c.name = 'Zakupy codzienne' AND s.name IS NOT NULL
				ORDER BY s.name
			`
			const subcategoriesResult = await client.query(subcategoriesQuery, [monthId])
			
			// Kategorie główne zgodne z systemem drugiego projektu
			const mainCategories = [
				'auta', 
				'dom', 
				'wyjścia i szama do domu', 
				'pies', 
				'prezenty',
				'wyjazdy',
				'rachunki',
				'subkonta'
			]
			
			// Podkategorie zakupów codziennych (bez kategorii "Dziecko")
			const subcategories = [
				'jedzenie',
				'słodycze', 
				'chemia', 
				'apteka', 
				'alkohol', 
				'higiena', 
				'kwiatki', 
				'zakupy'
			]
			
			// Wszystkie kategorie do inicjalizacji
			const allCategories = new Set([
				...categoriesResult.rows.map(row => row.category_name),
				...mainCategories,
				...subcategories,
				'ZC' // Suma zakupów codziennych
			])
			
			// Utwórz statystyki dla każdej kategorii
			for (const categoryName of allCategories) {
				// Sprawdź czy statystyka już istnieje
				const existsQuery = `
					SELECT id FROM expense_statistics 
					WHERE month_id = $1 AND category_section = $2
				`
				const existsResult = await client.query(existsQuery, [monthId, categoryName])
				
				if (existsResult.rows.length === 0) {
					let totalAmount = 0
					
					if (categoryName === 'ZC') {
						// Dla 'ZC' - suma wszystkich podkategorii zakupów codziennych
						const sumQuery = `
							SELECT COALESCE(SUM(t.amount), 0) as total
							FROM transactions t
							JOIN categories c ON t.category_id = c.id
							JOIN subcategories s ON t.subcategory_id = s.id
							WHERE t.month_id = $1 AND c.name = 'zakupy codzienne' AND t.type = 'expense'
						`
						const sumResult = await client.query(sumQuery, [monthId])
						totalAmount = parseFloat(sumResult.rows[0].total) || 0
					} else if (subcategories.includes(categoryName)) {
						// Dla podkategorii - suma z subcategories
						const sumQuery = `
							SELECT COALESCE(SUM(t.amount), 0) as total
							FROM transactions t
							JOIN categories c ON t.category_id = c.id
							JOIN subcategories s ON t.subcategory_id = s.id
							WHERE t.month_id = $1 AND c.name = 'zakupy codzienne' AND s.name = $2 AND t.type = 'expense'
						`
						const sumResult = await client.query(sumQuery, [monthId, categoryName])
						totalAmount = parseFloat(sumResult.rows[0].total) || 0
					} else {
						// Dla kategorii głównych - suma z categories
						const sumQuery = `
							SELECT COALESCE(SUM(t.amount), 0) as total
							FROM transactions t
							JOIN categories c ON t.category_id = c.id
							WHERE t.month_id = $1 AND c.name = $2 AND t.type = 'expense'
						`
						const sumResult = await client.query(sumQuery, [monthId, categoryName])
						totalAmount = parseFloat(sumResult.rows[0].total) || 0
					}
					
					// Utwórz statystykę
					const insertQuery = `
						INSERT INTO expense_statistics (month_id, category_section, amount, is_open, last_edited)
						VALUES ($1, $2, $3, true, NOW())
					`
					await client.query(insertQuery, [monthId, categoryName, totalAmount])
				}
			}
			
			// Utwórz statystyki dla podkategorii wydatków codziennych
			for (const subcategoryName of allSubcategories) {
				// Sprawdź czy statystyka podkategorii już istnieje
				const existsSubQuery = `
					SELECT id FROM expense_statistics 
					WHERE month_id = $1 AND category_section = 'Zakupy codzienne' AND subcategory_section = $2
				`
				const existsSubResult = await client.query(existsSubQuery, [monthId, subcategoryName])
				
				if (existsSubResult.rows.length === 0) {
					// Oblicz sumę dla tej podkategorii z transakcji
					const subSumQuery = `
						SELECT COALESCE(SUM(t.amount), 0) as total
						FROM transactions t
						JOIN categories c ON t.category_id = c.id
						JOIN subcategories s ON t.subcategory_id = s.id
						WHERE t.month_id = $1 AND c.name = 'Zakupy codzienne' 
							AND s.name = $2 AND t.type = 'expense'
					`
					const subSumResult = await client.query(subSumQuery, [monthId, subcategoryName])
					const subTotalAmount = parseFloat(subSumResult.rows[0].total) || 0
					
					// Utwórz statystykę podkategorii
					const insertSubQuery = `
						INSERT INTO expense_statistics (month_id, category_section, subcategory_section, amount, is_open, last_edited)
						VALUES ($1, 'Zakupy codzienne', $2, $3, true, NOW())
					`
					await client.query(insertSubQuery, [monthId, subcategoryName, subTotalAmount])
				}
			}
			
			res.json({ message: 'Statystyki zostały zainicjalizowane', monthId })
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd inicjalizacji statystyk:', error)
		res.status(500).json({ error: 'Błąd serwera podczas inicjalizacji statystyk' })
	}
})

/**
 * GET /api/expense-statistics/averages
 * Pobierz średnie wydatków для wszystkich kategorii
 */
router.get('/averages', async (req, res) => {
	try {
		const client = await pool.connect()
		try {
			const query = `
				SELECT 
					es.category_section,
					AVG(es.amount) as average_amount,
					COUNT(*) as months_count,
					MIN(es.amount) as min_amount,
					MAX(es.amount) as max_amount
				FROM expense_statistics es
				WHERE es.is_open = true AND es.amount > 0
				GROUP BY es.category_section
				ORDER BY average_amount DESC
			`
			
			const result = await client.query(query)
			res.json(result.rows)
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd pobierania średnich wydatków:', error)
		res.status(500).json({ error: 'Błąd serwera podczas pobierania średnich' })
	}
})

/**
 * GET /api/expense-statistics/category/:categoryName/details
 * Pobierz szczegółowe dane dla konkretnej kategorii ze wszystkich miesięcy
 */
router.get('/category/:categoryName/details', async (req, res) => {
	try {
		const { categoryName } = req.params
		
		const client = await pool.connect()
		try {
			const query = `
				SELECT 
					es.month_id,
					es.amount,
					es.is_open,
					es.last_edited,
					m.year,
					m.month
				FROM expense_statistics es
				JOIN months m ON es.month_id = m.id
				WHERE es.category_section = $1
				ORDER BY m.year DESC, m.month DESC
			`
			
			const result = await client.query(query, [categoryName])
			res.json(result.rows)
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd pobierania szczegółów kategorii:', error)
		res.status(500).json({ error: 'Błąd serwera podczas pobierania szczegółów kategorii' })
	}
})

/**
 * GET /api/expense-statistics/subcategories/:categoryId
 * Pobierz podkategorie dla danej kategorii głównej
 */
router.get('/subcategories/:categoryId', async (req, res) => {
	try {
		const { categoryId } = req.params
		
		const client = await pool.connect()
		try {
			const query = `
				SELECT 
					s.id,
					s.name,
					c.name as category_name
				FROM subcategories s
				JOIN categories c ON s.category_id = c.id
				WHERE s.category_id = $1
				ORDER BY s.name ASC
			`
			
			const result = await client.query(query, [categoryId])
			res.json(result.rows)
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd pobierania podkategorii:', error)
		res.status(500).json({ error: 'Błąd serwera podczas pobierania podkategorii' })
	}
})

/**
 * PATCH /api/expense-statistics/month/:monthId/toggle-all
 * Przełącz status wszystkich statystyk w miesiącu
 */
router.patch('/month/:monthId/toggle-all', async (req, res) => {
	try {
		const { monthId } = req.params
		const { isOpen } = req.body
		
		const client = await pool.connect()
		try {
			const query = `
				UPDATE expense_statistics 
				SET is_open = $1, last_edited = NOW()
				WHERE month_id = $2
				RETURNING *
			`
			const result = await client.query(query, [isOpen, monthId])
			
			res.json({ 
				message: `Wszystkie statystyki zostały ${isOpen ? 'otwarte' : 'zamknięte'}`,
				updated: result.rows.length,
				statistics: result.rows
			})
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd przełączania statusu wszystkich statystyk:', error)
		res.status(500).json({ error: 'Błąd serwera podczas przełączania statusu' })
	}
})

module.exports = router