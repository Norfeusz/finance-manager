const pool = require('./backend/db/pool')

;(async () => {
	const client = await pool.connect()
	try {
		// Ustawienie kategorii głównych (is_main = true)
		await client.query('UPDATE categories SET is_main = true WHERE id IN (3, 4, 7, 17, 26, 28, 29)')
		console.log('Kategorie główne ustawione')

		// Ustawienie kategorii niepodstawowych (is_main = false)
		await client.query('UPDATE categories SET is_main = false WHERE id IN (23, 24, 25)')
		console.log('Kategorie niepodstawowe ustawione')

		// Sprawdzenie wyniku
		const result = await client.query('SELECT id, name, is_main FROM categories ORDER BY id')
		console.log('Stan kategorii:', result.rows)
	} finally {
		client.release()
	}
})().catch(console.error)
