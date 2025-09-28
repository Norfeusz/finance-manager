const express = require('express')
const router = express.Router()
const pool = require('../db/pool')
const {
	getAccountBalances,
	updateAccountInitialBalance,
	recalculateAllAccountBalances,
	checkAccountBalance,
	updateAccountCurrentBalance,
	getBillsMonthState,
	setBillsOpeningBalance,
	listBillsDeductions,
	applyBillsDeduction,
	listAllBillsDeductions,
} = require('../controllers/accountController')
const { getTransactions } = require('../controllers/transactionController')

/**
 * GET /api/accounts/balances - pobieranie stanów wszystkich kont
 */
router.get('/balances', getAccountBalances)

/**
 * POST /api/accounts/initial-balance - aktualizacja stanu początkowego konta
 */
router.post('/initial-balance', updateAccountInitialBalance)

/**
 * GET /api/accounts/:accountName/transactions - pobieranie transakcji dla konkretnego konta
 */
router.get('/:accountName/transactions', getTransactions)

/**
 * POST /api/accounts/recalculate - przeliczanie wszystkich stanów kont
 */
router.post('/recalculate', recalculateAllAccountBalances)

/**
 * POST /api/accounts/check-balance - sprawdzanie czy transakcja nie spowoduje ujemnego salda
 */
router.post('/check-balance', checkAccountBalance)

/**
 * PUT /api/accounts/current-balance - aktualizacja bieżącego salda konta
 */
router.put('/current-balance', updateAccountCurrentBalance)

// Rachunki: stan miesięczny i operacje
router.get('/bills/:monthId', getBillsMonthState)
router.post('/bills/:monthId/opening', setBillsOpeningBalance)
router.get('/bills/:monthId/deductions', listBillsDeductions)
router.post('/bills/:monthId/deduct', applyBillsDeduction)
// Wszystkie odjęcia dla Rachunki (pełna historia)
router.get('/bills/deductions/all', listAllBillsDeductions)

// Rachunki: definicje rachunków i pozycje miesięczne
router.get('/bills/:monthId/items', async (req, res) => {
	const { monthId } = req.params
	const pool = require('../db/pool')
	if (!/^\d{4}-\d{2}$/.test(monthId)) return res.status(400).json({ message: 'Nieprawidłowy format monthId' })
	const client = await pool.connect()
	try {
		const oneOff = await client.query(
			'SELECT id, name, recipient, amount FROM monthly_bills WHERE month_id = $1 ORDER BY id',
			[monthId]
		)
		// Aktywne stałe rachunki, które obejmują ten miesiąc
		const rec = await client.query(
			`
      SELECT id, name, recipient, amount FROM recurring_bills 
      WHERE is_active = TRUE AND start_month_id <= $1 AND (end_month_id IS NULL OR end_month_id >= $1)
      ORDER BY id
    `,
			[monthId]
		)
		res.json({ monthId, recurring: rec.rows, oneOff: oneOff.rows })
	} catch (e) {
		res.status(500).json({ message: 'Błąd pobierania rachunków', error: e.message })
	} finally {
		client.release()
	}
})

router.post('/bills/:monthId/items', async (req, res) => {
	const { monthId } = req.params
	const { name, recipient, amount, isRecurring } = req.body || {}
	const pool = require('../db/pool')
	if (!/^\d{4}-\d{2}$/.test(monthId)) return res.status(400).json({ message: 'Nieprawidłowy format monthId' })
	if (!name || amount == null) return res.status(400).json({ message: 'Brak nazwy lub kwoty' })
	const val = Number(amount)
	if (!isFinite(val) || val < 0) return res.status(400).json({ message: 'Nieprawidłowa kwota' })
	const client = await pool.connect()
	try {
		if (isRecurring) {
			const ins = await client.query(
				`INSERT INTO recurring_bills (name, recipient, amount, start_month_id, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id, name, recipient, amount`,
				[name, recipient || null, val, monthId]
			)
			res.status(201).json({ recurring: ins.rows[0] })
		} else {
			const ins = await client.query(
				`INSERT INTO monthly_bills (month_id, name, recipient, amount)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, recipient, amount`,
				[monthId, name, recipient || null, val]
			)
			res.status(201).json({ oneOff: ins.rows[0] })
		}
	} catch (e) {
		res.status(500).json({ message: 'Błąd zapisu rachunku', error: e.message })
	} finally {
		client.release()
	}
})

