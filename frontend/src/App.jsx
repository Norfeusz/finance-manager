import { useState, useEffect } from 'react'
import StatisticsDashboard from './components/StatisticsDashboard'
import DataEntryForm from './components/DataEntryForm'
import ShoppingStats from './components/ShoppingStats'
import RecentTransactions from './components/RecentTransactions'
import AIReportModal from './components/AIReportModal'
import './App.css'
import Modal from './components/Modal'

function App() {
	const [transactions, setTransactions] = useState([])
	const [allTransactions, setAllTransactions] = useState([]) // Wszystkie transakcje dla RecentTransactions
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [refreshKey, setRefreshKey] = useState(0)
	const [selectedMonthId, setSelectedMonthId] = useState(() => {
		const d = new Date()
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
	})
	const [months, setMonths] = useState([]) // pełne obiekty
	const [showAIModal, setShowAIModal] = useState(false)

	// Modal do edycji dwóch kwot wpływów początkowych w jednym oknie
	const [initialIncomesModal, setInitialIncomesModal] = useState({
		open: false,
		monthId: null,
		plannedBudget: null,
		gabi: '',
		norf: '',
	})

	// Funkcje obsługi transakcji dla RecentTransactions
	const handleEditTransaction = id => {
		console.log('Edytuj transakcję:', id)
		// TODO: Implementuj logikę edycji
		alert('Funkcja edycji będzie dostępna wkrótce')
	}

	const handleDeleteTransaction = async id => {
		if (!window.confirm('Czy na pewno chcesz usunąć tę transakcję?')) {
			return
		}

		try {
			const response = await fetch(`http://localhost:3002/api/transactions/${id}`, {
				method: 'DELETE',
			})

			if (response.ok) {
				setRefreshKey(prev => prev + 1)
				alert('Transakcja została usunięta')
			} else {
				throw new Error('Błąd serwera')
			}
		} catch (error) {
			console.error('Błąd:', error)
			alert('Nie udało się usunąć transakcji')
		}
	}

	// Funkcja pobierania wszystkich transakcji dla RecentTransactions
	const fetchAllTransactions = async () => {
		try {
			const response = await fetch('http://localhost:3002/api/transactions')
			if (!response.ok) throw new Error('Błąd serwera: ' + response.statusText)
			const data = await response.json()
			setAllTransactions(data)
		} catch (err) {
			console.error('Błąd podczas pobierania wszystkich transakcji:', err)
		}
	}

	useEffect(() => {
		const fetchTransactions = async () => {
			setLoading(true)
			try {
				// Najpierw pobierz listę miesięcy (jednorazowo lub gdy refresh)
				const monthsResp = await fetch('http://localhost:3002/api/months')
				if (monthsResp.ok) {
					const monthsData = await monthsResp.json()
					setMonths(monthsData)
					if (monthsData.length && !monthsData.find(m => m.id === selectedMonthId)) {
						const sorted = monthsData
							.map(m => m.id)
							.sort()
							.reverse()
						setSelectedMonthId(sorted[0])
					}
				}
				const response = await fetch(`http://localhost:3002/api/transactions?month_id=${selectedMonthId}`)
				if (!response.ok) throw new Error('Błąd serwera: ' + response.statusText)
				const data = await response.json()
				setTransactions(data)
			} catch (err) {
				setError(err.message)
			} finally {
				setLoading(false)
			}
		}
		fetchTransactions()
	}, [refreshKey, selectedMonthId])

	// useEffect do pobierania wszystkich transakcji
	useEffect(() => {
		fetchAllTransactions()
	}, [refreshKey])

	const refreshData = () => {
		setRefreshKey(prevKey => prevKey + 1)
	}

	const selectedMonthObj = months.find(m => m.id === selectedMonthId)

	const toggleMonthLock = async () => {
		if (!selectedMonthObj) return
		try {
			const endpoint = selectedMonthObj.is_closed ? 'reopen' : 'close'
			// Dodatkowa walidacja przy zamykaniu miesiąca: jeśli brak odjęć w Rachunkach – ostrzeż
			if (!selectedMonthObj.is_closed) {
				try {
					const r = await fetch(`http://localhost:3002/api/accounts/bills/${selectedMonthObj.id}`)
					if (r.ok) {
						const js = await r.json()
						const hasDeductions = Array.isArray(js.deductions) && js.deductions.length > 0
						if (!hasDeductions) {
							const proceed = window.confirm(
								`Chcesz zamknąć miesiąc ${selectedMonthObj.id}, ale nie ma zapisanych odjęć rachunków. Czy na pewno chcesz zamknąć?`
							)
							if (!proceed) return
						}
					}
				} catch {
					/* brak blokady w razie błędu */
				}
			}
			const confirmMsg = selectedMonthObj.is_closed
				? `Czy na pewno chcesz otworzyć miesiąc ${selectedMonthObj.id}?`
				: `Czy na pewno chcesz zamknąć miesiąc ${selectedMonthObj.id}?`
			if (!window.confirm(confirmMsg)) return
			const resp = await fetch(`http://localhost:3002/api/months/${selectedMonthObj.id}/${endpoint}`, {
				method: 'POST',
			})
			if (!resp.ok) throw new Error('Błąd przy zmianie statusu miesiąca')
			setRefreshKey(k => k + 1) // spowoduje refetch miesięcy i transakcji
		} catch (e) {
			alert(e.message)
		}
	}

	// Otwórz modal z sugestiami (jeśli są) i pozwól edytować obie kwoty naraz
	const openInitialIncomesModal = async (monthId, plannedBudget) => {
		try {
			const sugResp = await fetch(`http://localhost:3002/api/months/${monthId}/suggested-initial-incomes`)
			if (!sugResp.ok) return // brak sugestii – pomijamy modal
			const sug = await sugResp.json()
			const defG = (Number(sug.gabi) || 0).toFixed(2)
			const defN = (Number(sug.norf) || 0).toFixed(2)
			setInitialIncomesModal({
				open: true,
				monthId,
				plannedBudget: plannedBudget == null ? null : Number(plannedBudget),
				gabi: defG,
				norf: defN,
			})
		} catch (e) {
			console.error(e)
		}
	}

	const handleConfirmInitialIncomes = async () => {
		const { monthId, plannedBudget, gabi, norf } = initialIncomesModal
		const gVal = parseFloat(String(gabi).replace(',', '.'))
		const nVal = parseFloat(String(norf).replace(',', '.'))
		if (!isFinite(gVal) || gVal < 0 || !isFinite(nVal) || nVal < 0) {
			alert('Nieprawidłowe kwoty wpływów początkowych.')
			return
		}
		const sum = gVal + nVal
		if (plannedBudget != null && isFinite(plannedBudget) && sum > plannedBudget) {
			const cont = window.confirm(
				`Suma wpływów (${sum.toFixed(2)} zł) przewyższa planowany budżet (${Number(plannedBudget).toFixed(
					2
				)} zł). Czy mimo to dodać takie kwoty?`
			)
			if (!cont) return
		}
		const payload = [
			{
				flowType: 'income',
				data: { toAccount: 'Gabi', amount: gVal.toFixed(2), from: 'Wpływ początkowy', date: `${monthId}-01` },
			},
			{
				flowType: 'income',
				data: { toAccount: 'Norf', amount: nVal.toFixed(2), from: 'Wpływ początkowy', date: `${monthId}-01` },
			},
		]
		try {
			const incResp = await fetch('http://localhost:3002/api/expenses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			if (!incResp.ok) {
				alert('Nie udało się dodać wpływów początkowych.')
				return // pozostaw modal otwarty do poprawy lub anulowania
			}
			setInitialIncomesModal(prev => ({ ...prev, open: false }))
			setRefreshKey(k => k + 1)
		} catch (e) {
			console.error(e)
			alert('Błąd sieci przy dodawaniu wpływów.')
		}
	}

	const handleCancelInitialIncomes = () => {
		setInitialIncomesModal(prev => ({ ...prev, open: false }))
	}

	// Funkcja dodawania nowego miesiąca
	const addMonth = async () => {
		if (!months.length) {
			// jeśli brak miesięcy zaproponuj bieżący
			const now = new Date()
			const def = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
			const entered = window.prompt('Podaj miesiąc do utworzenia (YYYY-MM):', def)
			if (!entered) return
			if (!/^\d{4}-\d{2}$/.test(entered)) {
				alert('Nieprawidłowy format.')
				return
			}
			const [y, m] = entered.split('-').map(Number)
			let budget = window.prompt('Jaki zakładasz budżet na ten miesiąc? (zł)', '4200')
			if (budget === null) return // anulowano
			budget = budget.trim()
			if (budget !== '' && isNaN(parseFloat(budget))) {
				alert('Nieprawidłowa kwota budżetu')
				return
			}
			try {
				const resp = await fetch('http://localhost:3002/api/months', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						year: y,
						month: m,
						forceCreate: true,
						budget: budget === '' ? null : parseFloat(budget),
					}),
				})
				if (!resp.ok) {
					alert('Błąd tworzenia miesiąca')
					return
				}
				setRefreshKey(k => k + 1)
				setSelectedMonthId(entered)
				// Otwórz modal z dwiema kwotami (jeśli istnieją sugestie)
				await openInitialIncomesModal(entered, budget === '' ? null : parseFloat(budget))
			} catch (e) {
				console.error(e)
				alert('Błąd sieci')
			}
			return
		}
		// znajdź ostatni (największy) miesiąc
		const sorted = months.map(m => m.id).sort() // rosnąco
		const last = sorted[sorted.length - 1]
		const [ly, lm] = last.split('-').map(Number)
		const nextDate = new Date(ly, lm - 1, 1)
		nextDate.setMonth(nextDate.getMonth() + 1)
		const defNext = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
		const entered = window.prompt('Podaj miesiąc do utworzenia (YYYY-MM):', defNext)
		if (!entered) return
		if (!/^\d{4}-\d{2}$/.test(entered)) {
			alert('Nieprawidłowy format.')
			return
		}
		// sprawdź czy istnieje
		if (months.find(m => m.id === entered)) {
			alert('Taki miesiąc już istnieje.')
			return
		}
		// sprawdź poprzedni miesiąc względem entered
		const [ny, nm] = entered.split('-').map(Number)
		const prevDate = new Date(ny, nm - 1, 1)
		prevDate.setMonth(prevDate.getMonth() - 1)
		const prevId = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
		const prevMonth = months.find(m => m.id === prevId)
		if (prevMonth && !prevMonth.is_closed) {
			const cont = window.confirm(
				`Poprzedni miesiąc (${prevId}) nie został zamknięty. Czy mimo to utworzyć ${entered}?`
			)
			if (!cont) return
		}
		let budget = window.prompt('Jaki zakładasz budżet na ten miesiąc? (zł)', '4200')
		if (budget === null) return // anulowano
		budget = budget.trim()
		if (budget !== '' && isNaN(parseFloat(budget))) {
			alert('Nieprawidłowa kwota budżetu')
			return
		}
		try {
			const resp = await fetch('http://localhost:3002/api/months', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					year: ny,
					month: nm,
					forceCreate: true,
					budget: budget === '' ? null : parseFloat(budget),
				}),
			})
			if (!resp.ok) {
				alert('Błąd tworzenia miesiąca')
				return
			}
			setRefreshKey(k => k + 1)
			setSelectedMonthId(entered)
			// Otwórz modal z dwiema kwotami (jeśli istnieją sugestie)
			await openInitialIncomesModal(entered, budget === '' ? null : parseFloat(budget))
		} catch (e) {
			console.error(e)
			alert('Błąd sieci')
		}
	}

	// Funkcja do formatowania nazwy miesiąca
	const getMonthDisplayName = monthId => {
		if (!monthId) return ''
		const [year, month] = monthId.split('-')
		const monthNames = [
			'Styczeń',
			'Luty',
			'Marzec',
			'Kwiecień',
			'Maj',
			'Czerwiec',
			'Lipiec',
			'Sierpień',
			'Wrzesień',
			'Październik',
			'Listopad',
			'Grudzień',
		]
		return `${monthNames[parseInt(month) - 1]} ${year}`
	}

	return (
		<div className='App'>
			<h1>Menadżer Finansów - {getMonthDisplayName(selectedMonthId)}</h1>
			<div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
				<label>
					{' '}
					Miesiąc:
					<select
						value={selectedMonthId}
						onChange={e => setSelectedMonthId(e.target.value)}
						style={{ marginLeft: '0.5rem' }}>
						{months
							.slice()
							.sort((a, b) => (a.id < b.id ? 1 : -1))
							.map(m => (
								<option key={m.id} value={m.id}>
									{m.id}
									{m.is_closed ? ' 🔒' : ''}
								</option>
							))}
					</select>
				</label>
				{selectedMonthObj?.is_closed && (
					<span style={{ color: '#c00', fontWeight: '600' }}>MIESIĄC ZAMKNIĘTY (statystyki zamrożone)</span>
				)}
			</div>
			<div className='main-layout'>
				<div className='form-container'>
					<DataEntryForm
						onNewEntry={refreshData}
						selectedMonthId={selectedMonthId}
						isMonthClosed={!!selectedMonthObj?.is_closed}
						onRefresh={() => setRefreshKey(k => k + 1)}
						onAddMonth={addMonth}
						onToggleMonthLock={toggleMonthLock}
						onShowAIModal={() => setShowAIModal(true)}
					/>
				</div>
				<div className='dashboard-container'>
					{loading && <p className='loading'>Ładowanie danych...</p>}
					{error && <p style={{ color: 'red' }}>Wystąpił błąd: {error}</p>}
					{!loading && !error && (
						<StatisticsDashboard
							transactions={transactions}
							selectedMonthId={selectedMonthId}
							isClosed={!!selectedMonthObj?.is_closed}
							monthBudget={selectedMonthObj?.budget}
							onAddMonth={addMonth}
						/>
					)}
				</div>
				<div className='shopping-stats-container'>
					{!loading && !error && (
						<ShoppingStats
							refreshKey={refreshKey}
							transactions={transactions}
							onDataChange={refreshData}
							selectedMonthId={selectedMonthId}
						/>
					)}
				</div>
				<div className='recent-transactions-container'>
					{!loading && !error && (
						<div className='card'>
							<RecentTransactions
								transactions={allTransactions}
								onEdit={handleEditTransaction}
								onDelete={handleDeleteTransaction}
							/>
						</div>
					)}
				</div>
			</div>
			{/* Modal: jednoczesna edycja obu kwot wpływów początkowych */}
			<Modal
				isOpen={initialIncomesModal.open}
				onClose={handleCancelInitialIncomes}
				title={`Wpływy początkowe dla ${initialIncomesModal.monthId || ''}`}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
					{initialIncomesModal.plannedBudget != null && (
						<div style={{ fontSize: '0.9rem', color: '#555' }}>
							Planowany budżet: {Number(initialIncomesModal.plannedBudget).toFixed(2)} zł
						</div>
					)}
					<label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
						<span style={{ width: 120 }}>Gabi:</span>
						<input
							type='text'
							inputMode='decimal'
							value={initialIncomesModal.gabi}
							onChange={e => setInitialIncomesModal(prev => ({ ...prev, gabi: e.target.value }))}
							style={{ padding: '0.35rem 0.5rem', width: '140px' }}
						/>
					</label>
					<label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
						<span style={{ width: 120 }}>Norf:</span>
						<input
							type='text'
							inputMode='decimal'
							value={initialIncomesModal.norf}
							onChange={e => setInitialIncomesModal(prev => ({ ...prev, norf: e.target.value }))}
							style={{ padding: '0.35rem 0.5rem', width: '140px' }}
						/>
					</label>
					<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
						<button onClick={handleCancelInitialIncomes}>Anuluj</button>
						<button
							onClick={handleConfirmInitialIncomes}
							style={{ background: '#2c7', color: '#fff', border: 'none', padding: '0.4rem 0.75rem', borderRadius: 4 }}>
							Potwierdź
						</button>
					</div>
				</div>
			</Modal>

			{/* AI Report Modal */}
			<AIReportModal isVisible={showAIModal} onClose={() => setShowAIModal(false)} />
		</div>
	)
}

export default App
