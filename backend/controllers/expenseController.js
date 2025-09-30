// Usunięto nieużywany import Google Sheets
const path = require('path')
const pool = require('../db/pool')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

// Funkcja do aktualizacji statystyk
async function updateStatistics(client, monthId, categoryId, subcategoryId, amount) {
	try {
		console.log(
			`Aktualizuję statystyki: month_id=${monthId}, category_id=${categoryId}, subcategory_id=${subcategoryId}, amount=${amount}`
		)

		// Pobierz nazwy kategorii i podkategorii
		let categoryName = null
		let subcategoryName = null

		if (categoryId) {
			const categoryRes = await client.query('SELECT name FROM categories WHERE id = $1', [categoryId])
			if (categoryRes.rows.length > 0) {
				categoryName = categoryRes.rows[0].name
			}
		}

		if (subcategoryId) {
			const subcategoryRes = await client.query('SELECT name FROM subcategories WHERE id = $1', [subcategoryId])
			if (subcategoryRes.rows.length > 0) {
				subcategoryName = subcategoryRes.rows[0].name
			}
		}

		console.log(`Mapowanie: categoryName='${categoryName}', subcategoryName='${subcategoryName}'`)

		// Określ czy to główna kategoria czy podkategoria
		let statCategory, statSubcategory

		if (subcategoryName) {
			// To jest podkategoria - sprawdź czy to "zakupy codzienne"
			if (categoryName && categoryName.toLowerCase() === 'zakupy codzienne') {
				statCategory = 'ZC' // Używamy "ZC" dla podkategorii zakupów codziennych
				statSubcategory = subcategoryName
			} else {
				// Inne podkategorie - używamy nazwy głównej kategorii
				statCategory = categoryName
				statSubcategory = subcategoryName
			}
		} else {
			// To jest główna kategoria
			statCategory = categoryName
			statSubcategory = null
		}

		console.log(
			`Szukam/aktualizuję rekord: category='${statCategory}', subcategory='${statSubcategory}', month_id='${monthId}'`
		)

		// Sprawdź czy rekord już istnieje
		const existingRecord = await client.query(
			`
      SELECT id, amount FROM statistics 
      WHERE month_id = $1 AND category = $2 AND 
            (subcategory = $3 OR (subcategory IS NULL AND $3 IS NULL))
    `,
			[monthId, statCategory, statSubcategory]
		)

		if (existingRecord.rows.length > 0) {
			// Aktualizuj istniejący rekord
			const currentAmount = parseFloat(existingRecord.rows[0].amount)
			const newAmount = currentAmount + amount

			await client.query(
				`
        UPDATE statistics 
        SET amount = $1, last_edited = NOW() 
        WHERE id = $2
      `,
				[newAmount, existingRecord.rows[0].id]
			)

			console.log(`Zaktualizowano statystyki: ${currentAmount} + ${amount} = ${newAmount}`)
		} else {
			// Utwórz nowy rekord
			await client.query(
				`
        INSERT INTO statistics (month_id, category, subcategory, amount, last_edited, is_open)
        VALUES ($1, $2, $3, $4, NOW(), true)
      `,
				[monthId, statCategory, statSubcategory, amount]
			)

			console.log(`Utworzono nowy rekord statystyk z kwotą ${amount}`)
		}
	} catch (error) {
		console.error('Błąd podczas aktualizacji statystyk:', error)
		// Nie przerywamy transakcji - statystyki są pomocnicze
	}
}

// Funkcja do aktualizacji statystyk przy usuwaniu wydatku
async function updateStatisticsOnDelete(client, monthId, categoryId, subcategoryId, amount) {
	try {
		console.log(
			`Aktualizuję statystyki (usuwanie): month_id=${monthId}, category_id=${categoryId}, subcategory_id=${subcategoryId}, amount=${amount}`
		)

		// Pobierz nazwy kategorii i podkategorii (analogicznie jak przy dodawaniu)
		let categoryName = null
		let subcategoryName = null

		if (categoryId) {
			const categoryRes = await client.query('SELECT name FROM categories WHERE id = $1', [categoryId])
			if (categoryRes.rows.length > 0) {
				categoryName = categoryRes.rows[0].name
			}
		}

		if (subcategoryId) {
			const subcategoryRes = await client.query('SELECT name FROM subcategories WHERE id = $1', [subcategoryId])
			if (subcategoryRes.rows.length > 0) {
				subcategoryName = subcategoryRes.rows[0].name
			}
		}

		// Określ kategorie/podkategorie w statystykach (analogicznie jak przy dodawaniu)
		let statCategory, statSubcategory

		if (subcategoryName) {
			if (categoryName && categoryName.toLowerCase() === 'zakupy codzienne') {
				statCategory = 'ZC'
				statSubcategory = subcategoryName
			} else {
				statCategory = categoryName
				statSubcategory = subcategoryName
			}
		} else {
			statCategory = categoryName
			statSubcategory = null
		}

		console.log(`Odejmuję z statystyk: category='${statCategory}', subcategory='${statSubcategory}', amount=${amount}`)

		// Znajdź i zaktualizuj istniejący rekord
		const existingRecord = await client.query(
			`
      SELECT id, amount FROM statistics 
      WHERE month_id = $1 AND category = $2 AND 
            (subcategory = $3 OR (subcategory IS NULL AND $3 IS NULL))
    `,
			[monthId, statCategory, statSubcategory]
		)

		if (existingRecord.rows.length > 0) {
			const currentAmount = parseFloat(existingRecord.rows[0].amount)
			const newAmount = currentAmount - amount

			await client.query(
				`
        UPDATE statistics 
        SET amount = $1, last_edited = NOW() 
        WHERE id = $2
      `,
				[newAmount, existingRecord.rows[0].id]
			)

			console.log(`Zaktualizowano statystyki (usuwanie): ${currentAmount} - ${amount} = ${newAmount}`)
		} else {
			console.log(
				`UWAGA: Nie znaleziono rekordu statystyk do aktualizacji dla category='${statCategory}', subcategory='${statSubcategory}', month_id='${monthId}'`
			)
		}
	} catch (error) {
		console.error('Błąd podczas aktualizacji statystyk (usuwanie):', error)
		// Nie przerywamy transakcji
	}
}

