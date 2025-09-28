const pool = require('../db/pool')

/**
 * Sprawdza czy po danej operacji saldo konta spadnie poniżej zera
 */
const checkAccountBalance = async (req, res) => {
	try {
		const { account, amount, excludeTransactionId } = req.body

		if (!account || !amount) {
			return res.status(400).json({ message: 'Brakujące dane: konto lub kwota' })
		}

		const client = await pool.connect()

		try {
			// Pobierz aktualne saldo konta
			const balanceResult = await client.query(
				`
                SELECT 
                    COALESCE(ab.current_balance, 0) AS current_balance
                FROM 
                    accounts a
                LEFT JOIN 
                    account_balances ab ON a.id = ab.account_id
                WHERE 
                    a.name = $1
            `,
				[account]
			)

			if (balanceResult.rows.length === 0) {
				return res.status(404).json({ message: 'Konto nie znalezione' })
			}

			const currentBalance = parseFloat(balanceResult.rows[0].current_balance)

			// Jeśli podano ID transakcji do wykluczenia, znajdź jej kwotę
			let excludedAmount = 0

			if (excludeTransactionId) {
				// Sprawdzamy, czy to wydatek czy transfer
				const transactionResult = await client.query(
					`
                    SELECT * FROM transactions WHERE id = $1
                `,
					[excludeTransactionId]
				)

				if (transactionResult.rows.length > 0) {
					const transaction = transactionResult.rows[0]
					if (transaction.account === account) {
						// To jest wydatek z tego konta - dodajemy jego wartość do salda
						excludedAmount = parseFloat(transaction.cost)
					}
				} else {
					// Sprawdź czy to jest transfer
					const transferResult = await client.query(
						`
                        SELECT * FROM transfers WHERE id = $1
                    `,
						[excludeTransactionId]
					)

					if (transferResult.rows.length > 0) {
						const transfer = transferResult.rows[0]
						if (transfer.from_account === account) {
							// To jest transfer wychodzący z tego konta - dodajemy jego wartość do salda
							excludedAmount = parseFloat(transfer.amount)
						}
					}
				}
			}

			// Oblicz prognozowane saldo po operacji
			const projectedBalance = currentBalance - amount + excludedAmount

			res.status(200).json({
				account,
				currentBalance,
				projectedBalance,
				willBeNegative: projectedBalance < 0,
			})
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas sprawdzania salda konta:', error)
		res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message })
	}
}

/**
 * Pobiera stany wszystkich kont
 */
