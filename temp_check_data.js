const pool = require('./backend/db/pool')

;(async () => {
	const client = await pool.connect()
	try {
		// Sprawdź transfery na konto Rachunki (account_id=3)
		const transfersQuery = `
            SELECT month_id, SUM(amount) as total_transfers 
            FROM transactions 
            WHERE type='transfer' AND account_id=3 
            GROUP BY month_id 
            ORDER BY month_id
        `
		const transfers = await client.query(transfersQuery)
		console.log('Transfery na Rachunki (konto 3):', transfers.rows)

		// Sprawdź archived_statistics dla miesięcy 01-07 2025
		const archivedQuery = `
            SELECT year, month, SUM(amount::numeric) as total_archived
            FROM archived_statistics 
            WHERE year=2025 AND month BETWEEN 1 AND 7
            GROUP BY year, month 
            ORDER BY year, month
        `
		const archived = await client.query(archivedQuery)
		console.log('Archived statistics (styczeń-lipiec 2025):', archived.rows)

		// Sprawdź miesiące zamknięte w statistics
		const closedMonthsQuery = `
            SELECT DISTINCT month_id 
            FROM statistics 
            WHERE is_open = false 
            ORDER BY month_id
        `
		const closedMonths = await client.query(closedMonthsQuery)
		console.log(
			'Zamknięte miesiące w statistics:',
			closedMonths.rows.map(r => r.month_id)
		)
	} finally {
		client.release()
	}
})().catch(console.error)
