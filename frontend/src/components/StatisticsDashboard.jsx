import React, { useState, useEffect } from 'react'
import CollapsibleSection from './CollapsibleSection'
import CategoryDetailsModal from './CategoryDetailsModal'
import Modal from './Modal'
import EditTransactionModal from './EditTransactionModal'
import AccountBalances from './AccountBalances'
import './StatisticsDashboard.css'

function StatisticsDashboard({ transactions, monthBudget, selectedMonthId }) {
	const [modalInfo, setModalInfo] = useState({ isOpen: false, category: '', transactions: [] })
	const [incomeModal, setIncomeModal] = useState({ isOpen: false, transaction: null })
	const [editIncomeModal, setEditIncomeModal] = useState({ isOpen: false, transaction: null })
	const [transferModal, setTransferModal] = useState({ isOpen: false, transaction: null })
	const [editTransferModal, setEditTransferModal] = useState({ isOpen: false, transaction: null })
	const [accountBalances, setAccountBalances] = useState([])
	const [currentMonth, setCurrentMonth] = useState(null)
	const [categoryAverages, setCategoryAverages] = useState({})
	const [averageExpenses, setAverageExpenses] = useState(null)
	// SC (saldo całkowite) z KWNR – synchronizowane przez sessionStorage + event z KwnrAccountView
	const [kwnrSC, setKwnrSC] = useState(() => {
		try {
			const cache = JSON.parse(sessionStorage.getItem('kwnrDerived') || '{}')
			const v = Number(cache.SC)
			return isNaN(v) ? null : v
		} catch {
			return null
		}
	})
	// Ostatni wydatek (trwały w localStorage)
	const [lastExpense, setLastExpense] = useState(() => {
		try {
			const raw = localStorage.getItem('lastExpense')
			return raw ? JSON.parse(raw) : null
		} catch {
			return null
		}
	})
	// Założony budżet = suma wpływów początkowych w wybranym miesiącu (z transakcji)
	// Filtrujemy incomes z opisem "Wpływ początkowy" (niezależnie od konta)
	const budgetValue = Array.isArray(transactions)
		? transactions
				.filter(
					t =>
						t &&
						t.type === 'income' &&
						((t.description && String(t.description).toLowerCase().startsWith('wpływ początkowy')) ||
							(t.extra_description && String(t.extra_description).toLowerCase().startsWith('wpływ początkowy')))
				)
				.reduce((sum, t) => sum + Number(t.amount || t.cost || 0), 0)
		: 0

	// Pobierz stany kont z API oraz dane o bieżącym miesiącu
	useEffect(() => {
		const fetchData = async () => {
			try {
				// Pobierz stany kont
				const balancesResponse = await fetch('http://localhost:3002/api/accounts/balances')
				if (!balancesResponse.ok) {
					throw new Error(`HTTP error ${balancesResponse.status}`)
				}
				const balancesData = await balancesResponse.json()
				setAccountBalances(balancesData)

				// Pobierz dane o bieżącym miesiącu
				const monthResponse = await fetch('http://localhost:3002/api/months/current')
				if (monthResponse.ok) {
					const monthData = await monthResponse.json()
					setCurrentMonth(monthData)
				} else if (monthResponse.status === 404) {
					// Brak bieżącego miesiąca – to OK, nie wymuszamy tworzenia
					setCurrentMonth(null)
				} else {
					throw new Error(`HTTP error ${monthResponse.status}`)
				}

				// Pobierz średnie kategorii dla bieżącego miesiąca
				if (selectedMonthId) {
					try {
						const averagesResponse = await fetch(
							`http://localhost:3002/api/statistics/shopping/averages?month_id=${selectedMonthId}`
						)
						if (averagesResponse.ok) {
							const averagesData = await averagesResponse.json()
							setCategoryAverages(averagesData.averages || {})
						} else {
							console.warn('Nie udało się pobrać średnich kategorii')
							setCategoryAverages({})
						}
					} catch (avgErr) {
						console.warn('Błąd pobierania średnich:', avgErr)
						setCategoryAverages({})
					}
				}

				// Pobierz średnią wydatków z zamkniętych miesięcy
				try {
					const avgExpensesResponse = await fetch('http://localhost:3002/api/statistics/average-expenses')
					if (avgExpensesResponse.ok) {
						const avgExpensesData = await avgExpensesResponse.json()
						setAverageExpenses(avgExpensesData)
					} else {
						console.warn('Nie udało się pobrać średniej wydatków')
						setAverageExpenses(null)
					}
				} catch (avgExpErr) {
					console.warn('Błąd pobierania średniej wydatków:', avgExpErr)
					setAverageExpenses(null)
				}

				// budżet wyświetlany pochodzi teraz z transakcji (suma wpływów początkowych)
			} catch (err) {
				console.error('Błąd pobierania danych:', err)
			}
		}

		fetchData()
		// Nasłuchuj zmian SC z panelu KWNR
		const onKwnrSc = () => {
			try {
				const cache = JSON.parse(sessionStorage.getItem('kwnrDerived') || '{}')
				const v = Number(cache.SC)
				setKwnrSC(isNaN(v) ? null : v)
			} catch {
				/* ignore */
			}
		}
		window.addEventListener('kwnr-sc-changed', onKwnrSc)
		// Nasłuchuj zmian ostatniego wydatku
		const onLastExpense = e => {
			try {
				if (e && e.detail) setLastExpense(e.detail)
				else {
					const raw = localStorage.getItem('lastExpense')
					setLastExpense(raw ? JSON.parse(raw) : null)
				}
			} catch {
				/* ignore */
			}
		}
		window.addEventListener('last-expense-updated', onLastExpense)
		window.addEventListener('storage', onLastExpense)
		return () => {
			window.removeEventListener('kwnr-sc-changed', onKwnrSc)
			window.removeEventListener('last-expense-updated', onLastExpense)
			window.removeEventListener('storage', onLastExpense)
		}
	}, [selectedMonthId])

	// Pomocnicza: czy wydatek jest z panelu KWNR (ma nie wpływać na Bilans miesiąca/budżet)
	const isKwnrExpenseTx = t =>
		t.type === 'expense' &&
		(t.isKwnrExpense ||
			t.category === 'Wydatek KWNR' ||
			t.mainCategory === 'Wydatek KWNR' ||
			t.account === 'KWNR' ||
			t.description === 'KWNR')

	const totalExpensesForBudget = transactions.reduce((acc, t) => {
		if (t.type === 'expense') {
			// WYKLUCZ wydatki z panelu KWNR
			if (isKwnrExpenseTx(t)) return acc
			return acc + Number(t.cost || 0)
		}
		if (
			t.type === 'transfer' &&
			((t.description && t.description.includes('Transfer do: Rachunki')) || t.toAccount === 'Rachunki')
		)
			return acc + Number(t.cost || t.amount || 0)
		return acc
	}, 0)
	// Surowy % wykorzystania budżetu (może przekraczać 100)
	const budgetUsedPctRaw = budgetValue ? (totalExpensesForBudget / budgetValue) * 100 : 0
	// % do szerokości paska (maks. 100)
	const budgetBarPct = Math.min(100, Math.max(0, budgetUsedPctRaw))
	// Kolor paska wg progów: <75% zielony, 75-100% żółty, >=100% czerwony
	// Funkcja do obliczania koloru paska na podstawie procentu
	const getBarColor = percentage => {
		if (percentage < 90) return '#4caf50' // Zielony < 90%
		if (percentage < 100) return '#ffeb3b' // Żółty 90%-100%
		if (percentage < 110) return '#ff9800' // Pomarańczowy 100%-110%
		if (percentage < 120) return '#f44336' // Czerwony 110%-120%
		return '#d32f2f' // Ciemny czerwony > 120%
	}

	const budgetBarColor = getBarColor(budgetUsedPctRaw)

	// Funkcja pomocnicza do formatowania waluty
	function formatCurrency(value) {
		if (typeof value !== 'number') value = Number(value)
		if (isNaN(value)) return '-'
		return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 })
	}

	// Funkcja pomocnicza do formatowania daty
	function formatDate(dateString) {
		if (!dateString) return '-'

		// Sprawdź czy data jest w formacie ISO (z T i Z)
		if (dateString.includes('T')) {
			const date = new Date(dateString)
			return date.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })
		}

		// Jeśli data jest już w formacie YYYY-MM-DD, zwróć ją w formacie DD.MM.YYYY
		const [year, month, day] = dateString.split('-')
		if (year && month && day) {
			return `${day}.${month}.${year}`
		}

		return dateString
	}

	// Nowa logika: wpływy początkowe to pierwsze dwa wpływy z datą 1 danego miesiąca
	function getInitialAndExtraIncomes(transactions) {
		// Wyklucz wpływy generowane z opcji bilansowania oraz wpływy na konto KWNR będące efektem transferu na KWNR
		const realIncomes = transactions.filter(t => {
			const isKwnrTransferIncome =
				t.type === 'income' &&
				(t.account === 'KWNR' || t.toAccount === 'KWNR') &&
				t.description &&
				t.description.startsWith('Wpływ z: ')
			return t.type === 'income' && !isBalanceExpenseIncome(t) && !isKwnrTransferIncome
		})

		// Zakładamy, że data jest w formacie YYYY-MM-DD
		// Grupujemy po miesiącu
		const byMonth = {}
		realIncomes.forEach(t => {
			const [year, month, day] = (t.date || '').split('-')
			if (!year || !month || !day) return
			const monthKey = `${year}-${month}`
			if (!byMonth[monthKey]) byMonth[monthKey] = []
			byMonth[monthKey].push(t)
		})

		let initial = [],
			extra = []
		Object.values(byMonth).forEach(incomes => {
			// Filtrujemy tylko te z datą 1
			const firstDay = incomes.filter(t => t.date && t.date.endsWith('-01'))
			// Sortujemy po id lub amount, żeby mieć deterministycznie pierwsze dwa
			const sorted = [...firstDay].sort((a, b) => (a.id || 0) - (b.id || 0))
			initial = initial.concat(sorted.slice(0, 2))
			// Pozostałe z datą 1 i wszystkie inne to extra
			const initialIds = new Set(sorted.slice(0, 2).map(t => t.id))
			const regularExtra = incomes.filter(t => !initialIds.has(t.id))

			extra = extra.concat(regularExtra)
		})
		return { initial, extra }
	}

	const { initial: initialIncomes, extra: extraIncomes } = getInitialAndExtraIncomes(transactions)

	// Nowa funkcja do rozpoznania czy dany wpływ jest początkowy
	function isInitialIncome(t) {
		return initialIncomes.some(i => i.id === t.id)
	}

	// Funkcja pomocnicza do sprawdzenia czy dany wpływ był wygenerowany z opcją "bilansujemy wydatek"
	function isBalanceExpenseIncome(transaction) {
		return (
			transaction.type === 'income' &&
			transaction.extraDescription &&
			transaction.extraDescription.includes('opcja: balance_expense')
		)
	}

	// Grupujemy transfery po dacie i kwocie, aby wyeliminować duplikaty
	// Dla każdej pary data-kwota zostawiamy tylko jeden transfer
	const seenTransfers = new Map()
	const filteredTransfers = []

	// Najpierw zbieramy wszystkie transfery
	transactions
		.filter(t => t.type === 'transfer')
		.forEach(t => {
			const fromAccount = t.account || 'Nieznane'
			let toAccount = 'Nieznane'

			// Wyciągnij nazwę konta docelowego z opisu
			if (t.description && t.description.includes('Transfer do: ')) {
				toAccount = t.description.replace('Transfer do: ', '')

				// Tworzymy unikalny klucz dla tego transferu (data + kwota + konta)
				const transferKey = `${t.date}_${t.cost || t.amount}_${fromAccount}_${toAccount}`

				// Jeśli jeszcze nie widzieliśmy tego transferu, dodajemy go do listy
				if (!seenTransfers.has(transferKey)) {
					seenTransfers.set(transferKey, true)
					filteredTransfers.push({ ...t, fromAccount, toAccount })
				}
			}
		})

	// Suma transferów - tylko z przefiltrowanych transferów, aby uniknąć podwójnego liczenia
	const totalTransfersAmount = filteredTransfers.reduce((acc, t) => acc + Number(t.cost || t.amount || 0), 0)

	// Proste statystyki
	const isKwnrTransferIncome = t =>
		t.type === 'income' &&
		(t.account === 'KWNR' || t.toAccount === 'KWNR') &&
		t.description &&
		t.description.startsWith('Wpływ z: ')

	const isGenericTransferExpense = t =>
		t.type === 'expense' &&
		((t.description && t.description.trim().toLowerCase() === 'transfer') ||
			(t.category && t.category.trim().toLowerCase() === 'transfer') ||
			(t.mainCategory && t.mainCategory.trim().toLowerCase() === 'transfer'))

	// Wykluczamy z sumy tylko ogólną kategorię "Transfer"; "Transfer na KWNR" będzie liczony jako wydatek (ale ukryty w kategoriach)

	const stats = {
		// Ogólny bilans, uwzględniający transfery na konto "Rachunki" jako wydatki
		overallBalance: transactions.reduce((acc, t) => {
			if (t.type === 'income' && !isBalanceExpenseIncome(t) && !isKwnrTransferIncome(t)) {
				return acc + Number(t.cost || t.amount || 0)
			}
			if (t.type === 'expense') {
				return acc - Number(t.cost || 0)
			}
			// Transfery na konto "Rachunki" traktujemy jak wydatki
			if (
				t.type === 'transfer' &&
				((t.description && t.description.includes('Transfer do: Rachunki')) || t.toAccount === 'Rachunki')
			) {
				return acc - Number(t.cost || t.amount || 0)
			}
			return acc
		}, 0),
		accountBalances: transactions.reduce(
			(acc, t) => {
				const accName = t.toAccount || t.account || 'Wspólne'
				if (!acc[accName]) acc[accName] = 0
				if (t.type === 'income' && !isBalanceExpenseIncome(t)) acc[accName] += Number(t.cost || t.amount || 0)
				if (t.type === 'expense') acc[accName] -= Number(t.cost || 0)
				return acc
			},
			{ Wspólne: 0, Gotówka: 0, Oszczędnościowe: 0, Rachunki: 0 }
		),
		// Obliczanie sumy wszystkich kont – KWNR pokazujemy jako SC (SG+SN+DS)
		totalAccountsBalance: accountBalances.reduce((sum, account) => {
			const isKwnr = account.name === 'KWNR'
			const val =
				isKwnr && kwnrSC !== null && isFinite(kwnrSC) ? Number(kwnrSC) : parseFloat(account.current_balance || 0)
			return sum + (isNaN(val) ? 0 : val)
		}, 0),
		// Bilans miesiąca - różnica między wpływami a wydatkami w danym miesiącu
		// Uwzględniamy transfery na konto "Rachunki" jako wydatki
		monthlyBalance: transactions.reduce((acc, t) => {
			if (t.type === 'income' && !isBalanceExpenseIncome(t) && !isKwnrTransferIncome(t)) {
				return acc + Number(t.cost || t.amount || 0)
			}
			if (t.type === 'expense') {
				// WYKLUCZ wydatki z panelu KWNR
				if (isKwnrExpenseTx(t)) return acc
				return acc - Number(t.cost || 0)
			}
			// Transfery na konto "Rachunki" traktujemy jak wydatki
			if (
				t.type === 'transfer' &&
				((t.description && t.description.includes('Transfer do: Rachunki')) || t.toAccount === 'Rachunki')
			) {
				return acc - Number(t.cost || t.amount || 0)
			}
			return acc
		}, 0),
		// Założony bilans miesiąca - różnica między budżetem (suma wpływów początkowych) a wydatkami (uwzględniając transfery na Rachunki)
		monthlyBudgetBalance:
			budgetValue -
			transactions.reduce((acc, t) => {
				if (t.type === 'expense') {
					// WYKLUCZ wydatki z panelu KWNR
					if (isKwnrExpenseTx(t)) return acc
					return acc + Number(t.cost || 0)
				}
				// Transfery na konto "Rachunki" traktujemy jak wydatki
				if (
					t.type === 'transfer' &&
					((t.description && t.description.includes('Transfer do: Rachunki')) || t.toAccount === 'Rachunki')
				) {
					return acc + Number(t.cost || t.amount || 0)
				}
				return acc
			}, 0),
		// Suma wpływów z wyłączeniem tych generowanych opcją "bilansujemy wydatek"
		totalIncome: transactions
			.filter(t => t.type === 'income' && !isBalanceExpenseIncome(t) && !isKwnrTransferIncome(t))
			.reduce((acc, t) => acc + Number(t.cost || t.amount || 0), 0),
		// W sumie wydatków uwzględniamy także transfery na konto "Rachunki"
		totalExpenses: transactions.reduce((acc, t) => {
			if (t.type === 'expense') {
				// wykluczamy wydatki KWNR
				if (
					t.isKwnrExpense ||
					t.category === 'Wydatek KWNR' ||
					t.mainCategory === 'Wydatek KWNR' ||
					t.account === 'KWNR'
				)
					return acc
				if (t.description === 'KWNR') return acc // bezpieczeństwo
				// wykluczamy tylko ogólną kategorię "Transfer"; "Transfer na KWNR" liczymy
				if (isGenericTransferExpense(t)) return acc
				return acc + Number(t.cost || 0)
			}
			// Transfery na konto "Rachunki" traktujemy jak wydatki
			if (
				t.type === 'transfer' &&
				((t.description && t.description.includes('Transfer do: Rachunki')) || t.toAccount === 'Rachunki')
			) {
				return acc + Number(t.cost || t.amount || 0)
			}
			return acc
		}, 0),
		// Transfery i ich suma
		transfers: filteredTransfers,
		totalTransfers: totalTransfersAmount,
		// Wydatki według kategorii, uwzględniające transfery na konto "Rachunki" ale wykluczające wydatki KWNR
		expenseByCategory: transactions.reduce((acc, t) => {
			const desc = (t.description || '').trim()
			const cat = (t.category || '').trim()
			const mainCat = (t.mainCategory || '').trim()
			const isGenericTransfer = isGenericTransferExpense(t)
			if (isGenericTransfer) return acc // wykluczamy tylko ogólną kategorię "Transfer"; "Transfer na KWNR" ma być widoczny

			// Standardowe wydatki, ale wykluczamy wydatki KWNR
			if (
				t.type === 'expense' &&
				!t.isKwnrExpense &&
				cat !== 'Wydatek KWNR' &&
				mainCat !== 'Wydatek KWNR' &&
				!(desc === 'KWNR' || (t.account && t.account === 'KWNR')) &&
				!isGenericTransfer
			) {
				let category = cat || 'Inne'
				if (!acc[category]) acc[category] = 0
				acc[category] += Number(t.cost || 0)
			}

			// Transfery na konto "Rachunki" traktujemy jak wydatki w kategorii "Transfer na Rachunki"
			if (
				t.type === 'transfer' &&
				((t.description && t.description.includes('Transfer do: Rachunki')) || t.toAccount === 'Rachunki')
			) {
				const category = 'Transfer na Rachunki'
				if (!acc[category]) acc[category] = 0
				acc[category] += Number(t.cost || t.amount || 0)
			}

			return acc
		}, {}),
	}

	// Brak specjalnej listy dla "Transfer na KWNR" – traktowany jak normalna kategoria

	// Funkcje do edycji i usuwania wpływów oraz wyliczania salda po operacji

	const handleSaveEditIncome = async updatedData => {
		try {
			const response = await fetch('http://localhost:3002/api/expenses', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ original: editIncomeModal.transaction, updated: updatedData }),
			})
			let result
			try {
				result = await response.json()
			} catch {
				result = {}
			}
			if (response.status === 202 && result?.needsConfirmation && result.action === 'reopen_month' && result.month_id) {
				const confirmReopen = window.confirm(
					result.message || `Miesiąc ${result.month_id} jest zamknięty. Otworzyć aby zaktualizować wpływ?`
				)
				if (confirmReopen) {
					const reopenResp = await fetch(`http://localhost:3002/api/months/${result.month_id}/reopen`, {
						method: 'POST',
					})
					if (reopenResp.ok) return await handleSaveEditIncome(updatedData)
					alert('Nie udało się otworzyć miesiąca')
				}
				return
			}
			if (response.ok) {
				alert('Wpływ zaktualizowany!')
				setEditIncomeModal({ isOpen: false, transaction: null })
				window.location.reload() // lub odśwież dane w inny sposób
			} else {
				throw new Error(result.message || 'Błąd aktualizacji')
			}
		} catch (error) {
			alert(`Wystąpił błąd: ${error.message}`)
		}
	}

	const handleEditIncome = transaction => {
		setEditIncomeModal({ isOpen: true, transaction })
	}

	const handleDeleteIncome = async transaction => {
		if (!window.confirm('Czy na pewno chcesz usunąć ten wpływ?')) return
		try {
			const response = await fetch('http://localhost:3002/api/expenses', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ date: transaction.date, id: transaction.id, rowId: transaction.rowId }),
			})
			let result
			try {
				result = await response.json()
			} catch {
				result = {}
			}
			if (response.status === 202 && result?.needsConfirmation && result.action === 'reopen_month' && result.month_id) {
				const confirmReopen = window.confirm(
					result.message || `Miesiąc ${result.month_id} jest zamknięty. Otworzyć aby usunąć wpływ?`
				)
				if (confirmReopen) {
					const reopenResp = await fetch(`http://localhost:3002/api/months/${result.month_id}/reopen`, {
						method: 'POST',
					})
					if (reopenResp.ok) return await handleDeleteIncome(transaction)
					alert('Nie udało się otworzyć miesiąca')
				}
				return
			}
			if (response.ok) {
				alert('Wpływ usunięty.')
				window.location.reload() // lub odśwież dane w inny sposób
			} else {
				throw new Error(result.message || 'Nie udało się usunąć wpływu.')
			}
		} catch (error) {
			alert(`Wystąpił błąd: ${error.message}`)
		}
	}

	function getBalanceAfter(transaction, specificAccount = null) {
		// Filtrujemy wszystkie wpływy, wydatki i transfery na to samo konto do momentu tej transakcji (włącznie)
		// Jeśli podano specificAccount, używamy tego konta, w przeciwnym razie bierzemy konto z transakcji
		const account = specificAccount || transaction.toAccount || transaction.account
		if (!account) return '-'

		const date = transaction.date
		// ID transakcji, aby uwzględnić tylko transakcje wykonane przed lub równocześnie z tą transakcją
		const transactionId = transaction.id || 0

		// Sortujemy transakcje po dacie i id
		const sorted = transactions
			.filter(t => {
				// Sprawdzamy czy transakcja dotyczy danego konta (czy jako źródło czy jako cel)
				const isAccountSource = t.account === account || t.fromAccount === account
				const isAccountDestination =
					t.toAccount === account || (t.description && t.description.includes(`do: ${account}`))

				// Uwzględniamy transakcje do tej daty
				if (t.date < date) return isAccountSource || isAccountDestination

				// Dla transakcji z tą samą datą, sprawdzamy ID, aby zapewnić poprawną kolejność
				if (t.date === date) {
					const tId = t.id || 0
					return (isAccountSource || isAccountDestination) && tId <= transactionId
				}

				return false
			})
			.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0)))

		let saldo = 0
		for (const t of sorted) {
			if (t.type === 'income' && !isBalanceExpenseIncome(t) && (t.account === account || t.toAccount === account)) {
				saldo += Number(t.cost || t.amount || 0)
			}
			if (t.type === 'expense' && t.account === account) {
				saldo -= Number(t.cost || 0)
			}
			if (t.type === 'transfer') {
				// Dla transferu odejmujemy kwotę, jeśli konto jest źródłem transferu
				if (t.account === account || t.fromAccount === account) {
					saldo -= Number(t.cost || t.amount || 0)
				}
				// Dodajemy kwotę, jeśli konto jest celem transferu
				else if (t.toAccount === account || (t.description && t.description.includes(`do: ${account}`))) {
					saldo += Number(t.cost || t.amount || 0)
				}
			}
		}
		return formatCurrency(saldo)
	}

	const handleCategoryClick = categoryName => {
		let categoryTransactions = transactions.filter(t => t.category === categoryName)

		// Dla zakupów codziennych - oblicz całkowitą kwotę dla każdej daty
		if (categoryName === 'zakupy codzienne') {
			// Grupuj transakcje według daty
			const transactionsByDate = categoryTransactions.reduce((acc, t) => {
				const dateKey = t.date || 'unknown'
				if (!acc[dateKey]) {
					acc[dateKey] = []
				}
				acc[dateKey].push(t)
				return acc
			}, {})

			// Dodaj totalAmount do każdej transakcji
			categoryTransactions = categoryTransactions.map(t => {
				const dateKey = t.date || 'unknown'
				const transactionsOnSameDate = transactionsByDate[dateKey] || []
				const totalAmount = transactionsOnSameDate.reduce((sum, tx) => sum + (parseFloat(tx.cost) || 0), 0)

				return {
					...t,
					totalAmount: totalAmount,
				}
			})
		}

		setModalInfo({
			isOpen: true,
			category: categoryName,
			transactions: categoryTransactions,
		})
	}

	const handleCloseModal = () => {
		setModalInfo({ isOpen: false, category: '', transactions: [] })
	}

	// Funkcja do edycji transferu
	const handleEditTransfer = transfer => {
		setEditTransferModal({ isOpen: true, transaction: transfer })
	}

	// Funkcja do zapisywania edytowanego transferu
	const handleSaveEditTransfer = async updatedData => {
		try {
			const response = await fetch('http://localhost:3002/api/expenses', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ original: editTransferModal.transaction, updated: updatedData }),
			})
			let result
			try {
				result = await response.json()
			} catch {
				result = {}
			}
			if (response.status === 202 && result?.needsConfirmation && result.action === 'reopen_month' && result.month_id) {
				const confirmReopen = window.confirm(
					result.message || `Miesiąc ${result.month_id} jest zamknięty. Otworzyć aby zaktualizować transfer?`
				)
				if (confirmReopen) {
					const reopenResp = await fetch(`http://localhost:3002/api/months/${result.month_id}/reopen`, {
						method: 'POST',
					})
					if (reopenResp.ok) return await handleSaveEditTransfer(updatedData)
					alert('Nie udało się otworzyć miesiąca')
				}
				return
			}
			if (response.ok) {
				alert('Transfer zaktualizowany!')
				setEditTransferModal({ isOpen: false, transaction: null })
				window.location.reload() // lub odśwież dane w inny sposób
			} else {
				throw new Error(result.message || 'Błąd aktualizacji')
			}
		} catch (error) {
			alert(`Wystąpił błąd: ${error.message}`)
		}
	}

	// Funkcja do cofania transferu
	const handleUndoTransfer = async transfer => {
		if (!window.confirm('Czy na pewno chcesz cofnąć ten transfer? Ta operacja usunie oba rekordy transferu.')) return

		try {
			// Ponieważ transfer składa się z dwóch transakcji, musimy usunąć obie
			const response = await fetch('http://localhost:3002/api/expenses/transfer', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: transfer.id,
					date: transfer.date,
					fromAccount: transfer.fromAccount,
					toAccount: transfer.toAccount,
					amount: transfer.cost || transfer.amount,
				}),
			})
			let result
			try {
				result = await response.json()
			} catch {
				result = {}
			}
			if (response.status === 202 && result?.needsConfirmation && result.action === 'reopen_month' && result.month_id) {
				const confirmReopen = window.confirm(
					result.message || `Miesiąc ${result.month_id} jest zamknięty. Otworzyć aby cofnąć transfer?`
				)
				if (confirmReopen) {
					const reopenResp = await fetch(`http://localhost:3002/api/months/${result.month_id}/reopen`, {
						method: 'POST',
					})
					if (reopenResp.ok) return await handleUndoTransfer(transfer)
					alert('Nie udało się otworzyć miesiąca')
				}
				return
			}
			if (response.ok) {
				alert('Transfer został cofnięty.')
				window.location.reload() // lub odśwież dane w inny sposób
			} else {
				throw new Error(result.message || 'Nie udało się cofnąć transferu.')
			}
		} catch (error) {
			alert(`Wystąpił błąd: ${error.message}`)
		}
	}

	// Usunięto pasek i funkcję formatowania nazwy miesiąca

	return (
		<>
			<div className='dashboard'>
				{/* Pasek nawigacji miesiącami i przycisk dodania miesiąca zostały usunięte na życzenie użytkownika */}

				<div className='stats-grid'>
					<div className='card'>
						<h2>Główne Statystyki</h2>
						<AccountBalances refreshKey={transactions.length} selectedMonthId={selectedMonthId} />
						<div className='highlighted-stat'>
							<span className='label'>Suma kont:</span>
							<span className={`value ${stats.totalAccountsBalance >= 0 ? 'positive' : 'negative'}`}>
								{formatCurrency(stats.totalAccountsBalance)}
							</span>
						</div>
						<div className='highlighted-stat' style={{ marginTop: 6 }}>
							<span className='label'>Ostatni wydatek:</span>
							{lastExpense ? (
								<span className='value'>
									{lastExpense.category || '-'}
									{typeof lastExpense.amount !== 'undefined' ? ' — ' + formatCurrency(Number(lastExpense.amount)) : ''}
									{lastExpense.date ? ' — ' + formatDate(lastExpense.date) : ''}
								</span>
							) : (
								<span className='value' style={{ color: '#888' }}>
									brak
								</span>
							)}
						</div>
					</div>

					<div className='card'>
						<h2>Aktualny miesiąc</h2>
						<div style={{ margin: '4px 0 12px 0' }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
								<span>Wykorzystanie budżetu</span>
								<span>
									{budgetValue > 0
										? `${totalExpensesForBudget.toFixed(2)} / ${budgetValue.toFixed(2)} PLN (${budgetUsedPctRaw.toFixed(
												1
										  )}%)` + (budgetUsedPctRaw > 100 ? `, +${(budgetUsedPctRaw - 100).toFixed(1)}% ponad` : '')
										: 'Brak budżetu'}
								</span>
							</div>
							<div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
								<div
									style={{
										width: `${budgetBarPct}%`,
										height: '100%',
										background: budgetBarColor,
										transition: 'width .3s',
									}}
								/>
							</div>
						</div>

						{/* Pasek porównania ze średnią wydatków */}
						{averageExpenses && averageExpenses.average > 0 && (
							<div style={{ margin: '4px 0 12px 0' }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
									<span>Porównanie ze średnią</span>
									<span>
										{`${stats.totalExpenses.toFixed(2)} / ${averageExpenses.average.toFixed(2)} PLN (${(
											(stats.totalExpenses / averageExpenses.average) *
											100
										).toFixed(1)}%)`}
										{stats.totalExpenses > averageExpenses.average &&
											`, +${((stats.totalExpenses / averageExpenses.average - 1) * 100).toFixed(1)}% ponad średnią`}
									</span>
								</div>
								<div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
									<div
										style={{
											width: `${Math.min((stats.totalExpenses / averageExpenses.average) * 100, 100)}%`,
											height: '100%',
											background: getBarColor((stats.totalExpenses / averageExpenses.average) * 100),
											transition: 'width .3s',
										}}
									/>
								</div>
							</div>
						)}

						<div className='highlighted-stat'>
							<div className='section-title'>
								<span className='label'>Bilans miesiąca:</span>
								<span className={`value ${stats.monthlyBalance >= 0 ? 'positive' : 'negative'}`}>
									{formatCurrency(stats.monthlyBalance)}
								</span>
							</div>
						</div>
						<div className='highlighted-stat budget-stat'>
							<div className='section-title'>
								<span className='label'>Założony bilans miesiąca:</span>
								<span className={`value ${stats.monthlyBudgetBalance >= 0 ? 'positive' : 'negative'}`}>
									{formatCurrency(stats.monthlyBudgetBalance)}
								</span>
							</div>
							<button
								className='small-button'
								onClick={() => {
									const newBudget = prompt('Podaj założony budżet miesiąca:', monthBudget)
									if (newBudget !== null) {
										const budget = parseFloat(newBudget.replace(',', '.'))
										if (!isNaN(budget) && budget >= 0) {
											// usunięto edycję budżetu – interfejs uproszczony
											// Zapisz budżet w bazie danych
											fetch(`http://localhost:3002/api/months/${currentMonth.id}`, {
												method: 'PATCH',
												headers: { 'Content-Type': 'application/json' },
												body: JSON.stringify({ budget }),
											})
												.then(response => {
													if (!response.ok) throw new Error('Błąd zapisywania budżetu')
													return response.json()
												})
												.then(data => console.log('Budżet zaktualizowany:', data))
												.catch(error => console.error('Błąd:', error))
										} else {
											alert('Podaj poprawną wartość liczbową (nie mniejszą niż 0).')
										}
									}
								}}>
								✏️
							</button>
						</div>
						<hr />
						<CollapsibleSection
							title={
								<div className='section-title'>
									<span>Suma wpływów:</span>
									<span className='section-amount'>{formatCurrency(stats.totalIncome)}</span>
								</div>
							}>
							<div style={{ marginBottom: '8px', fontWeight: 500 }}>Wpływy początkowe</div>
							<ul>
								{initialIncomes.length === 0 && <li style={{ color: '#888' }}>Brak wpływów początkowych</li>}
								{initialIncomes.map(t => (
									<li key={t.id} className='income-list-item'>
										<span className='income-date'>{formatDate(t.date)}</span>:
										<span className='income-desc'> {t.description} </span>
										<span className='income-amount'>{formatCurrency(t.cost || t.amount)}</span>
										<span className='income-actions'>
											<button title='Pokaż szczegóły' onClick={() => setIncomeModal({ isOpen: true, transaction: t })}>
												🔍
											</button>
											<button title='Edytuj' onClick={() => handleEditIncome(t)}>
												✏️
											</button>
											{/* Brak opcji usuń dla wpływów początkowych */}
										</span>
									</li>
								))}
							</ul>
							<div style={{ margin: '12px 0 8px 0', fontWeight: 500 }}>Wpływy dodatkowe</div>
							<ul>
								{extraIncomes.length === 0 && <li style={{ color: '#888' }}>Brak wpływów dodatkowych</li>}
								{extraIncomes.map(t => (
									<li key={t.id} className='income-list-item'>
										<span className='income-date'>{formatDate(t.date)}</span>:
										<span className='income-desc'> {t.description} </span>
										<span className='income-amount'>{formatCurrency(t.cost || t.amount)}</span>
										<span className='income-actions'>
											<button title='Pokaż szczegóły' onClick={() => setIncomeModal({ isOpen: true, transaction: t })}>
												🔍
											</button>
											<button title='Edytuj' onClick={() => handleEditIncome(t)}>
												✏️
											</button>
											<button title='Usuń' onClick={() => handleDeleteIncome(t)}>
												🗑️
											</button>
										</span>
									</li>
								))}
							</ul>
						</CollapsibleSection>

						<CollapsibleSection
							title={
								<div className='section-title'>
									<span>Suma wydatków:</span>
									<span className='section-amount'>
										{formatCurrency(stats.totalExpenses)}
										{averageExpenses && averageExpenses.average > 0 && (
											<span style={{ fontSize: '0.8em', fontWeight: 'normal', color: '#666' }}>
												{' '}
												(śr. {formatCurrency(averageExpenses.average)})
											</span>
										)}
									</span>
								</div>
							}>
							<div className='expense-stats-table'>
								<div className='expense-stats-header'>
									<span>Kategoria</span>
									<span>Kwota</span>
									<span>Średnio / msc</span>
								</div>
								{Object.entries(stats.expenseByCategory)
									.filter(([category]) => {
										// Ukryj niechciane kategorie
										const hiddenCategories = ['wyrównania', 'Wydatek KWNR']
										return !hiddenCategories.includes(category)
									})
									.sort((a, b) => b[1] - a[1])
									.map(([category, amount]) => {
										// Mapowanie nazw kategorii do kluczy w średnich
										const getCategoryKey = cat => {
											const mapping = {
												'zakupy codzienne': 'zakupy codzienne',
												auta: 'auta',
												dom: 'dom',
												'wyjścia i szama do domu': 'wyjścia i szama do domu',
												pies: 'pies',
												prezenty: 'prezenty',
												rachunki: 'rachunki',
												subkonta: 'subkonta',
												// Podkategorie (ZC)
												jedzenie: 'jedzenie',
												słodycze: 'słodycze',
												alkohol: 'alkohol',
												higiena: 'higiena',
												apteka: 'apteka',
												chemia: 'chemia',
												zakupy: 'zakupy',
												kwiatki: 'kwiatki',
											}
											return mapping[cat.toLowerCase()] || cat.toLowerCase()
										}

										// Mapowanie nazw kategorii do wyświetlania
										const getCategoryDisplayName = cat => {
											const displayMapping = {
												'zakupy codzienne': 'Zakupy codzienne',
												auta: 'Auta',
												dom: 'Dom',
												'wyjścia i szama do domu': 'Wyjścia i szama do domu',
												pies: 'Pies',
												prezenty: 'Prezenty',
												wyjazdy: 'Wyjazdy',
												rachunki: 'Rachunki',
												subkonta: 'Subkonta',
												// Podkategorie (ZC)
												jedzenie: 'Jedzenie',
												słodycze: 'Słodycze',
												alkohol: 'Alkohol',
												higiena: 'Higiena',
												apteka: 'Apteka',
												chemia: 'Chemia',
												zakupy: 'Zakupy',
												kwiatki: 'Kwiatki',
											}
											return displayMapping[cat] || cat
										}

										const categoryKey = getCategoryKey(category)
										const average = categoryAverages[categoryKey] || 0
										const displayName = getCategoryDisplayName(category)

										return (
											<div key={category} onClick={() => handleCategoryClick(category)} className='expense-stats-row'>
												<span className='category-name'>{displayName}</span>
												<span className='category-amount'>{formatCurrency(amount)}</span>
												<span className='category-average'>{average > 0 ? formatCurrency(average) : '-'}</span>
											</div>
										)
									})}
							</div>
						</CollapsibleSection>
						<CollapsibleSection
							title={
								<div className='section-title'>
									<span>Transfery między kontami:</span>
									<span className='section-amount'>{formatCurrency(stats.totalTransfers)}</span>
								</div>
							}>
							<ul className='transfers-list'>
								{stats.transfers.length === 0 && <li style={{ color: '#888' }}>Brak transferów</li>}
								{stats.transfers.map(transfer => (
									<li key={transfer.id} className='transfer-list-item'>
										<div className='transfer-row'>
											<span className='transfer-date'>{formatDate(transfer.date)}</span>
											<span className='transfer-accounts'>
												<span className='account-from'>{transfer.fromAccount}</span>
												<span className='transfer-arrow'>→</span>
												<span className='account-to'>{transfer.toAccount}</span>
											</span>
										</div>
										<div className='transfer-row secondary'>
											<span className='transfer-amount'>{formatCurrency(transfer.cost || transfer.amount)}</span>
											<span className='transfer-actions'>
												<button
													className='action-button'
													title='Pokaż szczegóły'
													onClick={() => setTransferModal({ isOpen: true, transaction: transfer })}>
													🔍
												</button>
												<button className='action-button' title='Edytuj' onClick={() => handleEditTransfer(transfer)}>
													✏️
												</button>
												<button className='action-button' title='Cofnij' onClick={() => handleUndoTransfer(transfer)}>
													↩️
												</button>
											</span>
										</div>
									</li>
								))}
							</ul>
						</CollapsibleSection>
					</div>
				</div>
				{/* ...przyciski przeniesione wyżej */}
			</div>

			{/* Modal szczegółów wpływu */}
			<Modal
				isOpen={incomeModal.isOpen}
				onClose={() => setIncomeModal({ isOpen: false, transaction: null })}
				title='Szczegóły wpływu'>
				{incomeModal.transaction && (
					<div className='transaction-full-details'>
						<ul>
							<li>
								<strong>Konto:</strong> {incomeModal.transaction.toAccount || incomeModal.transaction.account || '-'}
							</li>
							<li>
								<strong>Kwota:</strong> {formatCurrency(incomeModal.transaction.cost || incomeModal.transaction.amount)}
							</li>
							<li>
								<strong>Opis:</strong> {incomeModal.transaction.description || '-'}
							</li>
							<li>
								<strong>Data:</strong>{' '}
								{incomeModal.transaction.date
									? new Date(incomeModal.transaction.date).toLocaleDateString('pl-PL')
									: '-'}
							</li>
							<li>
								<strong>Notatka:</strong> {incomeModal.transaction.extraDescription || '-'}
							</li>
							<li>
								<strong>Saldo po operacji:</strong> {getBalanceAfter(incomeModal.transaction)}
							</li>
							{isInitialIncome(incomeModal.transaction) && (
								<li style={{ marginTop: '10px' }}>
									<strong>Wyliczenia do wpływu początkowego:</strong>
									<br />
									<span style={{ color: '#888' }}>
										Wyliczenia będą dostępne po wdrożeniu panelu otwierania miesiąca.
									</span>
								</li>
							)}
						</ul>
					</div>
				)}
			</Modal>

			{/* Modal edycji wpływu */}
			{editIncomeModal.isOpen && editIncomeModal.transaction && (
				<EditTransactionModal
					isOpen={editIncomeModal.isOpen}
					onClose={() => setEditIncomeModal({ isOpen: false, transaction: null })}
					transaction={editIncomeModal.transaction}
					onSave={handleSaveEditIncome}
				/>
			)}

			<CategoryDetailsModal
				isOpen={modalInfo.isOpen}
				onClose={handleCloseModal}
				categoryName={modalInfo.category}
				transactions={modalInfo.transactions}
				onDataChange={() => window.location.reload()} // Dodajemy funkcję odświeżania
			/>

			{/* Modal szczegółów transferu */}
			<Modal
				isOpen={transferModal.isOpen}
				onClose={() => setTransferModal({ isOpen: false, transaction: null })}
				title='Szczegóły transferu'>
				{transferModal.transaction && (
					<div className='transaction-full-details'>
						<ul>
							<li>
								<strong>Z konta:</strong>{' '}
								{transferModal.transaction.fromAccount || transferModal.transaction.account || '-'}
							</li>
							<li>
								<strong>Saldo konta źródłowego po operacji:</strong>{' '}
								{getBalanceAfter(
									transferModal.transaction,
									transferModal.transaction.fromAccount || transferModal.transaction.account
								)}
							</li>
							<li>
								<strong>Na konto:</strong> {transferModal.transaction.toAccount || '-'}
							</li>
							<li>
								<strong>Saldo konta docelowego po operacji:</strong>{' '}
								{getBalanceAfter(transferModal.transaction, transferModal.transaction.toAccount)}
							</li>
							<li>
								<strong>Kwota:</strong>{' '}
								{formatCurrency(transferModal.transaction.cost || transferModal.transaction.amount)}
							</li>
							<li>
								<strong>Data:</strong>{' '}
								{transferModal.transaction.date
									? new Date(transferModal.transaction.date).toLocaleDateString('pl-PL')
									: '-'}
							</li>
							<li>
								<strong>Notatka:</strong> {transferModal.transaction.extraDescription || '-'}
							</li>
						</ul>
					</div>
				)}
			</Modal>

			{/* Modal edycji transferu */}
			{editTransferModal.isOpen && editTransferModal.transaction && (
				<EditTransactionModal
					isOpen={editTransferModal.isOpen}
					onClose={() => setEditTransferModal({ isOpen: false, transaction: null })}
					transaction={editTransferModal.transaction}
					onSave={handleSaveEditTransfer}
					isTransfer={true}
				/>
			)}
		</>
	)
}

export default StatisticsDashboard