const getAccountBalances = async (req, res) => {
	try {
		const client = await pool.connect()

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
            `)

			res.status(200).json(result.rows)
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas pobierania stanów kont:', error)
		res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message })
	}
}

/**
 * Aktualizuje stan początkowy konta
 */
const updateAccountInitialBalance = async (req, res) => {
	try {
		const { accountId, initialBalance } = req.body

		if (!accountId || initialBalance === undefined) {
			return res.status(400).json({ message: 'Brakujące dane: accountId lub initialBalance' })
		}

		const client = await pool.connect()

		try {
			await client.query('BEGIN')

			// Sprawdź, czy konto istnieje
			const accountCheck = await client.query('SELECT id FROM accounts WHERE id = $1', [accountId])

			if (accountCheck.rows.length === 0) {
				return res.status(404).json({ message: 'Konto o podanym ID nie istnieje' })
			}

			// Upsert - wstaw lub zaktualizuj stan konta
			await client.query(
				`
                INSERT INTO account_balances (account_id, initial_balance, current_balance)
                VALUES ($1, $2, $2)
                ON CONFLICT (account_id) 
                DO UPDATE SET 
                    initial_balance = $2,
                    current_balance = account_balances.current_balance + ($2 - account_balances.initial_balance),
                    last_updated = NOW()
            `,
				[accountId, initialBalance]
			)

			await client.query('COMMIT')

			res.status(200).json({
				message: 'Stan początkowy konta zaktualizowany pomyślnie',
				accountId,
				initialBalance,
			})
		} catch (error) {
			await client.query('ROLLBACK')
			throw error
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas aktualizacji stanu początkowego konta:', error)
		res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message })
	}
}

/**
 * Aktualizuje stan wszystkich kont na podstawie historycznych transakcji
 */
const recalculateAllAccountBalances = async (req, res) => {
	try {
		const client = await pool.connect()

		try {
			await client.query('BEGIN')

			// Ustaw wszystkie salda na wartości początkowe
			await client.query(`
                UPDATE account_balances
                SET current_balance = initial_balance,
                    last_updated = NOW()
            `)

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
            `)

			// Zaktualizuj salda na podstawie transakcji
			for (const tx of transactions.rows) {
				if (tx.type === 'income') {
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[tx.amount, tx.account_id]
					)
				} else if (tx.type === 'expense') {
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance - $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[tx.amount, tx.account_id]
					)
				}
			}

			await client.query('COMMIT')

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
            `)

			res.status(200).json({
				message: 'Stany kont zostały przeliczone',
				balances: updatedBalances.rows,
			})
		} catch (error) {
			await client.query('ROLLBACK')
			throw error
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas przeliczania stanów kont:', error)
		res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message })
	}
}

/**
 * Aktualizuje bieżące saldo konta
 */
const updateAccountCurrentBalance = async (req, res) => {
	try {
		const { accountName, currentBalance } = req.body

		if (!accountName || currentBalance === undefined) {
			return res.status(400).json({ message: 'Brakujące dane: accountName lub currentBalance' })
		}

		const client = await pool.connect()

		try {
			await client.query('BEGIN')

			// Sprawdź czy konto istnieje i pobierz jego ID
			const accountCheck = await client.query('SELECT id FROM accounts WHERE name = $1', [accountName])

			if (accountCheck.rows.length === 0) {
				return res.status(404).json({ message: 'Konto o podanej nazwie nie istnieje' })
			}

			const accountId = accountCheck.rows[0].id

			// Aktualizuj bieżące saldo konta
			await client.query(
				`
                UPDATE account_balances
                SET current_balance = $1,
                    last_updated = NOW()
                WHERE account_id = $2
            `,
				[currentBalance, accountId]
			)

			await client.query('COMMIT')

			res.status(200).json({
				message: 'Bieżące saldo konta zaktualizowane pomyślnie',
				accountName,
				currentBalance,
			})
		} catch (error) {
			await client.query('ROLLBACK')
			throw error
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas aktualizacji bieżącego salda konta:', error)
		res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message })
	}
}

// Rachunki: per-miesięczny stan i operacje
const getBillsAccountId = async client => {
	const r = await client.query("SELECT id FROM accounts WHERE name = 'Rachunki'")
	if (!r.rows.length) throw new Error('Konto Rachunki nie istnieje')
	return r.rows[0].id
}

const getBillsMonthState = async (req, res) => {
	const { monthId } = req.params // 'YYYY-MM'
	if (!/^\d{4}-\d{2}$/.test(monthId)) return res.status(400).json({ message: 'Nieprawidłowy format monthId' })
	const client = await pool.connect()
	try {
		const accountId = await getBillsAccountId(client)
		// Auto-seed jednorazowego salda dla 2025-08 jeśli brak wpisu
		if (monthId === '2025-08') {
			const check = await client.query('SELECT 1 FROM account_month_openings WHERE account_id = $1 AND month_id = $2', [
				accountId,
				monthId,
			])
			if (!check.rows.length) {
				await client.query(
					`INSERT INTO account_month_openings (account_id, month_id, opening_balance)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (account_id, month_id) DO NOTHING`,
					[accountId, monthId, 1208.06]
				)
			}
		}
		const openRes = await client.query(
			'SELECT opening_balance FROM account_month_openings WHERE account_id = $1 AND month_id = $2',
			[accountId, monthId]
		)
		const opening = openRes.rows[0]?.opening_balance || 0
		const dedRes = await client.query(
			'SELECT id, amount, deducted_on FROM bills_deductions WHERE account_id = $1 AND month_id = $2 ORDER BY deducted_on ASC, id ASC',
			[accountId, monthId]
		)
		const totalDeducted = dedRes.rows.reduce((s, r) => s + Number(r.amount), 0)
		res.json({ monthId, openingBalance: Number(opening), totalDeducted, deductions: dedRes.rows })
	} catch (e) {
		console.error(e)
		res.status(500).json({ message: 'Błąd pobierania stanu Rachunki', error: e.message })
	} finally {
		client.release()
	}
}

const setBillsOpeningBalance = async (req, res) => {
	const { monthId } = req.params
	const { openingBalance } = req.body
	if (!/^\d{4}-\d{2}$/.test(monthId)) return res.status(400).json({ message: 'Nieprawidłowy format monthId' })
	if (openingBalance === undefined || openingBalance === null)
		return res.status(400).json({ message: 'Brak openingBalance' })
	const client = await pool.connect()
	try {
		await client.query('BEGIN')
		const accountId = await getBillsAccountId(client)
		await client.query(
			`INSERT INTO account_month_openings (account_id, month_id, opening_balance)
             VALUES ($1, $2, $3)
             ON CONFLICT (account_id, month_id) DO UPDATE SET opening_balance = EXCLUDED.opening_balance`,
			[accountId, monthId, openingBalance]
		)
		await client.query('COMMIT')
		res.json({ message: 'Zapisano saldo początkowe Rachunki dla miesiąca', monthId, openingBalance })
	} catch (e) {
		await client.query('ROLLBACK')
		console.error(e)
		res.status(500).json({ message: 'Błąd zapisu salda początkowego', error: e.message })
	} finally {
		client.release()
	}
}

const listBillsDeductions = async (req, res) => {
	const { monthId } = req.params
	if (!/^\d{4}-\d{2}$/.test(monthId)) return res.status(400).json({ message: 'Nieprawidłowy format monthId' })
	const client = await pool.connect()
	try {
		const accountId = await getBillsAccountId(client)
		const r = await client.query(
			'SELECT id, amount, deducted_on FROM bills_deductions WHERE account_id = $1 AND month_id = $2 ORDER BY deducted_on ASC, id ASC',
			[accountId, monthId]
		)
		res.json({ monthId, deductions: r.rows })
	} catch (e) {
		console.error(e)
		res.status(500).json({ message: 'Błąd pobierania odjęć', error: e.message })
	} finally {
		client.release()
	}
}

const applyBillsDeduction = async (req, res) => {
	const { monthId } = req.params
	const { amount, date } = req.body || {}
	if (!/^\d{4}-\d{2}$/.test(monthId)) return res.status(400).json({ message: 'Nieprawidłowy format monthId' })
	const value = Number(amount)
	if (!isFinite(value) || value < 0) return res.status(400).json({ message: 'Nieprawidłowa kwota odjęcia' })
	const client = await pool.connect()
	try {
		await client.query('BEGIN')
		const accountId = await getBillsAccountId(client)
		const usedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
		const ins = await client.query(
			`INSERT INTO bills_deductions (account_id, month_id, amount, deducted_on)
             VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE)) RETURNING id, deducted_on`,
			[accountId, monthId, value, usedDate]
		)
		await client.query('COMMIT')
		res.status(201).json({ id: ins.rows[0].id, monthId, amount: value, deducted_on: ins.rows[0].deducted_on })
	} catch (e) {
		await client.query('ROLLBACK')
		console.error(e)
		res.status(500).json({ message: 'Błąd zapisu odjęcia', error: e.message })
	} finally {
		client.release()
	}
}

// Zwraca pełną historię odjęć dla konta "Rachunki"
const listAllBillsDeductions = async (req, res) => {
	const client = await pool.connect()
	try {
		const accountId = await getBillsAccountId(client)
		const r = await client.query(
			`SELECT id, month_id, amount, deducted_on
			     FROM bills_deductions
			     WHERE account_id = $1
			     ORDER BY deducted_on ASC, id ASC`,
			[accountId]
		)
		res.json({
			deductions: r.rows.map(x => ({
				id: x.id,
				month_id: x.month_id,
				amount: Number(x.amount),
				deducted_on: x.deducted_on,
			})),
		})
	} catch (e) {
		console.error(e)
		res.status(500).json({ message: 'Błąd pobierania wszystkich odjęć', error: e.message })
	} finally {
		client.release()
	}
}

module.exports = {
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
}