/**
 * GET /api/accounts - pobieranie wszystkich kont
 */
router.get('/', async (req, res) => {
	try {
		const client = await pool.connect()

		try {
			const result = await client.query('SELECT * FROM accounts ORDER BY name')
			res.json(result.rows)
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas pobierania kont:', error)
		res.status(500).json({ message: 'Błąd serwera podczas pobierania kont', error: error.message })
	}
})

/**
 * GET /api/accounts/:id - pobieranie konta po ID
 */
router.get('/:id', async (req, res) => {
	try {
		const { id } = req.params
		const client = await pool.connect()

		try {
			const result = await client.query('SELECT * FROM accounts WHERE id = $1', [id])

			if (result.rows.length === 0) {
				return res.status(404).json({ message: 'Nie znaleziono konta o podanym ID' })
			}

			res.json(result.rows[0])
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas pobierania konta:', error)
		res.status(500).json({ message: 'Błąd serwera podczas pobierania konta', error: error.message })
	}
})

/**
 * POST /api/accounts - dodawanie nowego konta
 */
router.post('/', async (req, res) => {
	try {
		const { name } = req.body

		if (!name) {
			return res.status(400).json({ message: 'Nazwa konta jest wymagana' })
		}

		const client = await pool.connect()

		try {
			// Sprawdź, czy konto o takiej nazwie już istnieje
			const checkResult = await client.query('SELECT id FROM accounts WHERE name = $1', [name])

			if (checkResult.rows.length > 0) {
				return res.status(400).json({ message: 'Konto o podanej nazwie już istnieje' })
			}

			const result = await client.query('INSERT INTO accounts (name) VALUES ($1) RETURNING *', [name])

			res.status(201).json(result.rows[0])
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas tworzenia konta:', error)
		res.status(500).json({ message: 'Błąd serwera podczas tworzenia konta', error: error.message })
	}
})

/**
 * PUT /api/accounts/:id - aktualizacja konta
 */
router.put('/:id', async (req, res) => {
	try {
		const { id } = req.params
		const { name } = req.body

		if (!name) {
			return res.status(400).json({ message: 'Nazwa konta jest wymagana' })
		}

		const client = await pool.connect()

		try {
			// Sprawdź, czy konto o podanym ID istnieje
			const checkResult = await client.query('SELECT id FROM accounts WHERE id = $1', [id])

			if (checkResult.rows.length === 0) {
				return res.status(404).json({ message: 'Nie znaleziono konta o podanym ID' })
			}

			// Sprawdź, czy inna nazwa już istnieje
			const nameCheckResult = await client.query('SELECT id FROM accounts WHERE name = $1 AND id <> $2', [name, id])

			if (nameCheckResult.rows.length > 0) {
				return res.status(400).json({ message: 'Konto o podanej nazwie już istnieje' })
			}

			const result = await client.query('UPDATE accounts SET name = $1 WHERE id = $2 RETURNING *', [name, id])

			res.json(result.rows[0])
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas aktualizacji konta:', error)
		res.status(500).json({ message: 'Błąd serwera podczas aktualizacji konta', error: error.message })
	}
})

/**
 * DELETE /api/accounts/:id - usuwanie konta
 */
router.delete('/:id', async (req, res) => {
	try {
		const { id } = req.params
		const client = await pool.connect()

		try {
			// Sprawdź, czy konto jest używane w transakcjach
			const transactionsCheck = await client.query('SELECT COUNT(*) FROM transactions WHERE account_id = $1', [id])

			if (parseInt(transactionsCheck.rows[0].count) > 0) {
				return res.status(400).json({
					message: 'Nie można usunąć konta, które jest używane w transakcjach',
					transactionCount: parseInt(transactionsCheck.rows[0].count),
				})
			}

			// Usuń konto
			const result = await client.query('DELETE FROM accounts WHERE id = $1 RETURNING *', [id])

			if (result.rows.length === 0) {
				return res.status(404).json({ message: 'Nie znaleziono konta o podanym ID' })
			}

			res.json({ message: 'Konto zostało pomyślnie usunięte', account: result.rows[0] })
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas usuwania konta:', error)
		res.status(500).json({ message: 'Błąd serwera podczas usuwania konta', error: error.message })
	}
})

module.exports = router