const addTransaction = async (req, res) => {
	try {
		const transactions = Array.isArray(req.body) ? req.body : [req.body]
		if (transactions.length === 0) return res.status(400).json({ message: 'Brak transakcji.' })

		const client = await pool.connect()

		try {
			await client.query('BEGIN')

			// Sprawdź stan kont przed dodaniem transakcji
			for (const transaction of transactions) {
				const { flowType, data } = transaction

				if (flowType === 'expense') {
					// Sprawdź saldo konta dla wydatku
					const accountName = data.account
					const cost = parseFloat(data.cost || 0)

					if (accountName && cost > 0) {
						// Pobierz aktualne saldo konta
						const balanceRes = await client.query(
							`
              SELECT a.name, COALESCE(ab.current_balance, 0) AS current_balance
              FROM accounts a
              LEFT JOIN account_balances ab ON a.id = ab.account_id
              WHERE a.name = $1
            `,
							[accountName]
						)

						if (balanceRes.rows.length > 0) {
							const currentBalance = parseFloat(balanceRes.rows[0].current_balance)
							const projectedBalance = currentBalance - cost

							// Jeśli po transakcji saldo będzie ujemne, zwracamy błąd (ale tylko w API, frontend pokaże alert)
							if (projectedBalance < 0 && !req.body.confirmNegativeBalance) {
								if (req.headers['x-ignore-negative-balance'] !== 'true') {
									console.warn(
										`Ostrzeżenie: Wydatek spowodowałby ujemne saldo na koncie ${accountName} (${projectedBalance.toFixed(
											2
										)} zł)`
									)
								}
							}
						}
					}
				} else if (flowType === 'transfer') {
					// Sprawdź saldo konta dla transferu
					const fromAccount = data.fromAccount
					const amount = parseFloat(data.amount || 0)

					if (fromAccount && amount > 0) {
						// Pobierz aktualne saldo konta źródłowego
						const balanceRes = await client.query(
							`
              SELECT a.name, COALESCE(ab.current_balance, 0) AS current_balance
              FROM accounts a
              LEFT JOIN account_balances ab ON a.id = ab.account_id
              WHERE a.name = $1
            `,
							[fromAccount]
						)

						if (balanceRes.rows.length > 0) {
							const currentBalance = parseFloat(balanceRes.rows[0].current_balance)
							const projectedBalance = currentBalance - amount

							// Jeśli po transakcji saldo będzie ujemne, zwracamy błąd (ale tylko w API, frontend pokaże alert)
							if (projectedBalance < 0 && !req.body.confirmNegativeBalance) {
								if (req.headers['x-ignore-negative-balance'] !== 'true') {
									console.warn(
										`Ostrzeżenie: Transfer spowodowałby ujemne saldo na koncie ${fromAccount} (${projectedBalance.toFixed(
											2
										)} zł)`
									)
								}
							}
						}
					}
				}
			}

			for (const transaction of transactions) {
				const { flowType, data } = transaction
				const { date, extraDescription } = data

				// Formatowanie daty - upewnij się, że jest to obiekt Date
				let transactionDate
				if (date instanceof Date) {
					transactionDate = date
				} else if (typeof date === 'string') {
					// Jeśli to string w formacie ISO, usuń część z czasem
					if (date.includes('T')) {
						transactionDate = new Date(date.split('T')[0])
					} else {
						transactionDate = new Date(date)
					}
				} else {
					transactionDate = new Date()
				}

				const description = data.description || ''

				// Znajdź lub utwórz miesiąc
				const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(transactionDate)
				const monthYear = transactionDate.getFullYear()
				const monthNum = transactionDate.getMonth() + 1

				// Zapewnienie istnienia miesiąca z logiką zamknięcia (bez automatycznego tworzenia jeśli brak zgody)
				const monthKey = `${monthYear.toString().padStart(4, '0')}-${monthNum.toString().padStart(2, '0')}`
				let monthLookup = await client.query('SELECT * FROM months WHERE id = $1', [monthKey])
				if (!monthLookup.rows.length) {
					// Brak miesiąca – informacja dla klienta (rollback bieżącej transakcji wsadowej)
					await client.query('ROLLBACK')
					return res.status(202).json({
						needsConfirmation: true,
						action: 'create_month',
						month_id: monthKey,
						message: `Miesiąc ${monthKey} nie istnieje. Czy utworzyć?`,
					})
				}
				if (monthLookup.rows[0].is_closed) {
					await client.query('ROLLBACK')
					return res.status(202).json({
						needsConfirmation: true,
						action: 'reopen_month',
						month_id: monthKey,
						message: `Miesiąc ${monthKey} jest zamknięty. Czy otworzyć i dodać transakcję?`,
					})
				}
				const monthId = monthLookup.rows[0].id

				switch (flowType) {
					case 'expense': {
						const mainCategory = data.mainCategory
						const subCategory = data.subCategory || null
						const isKwnrTransfer = data.isKwnrTransfer === true
						const isKwnrExpense = data.isKwnrExpense === true

						// Mapowanie kategorii frontendu na kategorie bazy danych
						const categoryMapping = {
							'zakupy codzienne': 'zakupy codzienne',
							auta: 'auta',
							dom: 'dom',
							'wyjścia / jedzenie na mieście': 'wyjścia i szama do domu',
							pies: 'pies',
							prezenty: 'prezenty',
						}

						// Funkcja do konwersji nazwy kategorii z bazy danych na nazwę używaną w fronendzie
						const mapCategoryName = dbCategoryName => {
							// Jeśli istnieje mapowanie, użyj go
							if (categoryMapping[dbCategoryName]) {
								return categoryMapping[dbCategoryName]
							}
							// W przeciwnym razie użyj nazwy z bazy danych, ale z małej litery (frontend używa nazw z małej litery)
							return dbCategoryName.toLowerCase()
						}

						// Mapowanie nazw podkategorii na nazwy używane w fronendzie
						const subcategoryMapping = {
							jedzenie: 'jedzenie',
							słodycze: 'słodycze',
							alkohol: 'alkohol',
							chemia: 'chemia',
							higiena: 'higiena',
							apteka: 'apteka',
						}

						// Znajdź lub utwórz konto
						let accountRes = await client.query('SELECT id FROM accounts WHERE name = $1', [data.account])

						let accountId
						if (accountRes.rows.length === 0) {
							const newAccountRes = await client.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', [
								data.account,
							])
							accountId = newAccountRes.rows[0].id
						} else {
							accountId = accountRes.rows[0].id
						}

						// Zmapuj nazwę kategorii z frontendu na nazwę w bazie danych
						const dbCategoryName = categoryMapping[mainCategory] || mainCategory

						// Znajdź lub utwórz kategorię
						let categoryRes = await client.query('SELECT id FROM categories WHERE name = $1', [dbCategoryName])

						let categoryId
						if (categoryRes.rows.length === 0) {
							// Dodajemy nową kategorię z automatycznym is_main = true
							const newCategoryRes = await client.query(
								'INSERT INTO categories (name, is_main) VALUES ($1, $2) RETURNING id',
								[dbCategoryName, true]
							)
							categoryId = newCategoryRes.rows[0].id

							// Jeśli to jest nowa kategoria od użytkownika, zaktualizujmy konfigurację kategorii
							if (data.isNewCategory) {
								console.log(`Dodano nową kategorię z is_main=true: ${mainCategory}`)
								// Nowa kategoria została już dodana do bazy danych powyżej
							}
						} else {
							categoryId = categoryRes.rows[0].id
						}

						let subcategoryId = null
						if (subCategory) {
							// Zmapuj nazwę podkategorii z frontendu na nazwę w bazie danych
							const dbSubcategoryName = subcategoryMapping[subCategory] || subCategory

							// Znajdź lub utwórz podkategorię
							let subcategoryRes = await client.query(
								'SELECT id FROM subcategories WHERE name = $1 AND category_id = $2',
								[dbSubcategoryName, categoryId]
							)

							if (subcategoryRes.rows.length === 0) {
								const newSubcategoryRes = await client.query(
									'INSERT INTO subcategories (name, category_id) VALUES ($1, $2) RETURNING id',
									[dbSubcategoryName, categoryId]
								)
								subcategoryId = newSubcategoryRes.rows[0].id
							} else {
								subcategoryId = subcategoryRes.rows[0].id
							}
						}

						// Sprawdź, czy to jest specjalny wydatek KWNR
						console.log('Sprawdzam czy to wydatek KWNR:', data.isKwnrExpense)

						// Dla wydatków KWNR mamy osobną logikę przetwarzania, nie zapisujemy ich w tym miejscu
						// Będą przetworzone później w sekcji dotyczącej KWNR
						if (data.isKwnrExpense !== true) {
							console.log('To NIE jest wydatek KWNR, przetwarzam standardowo')

							// Zapisz transakcję w bazie
							const transactionResult = await client.query(
								`INSERT INTO transactions 
                 (month_id, account_id, category_id, subcategory_id, type, amount, description, extra_description, date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING id`,
								[
									monthId,
									accountId,
									categoryId,
									subcategoryId,
									'expense',
									parseFloat(data.cost),
									description,
									extraDescription || null,
									date,
								]
							)

							const transactionId = transactionResult.rows[0].id

							// Pobierz aktualne saldo konta
							const currentBalanceRes = await client.query(
								'SELECT current_balance FROM account_balances WHERE account_id = $1',
								[accountId]
							)

							let currentBalance = 0
							if (currentBalanceRes.rows.length > 0) {
								currentBalance = parseFloat(currentBalanceRes.rows[0].current_balance)
							}

							// Oblicz nowe saldo po wydatku
							const newBalance = currentBalance - parseFloat(data.cost)

							// Zaktualizuj pole balance_after w transakcji
							await client.query('UPDATE transactions SET balance_after = $1 WHERE id = $2', [
								newBalance,
								transactionId,
							])

							// **NOWA FUNKCJONALNOŚĆ: Aktualizuj statystyki**
							await updateStatistics(client, monthId, categoryId, subcategoryId, parseFloat(data.cost))
						} else {
							console.log('To JEST wydatek KWNR, będzie przetworzony w specjalnej sekcji')
						}

						// Specjalne przetwarzanie dla transferów i wydatków na KWNR
						if (data.isKwnrTransfer === true || data.isKwnrExpense === true) {
							console.log(data.isKwnrTransfer ? 'Wykryto transfer na KWNR' : 'Wykryto wydatek KWNR')

							// Znajdź konto KWNR
							let kwnrAccountRes = await client.query('SELECT id FROM accounts WHERE name = $1', ['KWNR'])

							let kwnrAccountId
							if (kwnrAccountRes.rows.length === 0) {
								const newAccountRes = await client.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', [
									'KWNR',
								])
								kwnrAccountId = newAccountRes.rows[0].id
							} else {
								kwnrAccountId = kwnrAccountRes.rows[0].id
							}

							// Jeśli to wydatek KWNR, odrębne przetwarzanie
							if (data.isKwnrExpense === true) {
								console.log(`Przetwarzanie wydatku KWNR w wysokości ${parseFloat(data.cost)}`)
								console.log('Dane wydatku KWNR:', JSON.stringify(data, null, 2))

								// Oblicz nowe saldo konta KWNR
								const kwnrCurrentBalanceRes = await client.query(
									'SELECT current_balance FROM account_balances WHERE account_id = $1',
									[kwnrAccountId]
								)

								let kwnrCurrentBalance = 0
								if (kwnrCurrentBalanceRes.rows.length > 0) {
									kwnrCurrentBalance = parseFloat(kwnrCurrentBalanceRes.rows[0].current_balance)
								}

								const newKwnrBalance = kwnrCurrentBalance - parseFloat(data.cost)

								// Pobieramy dane bezpośrednio z obiektu data
								const amount = parseFloat(data.cost)
								const expenseName = data.description // Nazwa wydatku - to co wpisał użytkownik w polu "za co"
								const person = data.person // Osoba - to co użytkownik wybrał w polu "kto"
								const expenseDate = data.date // Data - to co użytkownik wybrał w polu data

								console.log(
									`Zapisuję wydatek KWNR: "${expenseName}" dla osoby "${person}" na kwotę ${amount} z datą ${expenseDate}`
								)

								// Zachowujemy oryginalną datę z inputu, bez konwersji
								let displayDate = expenseDate

								// Rozwiązanie problemu przesunięcia czasowego - używamy oryginalnej daty z inputu
								console.log(`Oryginalna data z formularza: ${expenseDate}`)

								// Zapisujemy datę dokładnie jak w formularzu (DATE) bez czasu
								const dateToSave = expenseDate // YYYY-MM-DD
								console.log(`Przygotowana data (plain DATE) do zapisania w bazie: ${dateToSave}`)

								// Dodajemy wydatek bezpośrednio do konta KWNR
								const kwnrExpenseResult = await client.query(
									`INSERT INTO transactions 
                   (month_id, account_id, category_id, type, amount, description, extra_description, date, balance_after)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9)
                   RETURNING id`,
									[
										monthId,
										kwnrAccountId,
										categoryId,
										'expense',
										amount,
										expenseName,
										person, // Dokładnie wartości z formularza
										dateToSave,
										newKwnrBalance,
									]
								)

								console.log('Wydatek KWNR został zapisany z ID:', kwnrExpenseResult.rows[0].id)

								// Aktualizuj saldo konta KWNR
								const kwnrBalanceCheck = await client.query('SELECT id FROM account_balances WHERE account_id = $1', [
									kwnrAccountId,
								])

								if (kwnrBalanceCheck.rows.length === 0) {
									// Jeśli nie ma jeszcze wpisu dla salda KWNR, utwórz nowy (startując od ujemnej kwoty wydatku)
									await client.query(
										`
                    INSERT INTO account_balances (account_id, initial_balance, current_balance)
                    VALUES ($1, $2, $2)
                  `,
										[kwnrAccountId, -parseFloat(data.cost)]
									)
								} else {
									// Aktualizuj istniejące saldo - odejmujemy kwotę wydatku
									await client.query(
										`
                    UPDATE account_balances 
                    SET current_balance = current_balance - $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                  `,
										[parseFloat(data.cost), kwnrAccountId]
									)
								}

								// Dla wydatków KWNR nie aktualizujemy innych kont, więc kończymy tutaj przetwarzanie
								continue
							}

							// Oblicz nowe saldo po transferze
							const kwnrCurrentBalanceRes = await client.query(
								'SELECT current_balance FROM account_balances WHERE account_id = $1',
								[kwnrAccountId]
							)

							let kwnrCurrentBalance = 0
							if (kwnrCurrentBalanceRes.rows.length > 0) {
								kwnrCurrentBalance = parseFloat(kwnrCurrentBalanceRes.rows[0].current_balance)
							}

							const newKwnrBalance = kwnrCurrentBalance + parseFloat(data.cost)

							// Dodaj wpływ na konto KWNR bez duplikacji
							console.log(`Dodaję wpływ na konto KWNR w wysokości ${parseFloat(data.cost)}...`)
							console.log(`Data wybrana w formularzu: ${data.date}`)

							// Używamy dokładnie tej samej daty, która została wybrana w formularzu
							const selectedDate = data.date
							console.log(`Oryginalna data transferu: ${selectedDate}`)

							// Znajdź ID konta źródłowego
							const sourceAccountRes = await client.query('SELECT id, name FROM accounts WHERE name = $1', [
								data.account,
							])

							const sourceAccountId = sourceAccountRes.rows.length > 0 ? sourceAccountRes.rows[0].id : null
							const sourceAccountName = sourceAccountRes.rows.length > 0 ? sourceAccountRes.rows[0].name : data.account

							// Zapisujemy samą datę (bez czasu) aby uniknąć przesunięcia o 1 dzień
							const dateToSave = selectedDate // format YYYY-MM-DD z formularza
							console.log(`Przygotowana data transferu do zapisania (bez czasu): ${dateToSave}`)

							try {
								// Dodajemy dodatkowe pola: source_account_id i source_account_name
								await client.query(
									`INSERT INTO transactions 
                  (month_id, account_id, type, amount, description, extra_description, date, source_account_id, source_account_name)
                  VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9)`,
									[
										monthId,
										kwnrAccountId,
										'income',
										parseFloat(data.cost),
										`Wpływ z: ${data.account}`,
										`Transfer z konta ${data.account}`,
										dateToSave,
										sourceAccountId,
										sourceAccountName,
									]
								)
								console.log('Transfer do KWNR zapisany pomyślnie z informacją o źródle')
								const dbg = await client.query(
									'SELECT id, date FROM transactions WHERE account_id = $1 ORDER BY id DESC LIMIT 1',
									[kwnrAccountId]
								)
								console.log('[DBG STORED KWNR TRANSFER DATE]', dbg.rows[0])
							} catch (error) {
								// Jeśli wystąpił błąd, spróbuj zapisać bez nowych kolumn
								console.error('Błąd podczas zapisywania z source_account_id:', error)
								console.log('Próbuję zapisać bez nowych kolumn...')

								await client.query(
									`INSERT INTO transactions 
                  (month_id, account_id, type, amount, description, extra_description, date)
                  VALUES ($1, $2, $3, $4, $5, $6, $7::date)`,
									[
										monthId,
										kwnrAccountId,
										'income',
										parseFloat(data.cost),
										`Wpływ z: ${data.account}`,
										`Transfer z konta ${data.account}`,
										dateToSave,
									]
								)
								console.log('Transfer do KWNR zapisany bez informacji o źródle')
								const dbg2 = await client.query(
									'SELECT id, date FROM transactions WHERE account_id = $1 ORDER BY id DESC LIMIT 1',
									[kwnrAccountId]
								)
								console.log('[DBG STORED KWNR TRANSFER DATE - fallback]', dbg2.rows[0])
							}

							// Aktualizuj saldo konta KWNR
							const kwnrBalanceCheck = await client.query(
								'SELECT id, current_balance FROM account_balances WHERE account_id = $1',
								[kwnrAccountId]
							)

							if (kwnrBalanceCheck.rows.length === 0) {
								// Jeśli nie ma jeszcze wpisu dla salda KWNR, utwórz nowy
								await client.query(
									`
                  INSERT INTO account_balances (account_id, initial_balance, current_balance)
                  VALUES ($1, $2, $2)
                `,
									[kwnrAccountId, parseFloat(data.cost)]
								)
							} else {
								// Aktualizuj istniejące saldo
								await client.query(
									`
                  UPDATE account_balances 
                  SET current_balance = current_balance + $1,
                      last_updated = NOW()
                  WHERE account_id = $2
                `,
									[parseFloat(data.cost), kwnrAccountId]
								)
							}
						}

						// Sprawdź czy istnieje wpis w account_balances dla tego konta
						const balanceCheck = await client.query('SELECT id FROM account_balances WHERE account_id = $1', [
							accountId,
						])

						if (balanceCheck.rows.length === 0) {
							// Jeśli nie istnieje, utwórz nowy wpis z początkowym saldem 0
							await client.query(
								`
                INSERT INTO account_balances (account_id, initial_balance, current_balance)
                VALUES ($1, 0, 0)
              `,
								[accountId]
							)
						}

						// Aktualizuj saldo konta dla WSZYSTKICH kont, w tym Gabi i Norf
						// Dla wszystkich kont wydatek zmniejsza saldo
						await client.query(
							`
              UPDATE account_balances 
              SET current_balance = current_balance - $1,
                  last_updated = NOW()
              WHERE account_id = $2
            `,
							[parseFloat(data.cost), accountId]
						)

						console.log(`Zaktualizowano saldo konta ${data.account}, odjęto kwotę ${parseFloat(data.cost)}`)

						// Specjalna logika dla wydatków z konta Gabi lub Norf
						// Dodaj adnotację o sposobie obsługi wydatku
						const balanceOption = data.balanceOption || 'budget_increase'
						let noteText = ''

						if (balanceOption === 'budget_increase') {
							noteText = `Wydatek z konta ${data.account} zwiększył budżet tego miesiąca`
						} else if (balanceOption === 'balance_expense') {
							noteText = `Wydatek został zbilansowany transferem na konto ${data.account}`
						}

						// Aktualizuj extraDescription z informacją o opcji bilansowania
						if (noteText) {
							const currentExtraDesc = extraDescription || ''
							const updatedExtraDesc = currentExtraDesc + (currentExtraDesc ? '\n' : '') + noteText

							await client.query(
								`
                    UPDATE transactions 
                    SET extra_description = $1
                    WHERE id = (SELECT currval('transactions_id_seq'))
                `,
								[updatedExtraDesc]
							)

							console.log(`Dodano adnotację do transakcji: ${noteText}`)
						}

						// Automatycznie generujemy wpływ na konto Wspólne
						if (data.account === 'Gabi' || data.account === 'Norf') {
							// Znajdź konto Wspólne
							let commonAccountRes = await client.query('SELECT id FROM accounts WHERE name = $1', ['Wspólne'])

							let commonAccountId
							if (commonAccountRes.rows.length === 0) {
								const newAccountRes = await client.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', [
									'Wspólne',
								])
								commonAccountId = newAccountRes.rows[0].id
							} else {
								commonAccountId = commonAccountRes.rows[0].id
							}

							const expenseAmount = parseFloat(data.cost)
							// Upraszczamy opis automatycznego wpływu do samej nazwy konta (Gabi/Norf)
							// Poprzednio: "Zwrot od: {konto} - {opis}" – utrudniało to klasyfikację dodatkowych wpływów
							const wpływOpis = `${data.account}`

							// Zapisz transakcję wpływu z informacją o wybranej opcji bilansowania
							const extraDesc = `Automatycznie wygenerowane z wydatku z konta ${data.account} (opcja: ${balanceOption})`

							await client.query(
								`INSERT INTO transactions 
                 (month_id, account_id, type, amount, description, extra_description, date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
								[monthId, commonAccountId, 'income', expenseAmount, wpływOpis, extraDesc, date]
							)

							// Sprawdź czy istnieje wpis w account_balances dla konta Wspólne
							const balanceCheck = await client.query('SELECT id FROM account_balances WHERE account_id = $1', [
								commonAccountId,
							])

							if (balanceCheck.rows.length === 0) {
								// Jeśli nie istnieje, utwórz nowy wpis z początkowym saldem 0
								await client.query(
									`
                  INSERT INTO account_balances (account_id, initial_balance, current_balance)
                  VALUES ($1, 0, 0)
                `,
									[commonAccountId]
								)
							}

							// Nie aktualizujemy salda konta Wspólnego dla opcji "Zwiększamy budżet"
							// Wpływ jest rejestrowany tylko w celach raportowania, ale nie zmienia faktycznego stanu konta
							console.log(`Opcja "Zwiększamy budżet" - pominięto aktualizację salda konta Wspólne`)
						}

						break
					}

					case 'income': {
						// Przekierowanie wpływów początkowych (Gabi/Norf) na konto Wspólne
						const isInitialIncome = data.from === 'Wpływ początkowy'
						let targetAccountName = data.toAccount
						let extraDescToUse = extraDescription || null
						if (isInitialIncome && (data.toAccount === 'Gabi' || data.toAccount === 'Norf')) {
							targetAccountName = 'Wspólne'
							if (!extraDescToUse) extraDescToUse = `Wpływ początkowy od: ${data.toAccount}`
						}

						// Znajdź lub utwórz konto docelowe
						let accountRes = await client.query('SELECT id FROM accounts WHERE name = $1', [targetAccountName])

						let accountId
						if (accountRes.rows.length === 0) {
							const newAccountRes = await client.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', [
								targetAccountName,
							])
							accountId = newAccountRes.rows[0].id
						} else {
							accountId = accountRes.rows[0].id
						}

						// Zapisz transakcję wpływu
						const incomeAmount = parseFloat(data.amount)
						await client.query(
							`INSERT INTO transactions 
               (month_id, account_id, type, amount, description, extra_description, date)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
							[monthId, accountId, 'income', incomeAmount, data.from || description, extraDescToUse, date]
						)

						// Sprawdź czy istnieje wpis w account_balances dla tego konta
						const balanceCheck = await client.query('SELECT id FROM account_balances WHERE account_id = $1', [
							accountId,
						])

						if (balanceCheck.rows.length === 0) {
							// Jeśli nie istnieje, utwórz nowy wpis z początkowym saldem 0
							await client.query(
								`
                INSERT INTO account_balances (account_id, initial_balance, current_balance)
                VALUES ($1, 0, 0)
              `,
								[accountId]
							)
						}

						// Aktualizuj saldo konta - dodaj kwotę wpływu
						await client.query(
							`
              UPDATE account_balances 
              SET current_balance = current_balance + $1,
                  last_updated = NOW()
              WHERE account_id = $2
            `,
							[incomeAmount, accountId]
						)

						break
					}

					case 'transfer': {
						console.log(`Przetwarzanie transferu: ${JSON.stringify(data)}`)

						// Sprawdź czy wszystkie wymagane pola są dostępne
						if (!data.fromAccount || !data.toAccount || !data.amount) {
							console.error('Brakujące dane dla transferu:', {
								fromAccount: data.fromAccount,
								toAccount: data.toAccount,
								amount: data.amount,
							})
							throw new Error('Brakujące dane dla transferu: konto źródłowe, konto docelowe lub kwota')
						}

						// Sprawdź, czy konta źródłowe i docelowe są różne
						if (data.fromAccount === data.toAccount) {
							console.error('Konto źródłowe i docelowe są takie same:', data.fromAccount)
							throw new Error('Konto źródłowe i docelowe muszą być różne')
						}

						// Znajdź lub utwórz konto źródłowe
						console.log(`Szukam konta źródłowego: ${data.fromAccount}`)
						let fromAccountRes = await client.query('SELECT id FROM accounts WHERE name = $1', [data.fromAccount])

						let fromAccountId
						if (fromAccountRes.rows.length === 0) {
							console.log(`Tworzę nowe konto źródłowe: ${data.fromAccount}`)
							const newFromAccountRes = await client.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', [
								data.fromAccount,
							])
							fromAccountId = newFromAccountRes.rows[0].id
						} else {
							fromAccountId = fromAccountRes.rows[0].id
						}

						// Znajdź lub utwórz konto docelowe
						console.log(`Szukam konta docelowego: ${data.toAccount}`)
						let toAccountRes = await client.query('SELECT id FROM accounts WHERE name = $1', [data.toAccount])

						let toAccountId
						if (toAccountRes.rows.length === 0) {
							console.log(`Tworzę nowe konto docelowe: ${data.toAccount}`)
							const newToAccountRes = await client.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', [
								data.toAccount,
							])
							toAccountId = newToAccountRes.rows[0].id
						} else {
							toAccountId = toAccountRes.rows[0].id
						}

						// Parsuj kwotę i upewnij się, że jest liczbą
						let amount
						try {
							amount = parseFloat(data.amount)
							if (isNaN(amount) || amount <= 0) {
								throw new Error('Nieprawidłowa kwota')
							}
						} catch (err) {
							console.error('Błąd przy parsowaniu kwoty:', data.amount, err)
							throw new Error(`Nieprawidłowa kwota transferu: ${data.amount}`)
						}

						console.log(
							`Transfer: z ${data.fromAccount} (ID: ${fromAccountId}) do ${data.toAccount} (ID: ${toAccountId}), kwota: ${amount}`
						)

						try {
							// Zapisz transakcję transferu jako wydatek z konta źródłowego
							console.log(`Zapisuję transakcję transferu z konta źródłowego...`)
							const sourceTransferResult = await client.query(
								`INSERT INTO transactions 
                 (month_id, account_id, type, amount, description, extra_description, date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
								[
									monthId,
									fromAccountId,
									'transfer',
									amount,
									`Transfer do: ${data.toAccount}`,
									extraDescription || null,
									date,
								]
							)
							const sourceTransferId = sourceTransferResult.rows[0].id
							console.log(`Zapisano transakcję transferu z konta źródłowego, ID: ${sourceTransferId}`)

							// Sprawdź czy istnieje wpis w account_balances dla konta źródłowego
							console.log(`Sprawdzam saldo konta źródłowego...`)
							const fromBalanceCheck = await client.query(
								'SELECT id, current_balance FROM account_balances WHERE account_id = $1',
								[fromAccountId]
							)

							if (fromBalanceCheck.rows.length === 0) {
								// Jeśli nie istnieje, utwórz nowy wpis z początkowym saldem 0
								console.log(`Tworzę nowy wpis salda dla konta źródłowego...`)
								await client.query(
									`
                  INSERT INTO account_balances (account_id, initial_balance, current_balance)
                  VALUES ($1, 0, 0)
                `,
									[fromAccountId]
								)
							} else {
								console.log(`Aktualne saldo konta źródłowego: ${fromBalanceCheck.rows[0].current_balance}`)
							}

							// Zmniejsz saldo konta źródłowego
							console.log(`Aktualizuję saldo konta źródłowego...`)
							await client.query(
								`
                UPDATE account_balances 
                SET current_balance = current_balance - $1,
                    last_updated = NOW()
                WHERE account_id = $2
              `,
								[amount, fromAccountId]
							)

							// Zapisz wpływ na konto docelowe
							console.log(`Zapisuję transakcję wpływu na konto docelowe...`)
							const targetTransferResult = await client.query(
								`INSERT INTO transactions 
                 (month_id, account_id, type, amount, description, extra_description, date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
								[
									monthId,
									toAccountId,
									'transfer',
									amount,
									`Transfer z: ${data.fromAccount}`,
									extraDescription || null,
									date,
								]
							)
							const targetTransferId = targetTransferResult.rows[0].id
							console.log(`Zapisano transakcję wpływu na konto docelowe, ID: ${targetTransferId}`)

							console.log(`Powiązane ID transakcji: źródłowa=${sourceTransferId}, docelowa=${targetTransferId}`)
						} catch (err) {
							console.error('Błąd podczas zapisywania transakcji transferu:', err)
							throw err
						}

						try {
							// Sprawdź czy istnieje wpis w account_balances dla konta docelowego
							console.log(`Sprawdzam saldo konta docelowego...`)
							const toBalanceCheck = await client.query(
								'SELECT id, current_balance FROM account_balances WHERE account_id = $1',
								[toAccountId]
							)

							if (toBalanceCheck.rows.length === 0) {
								// Jeśli nie istnieje, utwórz nowy wpis z początkowym saldem 0
								console.log(`Tworzę nowy wpis salda dla konta docelowego...`)
								await client.query(
									`
                  INSERT INTO account_balances (account_id, initial_balance, current_balance)
                  VALUES ($1, 0, 0)
                `,
									[toAccountId]
								)
							} else {
								console.log(`Aktualne saldo konta docelowego: ${toBalanceCheck.rows[0].current_balance}`)
							}

							// Zwiększ saldo konta docelowego
							console.log(`Aktualizuję saldo konta docelowego...`)
							await client.query(
								`
                UPDATE account_balances 
                SET current_balance = current_balance + $1,
                    last_updated = NOW()
                WHERE account_id = $2
              `,
								[amount, toAccountId]
							)

							console.log(`Transfer został pomyślnie zrealizowany.`)
						} catch (err) {
							console.error('Błąd podczas aktualizacji salda konta docelowego:', err)
							throw err
						}

						break
					}
				}
			}

			await client.query('COMMIT')
			res.status(200).json({ success: true, message: 'Transakcje zapisane pomyślnie' })
		} catch (error) {
			await client.query('ROLLBACK')
			throw error
		} finally {
			client.release()
		}
	} catch (error) {
		console.error(`Błąd krytyczny w addTransaction:`, error)
		console.error(`Stack trace:`, error.stack)
		console.error(`Data wejściowa:`, JSON.stringify(req.body, null, 2))
		res
			.status(500)
			.json({ message: 'Krytyczny błąd serwera. Sprawdź logi na serwerze.', error: error.message, stack: error.stack })
	}
}

