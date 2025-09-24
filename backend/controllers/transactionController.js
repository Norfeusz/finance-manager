const path = require('path')
const pool = require('../db/pool')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

/**
 * Pobiera transakcje z bazy danych PostgreSQL
 */
const getTransactions = async (req, res) => {
	console.log('START getTransactions')
	try {
		const year = req.query.year || new Date().getFullYear()
		const month = req.query.month || new Date().getMonth() + 1
		const monthIdParam = req.query.month_id // nowy bezpośredni identyfikator w formacie YYYY-MM
		const accountName = req.query.account || req.params.accountName
		console.log(
			'[getTransactions] accountName param =',
			accountName,
			'query.month_id =',
			req.query.month_id,
			'year=',
			req.query.year,
			'month=',
			req.query.month
		)

		const client = await pool.connect()

		try {
			// Pobierz ID miesiąca
			let monthResult
			let monthId
			let whereClause = ''
			let queryParams = []

			if (accountName) {
				// Jeśli podano nazwę konta, pobierz transakcje dla tego widoku
				console.log(`Pobieranie transakcji dla konta: ${accountName}`)

				const accountResult = await client.query('SELECT id FROM accounts WHERE name = $1', [accountName])

				if (accountResult.rows.length === 0) {
					// Jeśli konto nie istnieje, zwróć pustą tablicę
					return res.status(200).json({ transactions: [], balance: 0 })
				}

				const accountId = accountResult.rows[0].id

				if (accountName === 'KWNR') {
					// Specjalny przypadek: KWNR ma pokazywać całą historię wydatków KWNR
					// (niezależnie od tego, na jakim koncie były historycznie zapisane)
					// oraz wszystkie operacje wykonane bezpośrednio na koncie KWNR (np. wpływy).
					// Pokazujemy:
					// - wszystkie operacje na koncie KWNR (t.account_id = KWNR)
					// - wszystkie pozycje w kategoriach związanych z KWNR (np. 'Wydatek KWNR', 'Transfer na KWNR', inne z 'KWNR' w nazwie)
					// - fallback: wpisy z tekstowym wzmiankowaniem 'KWNR' w opisie/extra
					whereClause = `WHERE t.account_id = $1
                                   OR c.name = 'Wydatek KWNR'
                                   OR c.name = 'Transfer na KWNR'
                                   OR c.name ILIKE '%KWNR%'
                                   OR t.description ILIKE '%KWNR%'
                                   OR t.extra_description ILIKE '%KWNR%'`
					queryParams = [accountId]
					console.log('[KWNR] whereClause:', whereClause, 'params:', queryParams)
				} else if (accountName === 'Rachunki') {
					// Specjalny przypadek: Rachunki – oprócz własnych transakcji pokaż również transfery "do: Rachunki"
					whereClause = `WHERE (
						t.account_id = $1
						OR t.description = 'Transfer do: Rachunki'
						OR t.description ILIKE 'Transfer do: Rachunki%'
					)`
					queryParams = [accountId]
					if (monthIdParam) {
						whereClause += ' AND t.month_id = $2'
						queryParams.push(monthIdParam)
					} else if (req.query.year || req.query.month) {
						const y = parseInt(req.query.year)
						const m = parseInt(req.query.month)
						if (!isNaN(y) && !isNaN(m)) {
							const mres = await client.query('SELECT id FROM months WHERE year = $1 AND month = $2', [y, m])
							if (mres.rows.length > 0) {
								const mid = mres.rows[0].id
								whereClause += ' AND t.month_id = $2'
								queryParams.push(mid)
							}
						}
					}
					console.log('[RACHUNKI] whereClause:', whereClause, 'params:', queryParams)
				} else {
					// Standard: tylko transakcje danego konta
					whereClause = 'WHERE t.account_id = $1'
					queryParams = [accountId]

					// Opcjonalnie zawęź do miesiąca, jeśli klient jawnie go podał
					if (monthIdParam) {
						whereClause += ' AND t.month_id = $2'
						queryParams.push(monthIdParam)
					} else if (req.query.year || req.query.month) {
						// Jeśli podano year/month w zapytaniu, spróbuj zamienić na month_id
						const y = parseInt(req.query.year)
						const m = parseInt(req.query.month)
						if (!isNaN(y) && !isNaN(m)) {
							const mres = await client.query('SELECT id FROM months WHERE year = $1 AND month = $2', [y, m])
							if (mres.rows.length > 0) {
								const mid = mres.rows[0].id
								whereClause += ' AND t.month_id = $2'
								queryParams.push(mid)
							}
						}
					}
					console.log('[ACCOUNT] whereClause:', whereClause, 'params:', queryParams)
				}

				// Pobierz aktualne saldo konta
				const balanceResult = await client.query('SELECT current_balance FROM account_balances WHERE account_id = $1', [
					accountId,
				])

				const balance = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].current_balance) : 0
			} else {
				if (monthIdParam) {
					// Używamy bezpośrednio tekstowego month_id
					monthId = monthIdParam
					whereClause = 'WHERE t.month_id = $1'
					queryParams = [monthId]
				} else {
					// Legacy: year + month -> month_id
					monthResult = await client.query('SELECT id FROM months WHERE year = $1 AND month = $2', [year, month])
					if (monthResult.rows.length === 0) {
						return res.status(200).json([])
					}
					monthId = monthResult.rows[0].id
					whereClause = 'WHERE t.month_id = $1'
					queryParams = [monthId]
				}
			}

			// Najpierw sprawdźmy, czy tabela ma nowe kolumny
			const checkColumnsResult = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'transactions' 
                AND column_name IN ('source_account_id', 'source_account_name')
            `)

			// Sprawdź, czy obie kolumny istnieją
			const hasSourceColumns = checkColumnsResult.rows.length === 2
			console.log(
				`Tabela transactions ${hasSourceColumns ? 'ma' : 'nie ma'} kolumn source_account_id i source_account_name`
			)

			// Pobierz wszystkie transakcje dla danego kryterium (miesiąc lub konto) wraz z powiązanymi danymi
			let query
			// Zawsze dołączamy join do categories (alias c), bo whereClause dla KWNR może referować c.name
			if (hasSourceColumns) {
				query = `SELECT 
                    t.id, t.type, t.amount, t.description, t.extra_description, t.date AS raw_date, t.date, t.balance_after,
                    t.source_account_id, t.source_account_name, -- Nowe kolumny
                    a.name AS account_name,
                    c.name AS category_name,
                    sc.name AS subcategory_name
                FROM 
                    transactions t
                LEFT JOIN 
                    accounts a ON t.account_id = a.id
                LEFT JOIN 
                    categories c ON t.category_id = c.id
                LEFT JOIN 
                    subcategories sc ON t.subcategory_id = sc.id
                ${whereClause}
                ORDER BY 
                    t.date DESC, t.id DESC`
			} else {
				// Zapytanie bez nowych kolumn
				query = `SELECT 
                    t.id, t.type, t.amount, t.description, t.extra_description, t.date AS raw_date, t.date, t.balance_after,
                    a.name AS account_name,
                    c.name AS category_name,
                    sc.name AS subcategory_name
                FROM 
                    transactions t
                LEFT JOIN 
                    accounts a ON t.account_id = a.id
                LEFT JOIN 
                    categories c ON t.category_id = c.id
                LEFT JOIN 
                    subcategories sc ON t.subcategory_id = sc.id
                ${whereClause}
                ORDER BY 
                    t.date DESC, t.id DESC`
			}

			console.log('[QUERY] Executing SQL with whereClause:', whereClause)
			const transactionsResult = await client.query(query, queryParams)
			console.log('[QUERY] Rows returned:', transactionsResult.rows.length)

			// Mapowanie kategorii z bazy danych na kategorie frontendu
			const categoryMapping = {
				'zakupy codzienne': 'zakupy codzienne',
				auta: 'auta',
				dom: 'dom',
				'wyjścia i szama do domu': 'wyjścia i szama do domu',
				pies: 'pies',
				prezenty: 'prezenty',
			}

			// Mapowanie podkategorii z bazy danych na podkategorie frontendu
			const subcategoryMapping = {
				jedzenie: 'jedzenie',
				słodycze: 'słodycze',
				alkohol: 'alkohol',
				chemia: 'chemia',
				higiena: 'higiena',
				apteka: 'apteka',
			}

			// Formatuj dane do struktury, która jest oczekiwana przez frontend
			const formattedTransactions = transactionsResult.rows.map(transaction => {
				console.log('Przetwarzam transakcję z bazy:', JSON.stringify(transaction, null, 2))
				if (transaction.raw_date && transaction.date) {
					console.log(
						'[DBG DATE] raw_date=',
						transaction.raw_date,
						'date field=',
						transaction.date,
						'id=',
						transaction.id
					)
				}

				// Formatuj datę z bazy danych do formatu YYYY-MM-DD
				let formattedDate = transaction.date
				// Normalizacja: jeśli driver zwrócił ISO z Z (np. 2025-08-05T22:00:00.000Z) dla daty 2025-08-06 lokalnie
				if (typeof formattedDate === 'string' && /T\d{2}:\d{2}:\d{2}(.\d+)?Z$/.test(formattedDate)) {
					const d = new Date(formattedDate)
					const y = d.getFullYear()
					const m = String(d.getMonth() + 1).padStart(2, '0')
					const day = String(d.getDate()).padStart(2, '0')
					formattedDate = `${y}-${m}-${day}`
				}
				if (formattedDate instanceof Date) {
					const y = formattedDate.getFullYear()
					const m = String(formattedDate.getMonth() + 1).padStart(2, '0')
					const dLocal = String(formattedDate.getDate()).padStart(2, '0')
					formattedDate = `${y}-${m}-${dLocal}`
				} else if (typeof formattedDate === 'string' && formattedDate.includes('T')) {
					// Jeśli data zawiera 'T', jest w formacie ISO
					formattedDate = formattedDate.split('T')[0]
				}
				console.log('[DBG DATE AFTER FORMAT]', transaction.id, formattedDate)

				// Mapuj kategorie z bazy danych na nazwy używane w frontendzie
				const frontendCategory = categoryMapping[transaction.category_name] || transaction.category_name
				const frontendSubcategory = subcategoryMapping[transaction.subcategory_name] || transaction.subcategory_name

				// Sprawdź czy to wydatek KWNR
				const isKwnrExpense = transaction.category_name === 'Wydatek KWNR'

				// Dla wydatków KWNR zwracamy dokładnie te same dane, które zostały zapisane
				if (isKwnrExpense) {
					// Dla wydatków KWNR, zachowaj datę w jej oryginalnym formacie
					// Najpierw sprawdź jaki format ma data w bazie danych
					console.log('Format daty w bazie:', typeof transaction.date, transaction.date)

					// Konwertujemy datę do formatu DD.MM.YYYY dla wydatków KWNR, ale uwzględniamy strefę czasową
					let displayDate = formattedDate
					try {
						// Pobierz datę z bazy danych i utwórz nowy obiekt daty bez wpływu strefy czasowej
						let dateObj
						if (transaction.date instanceof Date) {
							dateObj = new Date(transaction.date.getTime())
							// Dodaj offset, aby uniknąć wpływu strefy czasowej
							dateObj.setHours(12, 0, 0, 0)
						} else if (typeof transaction.date === 'string') {
							// Parsuj datę ze stringa, utrzymując oryginalny dzień
							if (transaction.date.includes('T')) {
								// Jeśli data zawiera T, jest to ISO format
								dateObj = new Date(transaction.date)
								dateObj.setHours(12, 0, 0, 0)
							} else if (transaction.date.includes('-')) {
								// Format YYYY-MM-DD
								const [year, month, day] = transaction.date.split('-')
								dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0))
							}
						}

						// Formatuj datę do DD.MM.YYYY
						if (dateObj) {
							const day = String(dateObj.getDate()).padStart(2, '0')
							const month = String(dateObj.getMonth() + 1).padStart(2, '0')
							const year = dateObj.getFullYear()
							displayDate = `${day}.${month}.${year}`
						} else if (formattedDate && formattedDate.includes('-')) {
							// Fallback dla formatów YYYY-MM-DD
							const [year, month, day] = formattedDate.split('-')
							if (year && month && day) {
								displayDate = `${day}.${month}.${year}`
							}
						}
					} catch (e) {
						console.error('Błąd podczas przetwarzania daty:', e, 'dla transakcji:', transaction)
					}

					console.log(`Przygotowano datę dla wydatku KWNR: ${displayDate}`)

					return {
						id: transaction.id,
						type: transaction.type,
						category: 'Wydatek KWNR',
						account: transaction.account_name,
						amount: parseFloat(transaction.amount),
						cost: parseFloat(transaction.amount),
						description: transaction.description, // Dokładnie to co wpisał użytkownik w polu "za co"
						extra_description: transaction.extra_description, // Dokładnie to co użytkownik wybrał w polu "kto"
						date: displayDate, // Użyj przetworzonej daty
					}
				}

				// Dla innych transakcji zwracamy standardowy format
				// Dodajemy nowe pola source_account_id i source_account_name, jeśli są dostępne
				const result = {
					id: transaction.id,
					type: transaction.type,
					category: frontendCategory,
					subcategory: frontendSubcategory,
					account: transaction.account_name,
					// Zachowujemy obie nazwy pól dla zgodności z różnymi częściami frontendu
					cost: parseFloat(transaction.amount),
					amount: parseFloat(transaction.amount),
					description: transaction.description || frontendSubcategory, // Używamy opisu lub nazwy podkategorii
					extraDescription: transaction.extra_description,
					extra_description: transaction.extra_description,
					date: formattedDate,
					balance_after: transaction.balance_after != null ? Number(transaction.balance_after) : undefined,
				}

				// Dodaj pola source_account tylko jeśli istnieją
				if (transaction.source_account_id !== undefined) {
					result.source_account_id = transaction.source_account_id
				}

				if (transaction.source_account_name !== undefined) {
					result.source_account_name = transaction.source_account_name
				}

				return result
			})

			console.log('Zwracam transakcje, liczba:', formattedTransactions.length)

			if (accountName) {
				// Jeśli to zapytanie o konto, zwróć również saldo konta
				const balanceResult = await client.query(
					`SELECT current_balance FROM account_balances 
                     JOIN accounts ON account_balances.account_id = accounts.id
                     WHERE accounts.name = $1`,
					[accountName]
				)

				const balance = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].current_balance) : 0

				// Dla każdej transakcji wydatku KWNR, dodajmy informacje potrzebne do wyświetlania
				formattedTransactions.forEach(transaction => {
					// Sprawdź czy to wydatek KWNR
					if (transaction.category === 'Wydatek KWNR') {
						// Dla wydatków KWNR używamy description i extra_description bezpośrednio z bazy
						console.log('Dla wydatku KWNR zwracam:', JSON.stringify(transaction, null, 2))
					}
				})

				res.status(200).json({
					transactions: formattedTransactions,
					balance: balance,
				})
			} else {
				// Standardowe zwrócenie transakcji dla miesiąca
				res.status(200).json(formattedTransactions)
			}
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd podczas pobierania transakcji:', error)
		res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message })
	}
}
module.exports = { getTransactions }
