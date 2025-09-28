const express = require('express')
const router = express.Router()
const { getTransactions } = require('../controllers/transactionController')
const pool = require('../db/pool')

// Simple test endpoint for all transactions
router.get('/simple-all', async (req, res) => {
	console.log('SIMPLE-ALL endpoint called')
	try {
		const pool = require('../db/pool')
		const client = await pool.connect()
		try {
			const result = await client.query('SELECT COUNT(*) FROM transactions')
			const count = result.rows[0].count
			console.log('Total transactions in DB:', count)

			const allTrans = await client.query(`
                SELECT t.id, t.type, t.amount, t.description, t.date,
                       a.name AS account_name, c.name AS category_name
                FROM transactions t
                LEFT JOIN accounts a ON t.account_id = a.id  
                LEFT JOIN categories c ON t.category_id = c.id
                ORDER BY t.date DESC LIMIT 50
            `)

			console.log('Returning', allTrans.rows.length, 'transactions')
			res.json({ total: count, returned: allTrans.rows.length, data: allTrans.rows })
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('SIMPLE-ALL ERROR:', error)
		res.status(500).json({ error: error.message })
	}
})

router.get('/', getTransactions)
router.get('/account/:accountName', getTransactions)

// DELETE endpoint for removing transactions
router.delete('/:id', async (req, res) => {
	try {
		const { id } = req.params
		const client = await pool.connect()

		try {
			// Check if transaction exists
			const checkResult = await client.query('SELECT id FROM transactions WHERE id = $1', [id])
			if (checkResult.rows.length === 0) {
				return res.status(404).json({ error: 'Transakcja nie została znaleziona' })
			}

			// Delete transaction
			await client.query('DELETE FROM transactions WHERE id = $1', [id])
			res.json({ success: true, message: 'Transakcja została usunięta' })
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas usuwania transakcji:', error)
		res.status(500).json({ error: error.message })
	}
})

module.exports = router