const deleteTransaction = async (req, res) => {
	try {
		console.log('=== deleteTransaction - body:', JSON.stringify(req.body))
		console.log('=== deleteTransaction - metoda HTTP:', req.method)
		console.log('=== deleteTransaction - headers:', JSON.stringify(req.headers))

		const { id } = req.body

		console.log(`=== Rozpoczynam proces usuwania transakcji o ID: ${id} ===`)

		if (!id) {
			console.log('Błąd: Brak ID transakcji do usunięcia')
			return res.status(400).json({ message: 'Brak ID transakcji do usunięcia.' })
		}

		const client = await pool.connect()

		try {
			await client.query('BEGIN')
			console.log(`Rozpoczęto transakcję SQL`)

			// Najpierw pobierz informacje o transakcji wraz z nazwą konta i datą
			const transactionResult = await client.query(
				`SELECT t.id, t.type, t.amount, t.account_id, t.description, t.date, t.month_id, a.name as account_name 
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE t.id = $1`,
				[id]
			)

			console.log(`Wynik zapytania o transakcję: ${transactionResult.rows.length} wierszy`)

			if (transactionResult.rows.length === 0) {
				await client.query('ROLLBACK')
				console.log(`Błąd: Nie znaleziono transakcji o ID: ${id}`)
				return res.status(404).json({ message: 'Nie znaleziono transakcji o podanym ID.' })
			}

			const transaction = transactionResult.rows[0]
			// Sprawdzenie czy miesiąc jest zamknięty
			if (transaction.month_id) {
				const monthCheck = await client.query('SELECT id, is_closed FROM months WHERE id = $1', [transaction.month_id])
				if (monthCheck.rows.length && monthCheck.rows[0].is_closed) {
					await client.query('ROLLBACK')
					return res
						.status(202)
						.json({
							needsConfirmation: true,
							action: 'reopen_month',
							month_id: transaction.month_id,
							message: `Miesiąc ${transaction.month_id} jest zamknięty. Czy otworzyć aby usunąć transakcję?`,
						})
				}
			}
			const amount = parseFloat(transaction.amount)
			const accountId = transaction.account_id
			const accountName = transaction.account_name

			// Zaktualizuj saldo konta w zależności od typu transakcji
			if (transaction.type === 'expense') {
				console.log(`Usuwanie wydatku o ID ${id} z konta ${accountName}, kwota: ${amount}`)

				// Sprawdzamy, czy to wydatek z konta Gabi lub Norf
				if (accountName === 'Gabi' || accountName === 'Norf') {
					// Znajdź automatycznie wygenerowany wpływ związany z wydatkiem
					// Dodajemy bardziej dokładne wyszukiwanie i lepsze logowanie dla debugowania
					console.log(
						`Szukam automatycznego wpływu związanego z wydatkiem z konta ${accountName} z dnia ${transaction.date}`
					)

					const autoIncomeResult = await client.query(
						`
            SELECT t.id, t.amount, t.account_id, t.description, a.name as target_account_name
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE t.type = 'income' 
            AND t.description = $1
            AND t.extra_description LIKE $2
            AND DATE(t.date) = DATE($3)
            ORDER BY t.id DESC
            LIMIT 1
          `,
						[accountName, `%Automatycznie wygenerowane%${accountName}%`, transaction.date]
					)

					console.log(`Znaleziono ${autoIncomeResult.rows.length} pasujących automatycznych wpływów`)

					if (autoIncomeResult.rows.length > 0) {
						const autoIncome = autoIncomeResult.rows[0]
						const targetAccountId = autoIncome.account_id
						const targetAccountName = autoIncome.target_account_name

						console.log(`Znaleziono automatyczny wpływ o ID: ${autoIncome.id} na konto ${targetAccountName}`)

						// Nie odejmujemy kwoty automatycznego wpływu z salda konta docelowego,
						// ponieważ dla opcji "Zwiększamy budżet" saldo konta nie jest aktualizowane
						console.log(
							`Usuwanie automatycznego wpływu dla opcji "Zwiększamy budżet" - saldo konta ${targetAccountName} pozostaje bez zmian`
						)

						// Usuwamy automatycznie wygenerowaną transakcję wpływu
						await client.query('DELETE FROM transactions WHERE id = $1', [autoIncome.id])
						console.log(`Usunięto wpływ o ID: ${autoIncome.id}`)
					} else {
						console.log(`UWAGA: Nie znaleziono automatycznego wpływu dla wydatku z konta ${accountName}`)
					}

					// Dla specjalnych kont również przywracamy saldo, ponieważ wydatek nadal zmniejszał ich saldo
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[amount, accountId]
					)

					console.log(`Przywrócono saldo na koncie ${accountName}, dodano kwotę ${amount}`)

					// DODATKOWO: jeśli ten wydatek był "Transfer na KWNR" (isKwnrTransfer przypadek), usuń odpowiadający income "Wpływ z: {accountName}" z konta KWNR
					// Rozpoznaj po opisie lub kategorii
					if (transaction.description === 'Transfer na KWNR') {
						console.log(
							'Wykryto usuwanie wydatku typu Transfer na KWNR – próbuję znaleźć i usunąć powiązany wpływ na KWNR.'
						)
						const kwnrIncomeRes = await client.query(
							`
              SELECT t.id, t.amount FROM transactions t
              JOIN accounts a ON t.account_id = a.id
              WHERE t.type = 'income'
                AND a.name = 'KWNR'
                AND t.description = $1
                AND DATE(t.date) = DATE($2)
              ORDER BY t.id DESC
              LIMIT 1
            `,
							[`Wpływ z: ${accountName}`, transaction.date]
						)
						console.log('Znaleziono potencjalnych wpływów na KWNR:', kwnrIncomeRes.rows.length)
						if (kwnrIncomeRes.rows.length > 0) {
							const kIncome = kwnrIncomeRes.rows[0]
							console.log('Usuwam powiązany wpływ na KWNR ID:', kIncome.id, 'kwota:', kIncome.amount)
							await client.query('DELETE FROM transactions WHERE id = $1', [kIncome.id])
							// Korekta salda KWNR (odejmujemy wpływ, który wcześniej zwiększał saldo)
							await client.query(
								`
                UPDATE account_balances ab
                SET current_balance = current_balance - $1, last_updated = NOW()
                FROM accounts a
                WHERE a.id = ab.account_id AND a.name = 'KWNR'
              `,
								[kIncome.amount]
							)
							console.log('Skorygowano saldo KWNR po usunięciu powiązanego wpływu.')
						} else {
							console.log('Nie znaleziono powiązanego wpływu na KWNR do usunięcia.')
						}
					}
				} else {
					// Standardowe konto - przywracamy środki
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[amount, accountId]
					)

					console.log(`Przywrócono saldo na standardowym koncie ${accountName}, dodano kwotę ${amount}`)

					// Sprawdź czy to jest wydatek KWNR (specjalna kategoria)
					const categoryResult = await client.query(
						`SELECT c.name FROM categories c 
                         JOIN transactions t ON t.category_id = c.id 
                         WHERE t.id = $1`,
						[id]
					)

					if (categoryResult.rows.length > 0 && categoryResult.rows[0].name === 'Wydatek KWNR') {
						console.log(`Wykryto wydatek KWNR - usuwanie z konta ${accountName}`)
					}
				}
			} else if (transaction.type === 'income') {
				// Jeśli usuwamy wpływ, odejmujemy środki z konta
				await client.query(
					`
                    UPDATE account_balances 
                    SET current_balance = current_balance - $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                `,
					[amount, accountId]
				)
			} else if (transaction.type === 'transfer') {
				// Jeśli usuwamy transfer, trzeba znaleźć powiązaną transakcję transferu i oba konta
				console.log(`Usuwanie transferu ID: ${id} z konta ${accountName}, kwota: ${amount}, data: ${transaction.date}`)

				// Znajdź powiązaną transakcję transferu - wersja bardziej elastyczna
				// Szukamy drugiej transakcji transferu z tą samą datą, która nie jest tą, którą usuwamy
				const relatedTransferResult = await client.query(
					`SELECT t.id, t.account_id, t.description, t.amount, a.name as target_account_name
                         FROM transactions t
                         JOIN accounts a ON t.account_id = a.id
                         WHERE t.type = 'transfer' 
                           AND DATE(t.date) = DATE($1) 
                           AND t.id != $2
                           AND (
                               t.description LIKE $3 
                               OR t.description LIKE $4
                           )
                           AND ABS(t.amount - $5) < 0.01
                         ORDER BY t.id DESC
                         LIMIT 1
                        `,
					[transaction.date, id, `Transfer z: ${accountName}%`, `Transfer do: %`, amount]
				)

				console.log(`Znaleziono ${relatedTransferResult.rows.length} powiązanych transakcji transferu`)

				if (relatedTransferResult.rows.length > 0) {
					const targetAccountId = relatedTransferResult.rows[0].account_id
					const relatedTransferId = relatedTransferResult.rows[0].id
					const targetAccountName = relatedTransferResult.rows[0].target_account_name

					console.log(
						`Znaleziono powiązaną transakcję transferu o ID: ${relatedTransferId} na konto ${targetAccountName}, kwota: ${relatedTransferResult.rows[0].amount}`
					)

					// Usuń najpierw powiązaną transakcję transferu
					console.log(`Próbuję usunąć powiązaną transakcję transferu o ID: ${relatedTransferId}`)

					const deleteRelatedResult = await client.query('DELETE FROM transactions WHERE id = $1', [relatedTransferId])

					if (deleteRelatedResult.rowCount === 1) {
						console.log(`Pomyślnie usunięto powiązaną transakcję transferu o ID: ${relatedTransferId}`)
					} else {
						console.log(
							`UWAGA: Nie można usunąć powiązanej transakcji transferu o ID: ${relatedTransferId}. Liczba usuniętych wierszy: ${deleteRelatedResult.rowCount}`
						)
					}

					// Zwróć środki na konto źródłowe
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[amount, accountId]
					)

					console.log(`Przywrócono saldo na koncie źródłowym ${accountName}, dodano kwotę ${amount}`)

					// Odejmij środki z konta docelowego
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance - $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[amount, targetAccountId]
					)

					console.log(`Zaktualizowano saldo konta docelowego ${targetAccountName}, odjęto kwotę ${amount}`)
				} else {
					console.log(`UWAGA: Nie znaleziono powiązanej transakcji transferu!`)
					// Przywracamy saldo konta źródłowego, ponieważ transfer zmniejszał jego saldo
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[amount, accountId]
					)

					console.log(`Przywrócono saldo na koncie źródłowym ${accountName}, dodano kwotę ${amount}`)
				}
			}

			// **NOWA FUNKCJONALNOŚĆ: Aktualizuj statystyki przy usuwaniu wydatku**
			if (transaction.type === 'expense') {
				console.log(`Aktualizuję statystyki przed usunięciem wydatku ID: ${id}`)
				await updateStatisticsOnDelete(
					client,
					transaction.month_id,
					transaction.category_id,
					transaction.subcategory_id,
					amount
				)
			}

			// Usuń transakcję główną na końcu
			console.log(`Próbuję usunąć główną transakcję o ID: ${id}`)

			const deleteResult = await client.query('DELETE FROM transactions WHERE id = $1', [id])

			if (deleteResult.rowCount === 1) {
				console.log(`Pomyślnie usunięto transakcję o ID: ${id}. Liczba usuniętych wierszy: ${deleteResult.rowCount}`)
			} else {
				console.log(
					`UWAGA: Nie można usunąć transakcji o ID: ${id}. Liczba usuniętych wierszy: ${deleteResult.rowCount}`
				)
				// Jeśli nie usunięto żadnej transakcji, to wykonaj rollback
				await client.query('ROLLBACK')
				return res.status(404).json({ message: 'Nie udało się usunąć transakcji. Sprawdź logi serwera.' })
			}

			// Zatwierdź wszystkie zmiany
			await client.query('COMMIT')
			console.log(`=== Pomyślnie zakończono usuwanie transakcji o ID: ${id} ===`)

			// Zwróć sukces
			return res.status(200).json({ message: 'Transakcja została pomyślnie usunięta.' })
		} catch (error) {
			await client.query('ROLLBACK')
			console.error('=== BŁĄD podczas usuwania transakcji ===')
			console.error('Treść błędu:', error)
			console.error('Szczegóły zapytania:', { id: id })

			if (error.constraint) {
				console.error('Naruszenie ograniczenia bazy danych:', error.constraint)
				return res.status(500).json({
					message: 'Błąd integralności bazy danych podczas usuwania transakcji.',
					error: error.message,
					constraint: error.constraint,
				})
			}

			res.status(500).json({
				message: 'Błąd serwera podczas usuwania transakcji.',
				error: error.message,
			})
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('=== BŁĄD KRYTYCZNY w deleteTransaction ===')
		console.error('Treść błędu:', error)
		console.error('Stack trace:', error.stack)
		console.error('Data wejściowa:', JSON.stringify(req.body, null, 2))

		res.status(500).json({
			message: 'Błąd krytyczny serwera podczas usuwania transakcji. Sprawdź logi na serwerze.',
			error: error.message,
			stack: error.stack,
		})
	}
}

