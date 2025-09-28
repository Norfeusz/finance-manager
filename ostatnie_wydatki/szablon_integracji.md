# Szablon integracji z App.jsx

## Przykład kompletnej integracji w głównym komponencie App

```jsx
import { useState, useEffect } from 'react'
import StatisticsDashboard from './components/StatisticsDashboard'
import DataEntryForm from './components/DataEntryForm'
import ShoppingStats from './components/ShoppingStats'
import RecentTransactions from './components/RecentTransactions' // ← DODAJ TEN IMPORT
import Modal from './components/Modal'
import './App.css'

function App() {
	const [transactions, setTransactions] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [refreshKey, setRefreshKey] = useState(0)
	const [selectedMonthId, setSelectedMonthId] = useState(() => {
		const d = new Date()
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
	})
	const [months, setMonths] = useState([])

	// ===== DODAJ TE FUNKCJE =====
	
	/**
	 * Obsługa edycji transakcji
	 */
	const handleEditTransaction = (id) => {
		console.log('Edytuj transakcję o ID:', id)
		// TODO: Zaimplementuj logikę edycji
		// Przykład:
		// setEditingTransactionId(id)
		// setShowEditModal(true)
	}

	/**
	 * Obsługa usuwania transakcji
	 */
	const handleDeleteTransaction = async (id) => {
		if (!window.confirm('Czy na pewno chcesz usunąć tę transakcję?')) {
			return
		}

		try {
			const response = await fetch(`http://localhost:3002/api/transactions/${id}`, {
				method: 'DELETE'
			})

			if (response.ok) {
				// Odśwież listę transakcji
				setRefreshKey(prev => prev + 1)
				alert('Transakcja została usunięta')
			} else {
				throw new Error('Błąd podczas usuwania transakcji')
			}
		} catch (error) {
			console.error('Błąd usuwania:', error)
			alert('Nie udało się usunąć transakcji: ' + error.message)
		}
	}

	// ===== RESZTA TWOJEGO KODU (fetchTransactions, useEffect, etc.) =====

	useEffect(() => {
		const fetchTransactions = async () => {
			setLoading(true)
			try {
				// Pobierz miesiące
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

				// Pobierz transakcje
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
	}, [selectedMonthId, refreshKey]) // ← Dodaj refreshKey jako dependency

	if (loading) return <div>Ładowanie...</div>
	if (error) return <div>Błąd: {error}</div>

	return (
		<div className='App'>
			<h1>Manager Finansów - Gabi & Norf</h1>
			
			{/* Twoje istniejące komponenty */}
			<StatisticsDashboard 
				transactions={transactions} 
				months={months} 
				selectedMonthId={selectedMonthId}
				setSelectedMonthId={setSelectedMonthId}
			/>
			
			<DataEntryForm 
				onTransactionAdded={() => setRefreshKey(prev => prev + 1)}
				selectedMonthId={selectedMonthId}
			/>
			
			<ShoppingStats transactions={transactions} />
			
			{/* ===== DODAJ TEN KOMPONENT ===== */}
			<RecentTransactions
				transactions={transactions}
				onEdit={handleEditTransaction}
				onDelete={handleDeleteTransaction}
			/>
			
			{/* Twoje inne komponenty/modals... */}
		</div>
	)
}

export default App
```

## Alternatywa: Integracja jako osobna zakładka

Jeśli chcesz pokazywać "Ostatnie transakcje" jako osobną sekcję:

```jsx
const [activeTab, setActiveTab] = useState('dashboard') // dashboard, recent-transactions, stats, etc.

return (
	<div className='App'>
		<h1>Manager Finansów - Gabi & Norf</h1>
		
		{/* Nawigacja zakładek */}
		<nav className="tabs-navigation">
			<button 
				className={activeTab === 'dashboard' ? 'active' : ''}
				onClick={() => setActiveTab('dashboard')}>
				Dashboard
			</button>
			<button 
				className={activeTab === 'recent-transactions' ? 'active' : ''}
				onClick={() => setActiveTab('recent-transactions')}>
				Ostatnie Transakcje
			</button>
			<button 
				className={activeTab === 'stats' ? 'active' : ''}
				onClick={() => setActiveTab('stats')}>
				Statystyki
			</button>
		</nav>

		{/* Zawartość zakładek */}
		{activeTab === 'dashboard' && (
			<>
				<StatisticsDashboard {...props} />
				<DataEntryForm {...props} />
			</>
		)}

		{activeTab === 'recent-transactions' && (
			<RecentTransactions
				transactions={transactions}
				onEdit={handleEditTransaction}
				onDelete={handleDeleteTransaction}
			/>
		)}

		{activeTab === 'stats' && (
			<ShoppingStats transactions={transactions} />
		)}
	</div>
)
```

## Dodatkowe style dla zakładek (opcjonalne)

```css
/* Dodaj do App.css */
.tabs-navigation {
	display: flex;
	gap: 8px;
	margin-bottom: 20px;
	border-bottom: 2px solid #e9ecef;
}

.tabs-navigation button {
	padding: 10px 20px;
	border: none;
	background: transparent;
	cursor: pointer;
	border-bottom: 2px solid transparent;
	font-size: 14px;
	font-weight: 500;
	color: #6c757d;
	transition: all 0.2s;
}

.tabs-navigation button:hover {
	color: #495057;
	background: #f8f9fa;
}

.tabs-navigation button.active {
	color: #007bff;
	border-bottom-color: #007bff;
	background: #f8f9fa;
}
```

## API Requirements

Upewnij się, że twój backend obsługuje:

### 1. GET /api/transactions
```js
// Zwraca wszystkie transakcje lub transakcje dla miesiąca
// Query params: month_id (opcjonalny)
// Response: Transaction[] lub { transactions: Transaction[], balance: number }
```

### 2. DELETE /api/transactions/:id
```js
// Usuwa transakcję o podanym ID
// Response: { success: boolean, message: string }
```

### 3. PUT /api/transactions/:id (dla edycji)
```js
// Aktualizuje transakcję o podanym ID
// Body: Transaction object
// Response: { success: boolean, transaction: Transaction }
```

## Testowanie

1. **Podstawowe funkcje:**
   - [ ] Komponenty się renderują bez błędów
   - [ ] Transakcje są wyświetlane
   - [ ] Przyciski edycji/usuwania działają

2. **Filtry:**
   - [ ] Filtr typu transakcji
   - [ ] Filtr zakresu dat
   - [ ] Wyszukiwarka po opisie
   - [ ] Własny zakres dat

3. **Paginacja:**
   - [ ] Ładuj więcej/mniej
   - [ ] Kontrola elementów na stronie
   - [ ] Reset przy zmianie filtrów

4. **Responsive:**
   - [ ] Desktop (>1200px)
   - [ ] Tablet (768px-1200px)  
   - [ ] Mobile (<768px)