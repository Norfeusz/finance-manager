import { useState, useEffect } from 'react'
import AccountTransactionsModal from './AccountTransactionsModal'
import './AccountTransactionsModal.css'
import './AccountBalances.css'
import KwnrAccountView from './KwnrAccountView'

function AccountBalances({ refreshKey, selectedMonthId }) {
	const [accountBalances, setAccountBalances] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [selectedAccount, setSelectedAccount] = useState(null)
	const [transactions, setTransactions] = useState([])
	const [showAllTransactions, setShowAllTransactions] = useState(false)

	useEffect(() => {
		const fetchAccountBalances = async () => {
			setLoading(true)
			try {
				const response = await fetch('http://localhost:3002/api/accounts/balances')
				if (!response.ok) {
					throw new Error(`HTTP error ${response.status}`)
				}
				const data = await response.json()
				// Filtruj tylko dozwolone konta
				const allowedAccounts = ['Wspólne', 'Gotówka', 'Oszczędnościowe', 'Rachunki', 'KWNR']
				const filteredData = data.filter(account => allowedAccounts.includes(account.name))
				setAccountBalances(filteredData)
				setError(null)
			} catch (err) {
				console.error('Błąd pobierania stanów kont:', err)
				setError('Nie udało się pobrać stanów kont. Spróbuj ponownie później.')
			} finally {
				setLoading(false)
			}
		}

		fetchAccountBalances()

		// Nasłuchuj na event synchronizacji SC z KWNR
		const handleKwnrScChanged = () => {
			setAccountBalances(accs => [...accs])
		}
		window.addEventListener('kwnr-sc-changed', handleKwnrScChanged)
		return () => {
			window.removeEventListener('kwnr-sc-changed', handleKwnrScChanged)
		}
	}, [refreshKey])

	// Funkcja pomocnicza do formatowania waluty
	const formatCurrency = value => {
		if (value === null || value === undefined) return '-'
		return (
			parseFloat(value).toLocaleString('pl-PL', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			}) + ' zł'
		)
	}

	if (loading) return <div className='loading'>Ładowanie danych o kontach...</div>
	if (error) return <div className='error'>{error}</div>

	// Zmienna showAllTransactions została już zadeklarowana na górze komponentu

	// Funkcja do pobierania transakcji (korzysta z endpointu konta po stronie backendu)
	const fetchTransactions = async (accountName, allMonths = false) => {
		try {
			let url = `http://localhost:3002/api/transactions/account/${encodeURIComponent(accountName)}`
			if (!allMonths) {
				// Zawężamy do wybranego miesiąca, jeśli przekazano selectedMonthId
				if (selectedMonthId) {
					url += `?month_id=${encodeURIComponent(selectedMonthId)}`
				} else {
					// Fallback: bieżący miesiąc na podstawie systemowej daty
					const now = new Date()
					url += `?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
				}
			}

			const response = await fetch(url)
			if (!response.ok) {
				throw new Error(`HTTP error ${response.status}`)
			}

			const data = await response.json()
			// Backend zwraca { transactions, balance }
			return Array.isArray(data?.transactions) ? data.transactions : []
		} catch (err) {
			console.error('Błąd pobierania transakcji:', err)
			throw err
		}
	}

	// Funkcja do obsługi kliknięcia w nazwę konta
	const handleAccountClick = async accountName => {
		// Dla KWNR nie pobieraj tu transakcji (widok KWNR ładuje pełną historię samodzielnie)
		if (accountName === 'KWNR') {
			setShowAllTransactions(false)
			setTransactions([])
			setSelectedAccount(accountName)
			return
		}
		if (accountName === 'Oszczędnościowe' || accountName === 'Rachunki') {
			try {
				// Domyślnie pokaż pełną historię dla jasności (użytkownik może filtrować w głowie miesięcznie)
				const accountTransactions = await fetchTransactions(accountName, true)
				setShowAllTransactions(true)
				setTransactions(accountTransactions)
				setSelectedAccount(accountName)
			} catch (error) {
				console.error('Błąd pobierania transakcji konta:', error)
				alert('Nie udało się pobrać transakcji dla tego konta.')
			}
		}
	}

	// Funkcja do obsługi kliknięcia przycisku "Pokaż wszystkie transakcje"
	const handleShowAllTransactions = async () => {
		if (!selectedAccount) return

		try {
			// Pobierz wszystkie transakcje ze wszystkich miesięcy
			const allTransactions = await fetchTransactions(selectedAccount, true)
			setShowAllTransactions(true)
			setTransactions(allTransactions)
		} catch (error) {
			console.error('Błąd pobierania wszystkich transakcji:', error)
			alert('Nie udało się pobrać wszystkich transakcji.')
		}
	}

	// Funkcja zamykająca modal
	const handleCloseModal = () => {
		setSelectedAccount(null)
		setTransactions([])
	}

	return (
		<div className='account-balances'>
			<h3>Stany kont</h3>
			<table>
				<thead>
					<tr>
						<th>Konto</th>
						<th>Stan bieżący</th>
					</tr>
				</thead>
				<tbody>
					{accountBalances.map(account => {
						// Dla KWNR pokaż Saldo całkowite (SC = SG + SN + DS) synchronizowane z widoku KWNR przez sessionStorage
						let displayBalance = account.current_balance
						if (account.name === 'KWNR') {
							try {
								const derived = JSON.parse(sessionStorage.getItem('kwnrDerived') || 'null')
								if (derived && typeof derived.SC === 'number') {
									displayBalance = derived.SC
								}
							} catch {
								/* ignore */
							}
						}
						return (
							<tr key={account.id}>
								<td
									className={['Oszczędnościowe', 'Rachunki', 'KWNR'].includes(account.name) ? 'clickable-account' : ''}
									onClick={() =>
										['Oszczędnościowe', 'Rachunki', 'KWNR'].includes(account.name) && handleAccountClick(account.name)
									}
									title={
										['Oszczędnościowe', 'Rachunki', 'KWNR'].includes(account.name)
											? 'Kliknij, aby zobaczyć przepływy'
											: ''
									}>
									{account.name}
								</td>
								<td className='current-balance' title={`Stan początkowy: ${formatCurrency(account.initial_balance)}`}>
									{formatCurrency(displayBalance)}
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>

			{/* Modal z transakcjami konta */}
			{selectedAccount && (
				<AccountTransactionsModal
					isOpen={!!selectedAccount}
					onClose={handleCloseModal}
					accountName={selectedAccount}
					transactions={transactions}
					showAllTransactions={showAllTransactions}
					onShowAllTransactions={handleShowAllTransactions}
					currentAccountBalance={accountBalances.find(acc => acc.name === selectedAccount)?.current_balance}
					selectedMonthId={selectedMonthId}
				/>
			)}
		</div>
	)
}

export default AccountBalances