const updateTransaction = async (req, res) => {
	try {
		const { original, updated } = req.body
		if (!original || !updated || !original.id) {
			return res.status(400).json({ message: 'Brak danych do aktualizacji.' })
		}

		const client = await pool.connect()

		try {
			await client.query('BEGIN')

			// Pobierz aktualną transakcję z bazy wraz z nazwą konta
			const transactionResult = await client.query(
				`SELECT t.id, t.type, t.amount, t.account_id, t.description, t.date, t.month_id, t.category_id, t.subcategory_id, a.name as account_name 
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE t.id = $1`,
				[original.id]
			)

			if (transactionResult.rows.length === 0) {
				await client.query('ROLLBACK')
				return res.status(404).json({ message: 'Nie znaleziono transakcji o podanym ID.' })
			}

			const transaction = transactionResult.rows[0]
			// Blokada aktualizacji w zamkniętym miesiącu
			if (transaction.month_id) {
				const monthCheck = await client.query('SELECT id, is_closed FROM months WHERE id = $1', [transaction.month_id])
				if (monthCheck.rows.length && monthCheck.rows[0].is_closed) {
					await client.query('ROLLBACK')
					return res
						.status(202)
						.json({
							needsConfirmation: true,
							action: 'reopen_month',
							month_id: transaction.month_id,
							message: `Miesiąc ${transaction.month_id} jest zamknięty. Czy otworzyć aby zaktualizować transakcję?`,
						})
				}
			}
			const originalAmount = parseFloat(transaction.amount)
			const originalAccountId = transaction.account_id
			const originalAccountName = transaction.account_name
			const transactionType = transaction.type

			// Znajdź ID konta z aktualizowanych danych
			let updatedAccountId = originalAccountId
			let updatedAmount = updated.cost || updated.amount || originalAmount
			let updatedAccountName = originalAccountName

			// Jeśli zmieniono konto, znajdź nowe ID konta
			if (updated.account && updated.account !== original.account) {
				const accountResult = await client.query('SELECT id, name FROM accounts WHERE name = $1', [updated.account])

				if (accountResult.rows.length > 0) {
					updatedAccountId = accountResult.rows[0].id
					updatedAccountName = accountResult.rows[0].name
				} else {
					// Jeśli konto nie istnieje, utwórz je
					const newAccountResult = await client.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id, name', [
						updated.account,
					])
					updatedAccountId = newAccountResult.rows[0].id
					updatedAccountName = newAccountResult.rows[0].name
				}
			}

			// Aktualizacja stanów kont w zależności od typu transakcji
			if (transactionType === 'expense') {
				// Przywróć poprzednią kwotę wydatku na oryginalne konto - ZAWSZE
				// Dla WSZYSTKICH kont, w tym Gabi i Norf, wydatek zmniejsza saldo, więc musimy je przywrócić
				await client.query(
					`
                    UPDATE account_balances 
                    SET current_balance = current_balance + $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                `,
					[originalAmount, originalAccountId]
				)

				console.log(`Przywrócono saldo konta ${originalAccountName}, dodano kwotę ${originalAmount}`)

				// Odejmij nową kwotę wydatku z nowego konta - ZAWSZE
				// Dla WSZYSTKICH kont, w tym Gabi i Norf, wydatek zmniejsza saldo
				await client.query(
					`
                    UPDATE account_balances 
                    SET current_balance = current_balance - $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                `,
					[updatedAmount, updatedAccountId]
				)

				console.log(`Zaktualizowano saldo konta ${updatedAccountName}, odjęto kwotę ${updatedAmount}`)

				// **NOWA FUNKCJONALNOŚĆ: Aktualizuj statystyki przy edycji wydatku**
				if (transaction.category_id || transaction.subcategory_id) {
					console.log(
						`Aktualizuję statystyki dla edycji wydatku: stara kwota=${originalAmount}, nowa kwota=${updatedAmount}`
					)

					// Odejmij starą kwotę ze statystyk
					await updateStatisticsOnDelete(
						client,
						transaction.month_id,
						transaction.category_id,
						transaction.subcategory_id,
						originalAmount
					)

					// Dodaj nową kwotę do statystyk
					await updateStatistics(
						client,
						transaction.month_id,
						transaction.category_id,
						transaction.subcategory_id,
						updatedAmount
					)
				}

				// Obsługa specjalnej logiki dla kont Gabi/Norf

				// 1. Jeśli oryginalne konto było Gabi/Norf - znajdź i usuń automatyczny wpływ
				if (originalAccountName === 'Gabi' || originalAccountName === 'Norf') {
					// Znajdź powiązany automatyczny wpływ
					const autoIncomeResult = await client.query(
						`
            SELECT t.id, t.amount, t.account_id
            FROM transactions t
            WHERE t.type = 'income' 
            AND t.description = $1
            AND t.extra_description LIKE $2
            AND DATE(t.date) = DATE($3)
          `,
						[originalAccountName, `%Automatycznie wygenerowane%${originalAccountName}%`, transaction.date]
					)

					if (autoIncomeResult.rows.length > 0) {
						const autoIncome = autoIncomeResult.rows[0]
						const commonAccountId = autoIncome.account_id

						// Dla opcji "Zwiększamy budżet" nie cofamy aktualizacji salda konta Wspólnego,
						// ponieważ saldo nie zostało zaktualizowane przy dodawaniu transakcji
						console.log(
							`Usuwanie automatycznego wpływu dla opcji "Zwiększamy budżet" - saldo konta Wspólne pozostaje bez zmian`
						)

						// Usuwamy automatycznie wygenerowaną transakcję wpływu
						await client.query('DELETE FROM transactions WHERE id = $1', [autoIncome.id])
						console.log(`Usunięto automatyczny wpływ o ID: ${autoIncome.id}`)
					}
				}

				// 2. Jeśli nowe konto jest Gabi/Norf - utwórz nowy automatyczny wpływ
				if (updatedAccountName === 'Gabi' || updatedAccountName === 'Norf') {
					// Znajdź konto Wspólne
					const commonAccountRes = await client.query('SELECT id FROM accounts WHERE name = $1', ['Wspólne'])

					let commonAccountId
					if (commonAccountRes.rows.length === 0) {
						const newAccountRes = await client.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', [
							'Wspólne',
						])
						commonAccountId = newAccountRes.rows[0].id
					} else {
						commonAccountId = commonAccountRes.rows[0].id
					}

					const expenseAmount = updatedAmount
					// Nowy uproszczony opis automatycznego wpływu
					const wpływOpis = `${updatedAccountName}`

					// Zapisz nową transakcję wpływu
					await client.query(
						`INSERT INTO transactions 
                        (month_id, account_id, type, amount, description, extra_description, date)
                        VALUES (
                            (SELECT month_id FROM transactions WHERE id = $1),
                            $2, $3, $4, $5, $6, $7
                        )`,
						[
							original.id,
							commonAccountId,
							'income',
							expenseAmount,
							wpływOpis,
							`Automatycznie wygenerowane z wydatku z konta ${updatedAccountName}`,
							updated.date || transaction.date,
						]
					)

					// Dla opcji "Zwiększamy budżet" nie aktualizujemy salda konta Wspólnego
					// Transakcja wpływu jest rejestrowana tylko w celach raportowania
					console.log(`Opcja "Zwiększamy budżet" - pominięto aktualizację salda konta Wspólne`)
				}
			} else if (transactionType === 'income') {
				// Odejmij poprzednią kwotę wpływu z oryginalnego konta
				await client.query(
					`
                    UPDATE account_balances 
                    SET current_balance = current_balance - $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                `,
					[originalAmount, originalAccountId]
				)

				// Dodaj nową kwotę wpływu do nowego konta
				await client.query(
					`
                    UPDATE account_balances 
                    SET current_balance = current_balance + $1,
                        last_updated = NOW()
                    WHERE account_id = $2
                `,
					[updatedAmount, updatedAccountId]
				)
			} else if (transactionType === 'transfer') {
				console.log(`Aktualizacja transferu ID: ${original.id}`)

				// Znajdź powiązaną transakcję transferu
				const relatedTransferResult = await client.query(
					`
                    SELECT t.id, t.account_id, a.name as target_account_name
                    FROM transactions t
                    JOIN accounts a ON t.account_id = a.id
                    WHERE t.type = 'transfer' AND 
                          t.description LIKE $1 AND
                          t.date = $2
                `,
					[`Transfer z: ${originalAccountName}%`, transaction.date]
				)

				if (relatedTransferResult.rows.length > 0) {
					const targetTransferId = relatedTransferResult.rows[0].id
					const targetAccountId = relatedTransferResult.rows[0].account_id
					const targetAccountName = relatedTransferResult.rows[0].target_account_name

					console.log(`Znaleziono powiązaną transakcję transferu ID: ${targetTransferId} na konto ${targetAccountName}`)

					// 1. Przywróć stan konta źródłowego (dodaj kwotę transferu)
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[originalAmount, originalAccountId]
					)

					console.log(`Przywrócono saldo na koncie ${originalAccountName}, dodano kwotę ${originalAmount}`)

					// 2. Przywróć stan konta docelowego (odejmij kwotę transferu)
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance - $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[originalAmount, targetAccountId]
					)

					console.log(`Zaktualizowano saldo konta ${targetAccountName}, odjęto kwotę ${originalAmount}`)

					// 3. Zaktualizuj również powiązaną transakcję transferu
					await client.query(
						`
                        UPDATE transactions 
                        SET account_id = $1, 
                            amount = $2, 
                            description = $3,
                            extra_description = $4,
                            date = $5
                        WHERE id = $6
                    `,
						[
							updatedAccountId !== originalAccountId ? targetAccountId : updatedAccountId,
							updatedAmount,
							`Transfer z: ${updatedAccountName}`,
							updated.extraDescription || original.extraDescription,
							updated.date || original.date,
							targetTransferId,
						]
					)

					console.log(`Zaktualizowano powiązaną transakcję transferu ID: ${targetTransferId}`)

					// 4. Zastosuj nowe kwoty na kontach
					// Zmniejsz saldo nowego konta źródłowego
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance - $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[updatedAmount, updatedAccountId]
					)

					console.log(`Zaktualizowano saldo konta ${updatedAccountName}, odjęto kwotę ${updatedAmount}`)

					// Zwiększ saldo nowego konta docelowego
					let updatedTargetAccountId = targetAccountId
					if (updated.toAccount && updated.toAccount !== original.toAccount) {
						// Jeśli zmieniono konto docelowe, znajdź nowe ID
						const targetAccountResult = await client.query('SELECT id, name FROM accounts WHERE name = $1', [
							updated.toAccount,
						])

						if (targetAccountResult.rows.length > 0) {
							updatedTargetAccountId = targetAccountResult.rows[0].id

							// Zaktualizuj ID konta w transakcji transfer_in
							await client.query(
								`
                                UPDATE transactions 
                                SET account_id = $1
                                WHERE id = $2
                            `,
								[updatedTargetAccountId, targetTransferId]
							)
						}
					}

					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[updatedAmount, updatedTargetAccountId]
					)

					console.log(`Zaktualizowano saldo konta docelowego, dodano kwotę ${updatedAmount}`)
				} else {
					console.log(`UWAGA: Nie znaleziono powiązanej transakcji transferu!`)
					// Przywracamy saldo konta źródłowego, ponieważ transfer zmniejszał jego saldo
					await client.query(
						`
                        UPDATE account_balances 
                        SET current_balance = current_balance + $1,
                            last_updated = NOW()
                        WHERE account_id = $2
                    `,
						[amount, accountId]
					)

					console.log(`Przywrócono saldo na koncie źródłowym ${accountName}, dodano kwotę ${amount}`)
				}
			}

			// Przygotuj wartości do aktualizacji transakcji
			const updatedDescription = updated.description || original.description
			const updatedExtraDescription =
				updated.extra_description || updated.extraDescription || original.extra_description || original.extraDescription

			console.log('Aktualizacja transakcji, dane:')
			console.log('- ID: ', original.id)
			console.log('- Konto ID: ', updatedAccountId)
			console.log('- Kwota: ', updatedAmount)
			console.log('- Opis: ', updatedDescription)
			console.log('- Extra opis (kto): ', updatedExtraDescription)
			console.log('- Data: ', updated.date || original.date)
			console.log('Oryginalne pola:')
			console.log('- original.extra_description: ', original.extra_description)
			console.log('- original.extraDescription: ', original.extraDescription)
			console.log('Zaktualizowane pola:')
			console.log('- updated.extra_description: ', updated.extra_description)
			console.log('- updated.extraDescription: ', updated.extraDescription)

			// Aktualizuj transakcję w bazie danych
			await client.query(
				`
                UPDATE transactions 
                SET account_id = $1, 
                    amount = $2, 
                    description = $3,
                    extra_description = $4,
                    date = $5
                WHERE id = $6
            `,
				[
					updatedAccountId,
					updatedAmount,
					updatedDescription,
					updatedExtraDescription,
					updated.date || original.date,
					original.id,
				]
			)

			await client.query('COMMIT')
			res.status(200).json({ message: 'Transakcja została pomyślnie zaktualizowana.' })
		} catch (error) {
			await client.query('ROLLBACK')
			console.error('Błąd podczas aktualizacji transakcji:', error)
			res.status(500).json({ message: 'Błąd serwera podczas aktualizacji.', error: error.message })
		} finally {
			client.release()
		}
	} catch (error) {
		console.error('Błąd krytyczny w updateTransaction:', error)
		console.error(`Stack trace:`, error.stack)
		console.error(`Data wejściowa:`, JSON.stringify(req.body, null, 2))
		res
			.status(500)
			.json({
				message: 'Błąd serwera podczas aktualizacji. Sprawdź logi na serwerze.',
				error: error.message,
				stack: error.stack,
			})
	}
}

// Funkcja do usuwania transferu (oba rekordy - wychodzący i przychodzący)
const deleteTransfer = async (req, res) => {
	const client = await pool.connect()

	try {
		const { id, date, fromAccount, toAccount, amount } = req.body

		if (!fromAccount || !toAccount || !amount) {
			return res.status(400).json({ message: 'Brakujące dane: konto źródłowe, konto docelowe lub kwota' })
		}

		await client.query('BEGIN')

		// Znajdź konto źródłowe
		let fromAccountRes = await client.query('SELECT id FROM accounts WHERE name = $1', [fromAccount])
		if (fromAccountRes.rows.length === 0) {
			await client.query('ROLLBACK')
			return res.status(404).json({ message: `Nie znaleziono konta źródłowego: ${fromAccount}` })
		}
		const fromAccountId = fromAccountRes.rows[0].id

		// Znajdź konto docelowe
		let toAccountRes = await client.query('SELECT id FROM accounts WHERE name = $1', [toAccount])
		if (toAccountRes.rows.length === 0) {
			await client.query('ROLLBACK')
			return res.status(404).json({ message: `Nie znaleziono konta docelowego: ${toAccount}` })
		}
		const toAccountId = toAccountRes.rows[0].id

		// Znajdź miesiąc dla tej daty
		const transactionDate = new Date(date)
		const monthYear = transactionDate.getFullYear()
		const monthNum = transactionDate.getMonth() + 1

		let monthRes = await client.query('SELECT id, is_closed FROM months WHERE year = $1 AND month = $2', [
			monthYear,
			monthNum,
		])

		if (monthRes.rows.length === 0) {
			await client.query('ROLLBACK')
			return res.status(404).json({ message: 'Nie znaleziono miesiąca dla podanej daty.' })
		}

		const monthId = monthRes.rows[0].id
		if (monthRes.rows[0].is_closed) {
			await client.query('ROLLBACK')
			return res
				.status(202)
				.json({
					needsConfirmation: true,
					action: 'reopen_month',
					month_id: monthId,
					message: `Miesiąc ${monthId} jest zamknięty. Czy otworzyć aby usunąć transfer?`,
				})
		}

		// Usuń rekord transferu wychodzącego
		await client.query(
			`
            DELETE FROM transactions 
            WHERE month_id = $1 AND account_id = $2 AND type = 'transfer' AND amount = $3
        `,
			[monthId, fromAccountId, amount]
		)

		// Usuń rekord transferu przychodzącego
		await client.query(
			`
            DELETE FROM transactions 
            WHERE month_id = $1 AND account_id = $2 AND type = 'transfer' AND amount = $3
        `,
			[monthId, toAccountId, amount]
		)

		// Aktualizuj saldo konta źródłowego - dodaj kwotę (cofamy odjęcie)
		await client.query(
			`
            UPDATE account_balances
            SET current_balance = current_balance + $1,
                last_updated = NOW()
            WHERE account_id = $2
        `,
			[parseFloat(amount), fromAccountId]
		)

		// Aktualizuj saldo konta docelowego - odejmij kwotę (cofamy dodanie)
		await client.query(
			`
            UPDATE account_balances
            SET current_balance = current_balance - $1,
                last_updated = NOW()
            WHERE account_id = $2
        `,
			[parseFloat(amount), toAccountId]
		)

		await client.query('COMMIT')

		res.status(200).json({ message: 'Transfer został pomyślnie usunięty.' })
	} catch (error) {
		await client.query('ROLLBACK')
		console.error('Błąd podczas usuwania transferu:', error)
		res.status(500).json({ message: 'Błąd serwera podczas usuwania transferu.', error: error.message })
	} finally {
		client.release()
	}
}

module.exports = { addTransaction, deleteTransaction, updateTransaction, deleteTransfer }
