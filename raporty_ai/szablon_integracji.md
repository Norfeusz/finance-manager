# Szablon integracji Raportów AI z App.jsx

## Kompletny przykład integracji

```jsx
import { useState, useEffect } from 'react'
import StatisticsDashboard from './components/StatisticsDashboard'
import DataEntryForm from './components/DataEntryForm'
import ShoppingStats from './components/ShoppingStats'
import AIReportModal from './components/AIReportModal' // ← DODAJ TEN IMPORT
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

	// ===== DODAJ STAN MODALA AI =====
	const [showAIModal, setShowAIModal] = useState(false)

	// Twoje istniejące useEffect i funkcje...
	useEffect(() => {
		const fetchTransactions = async () => {
			setLoading(true)
			try {
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
	}, [selectedMonthId, refreshKey])

	if (loading) return <div>Ładowanie...</div>
	if (error) return <div>Błąd: {error}</div>

	return (
		<div className='App'>
			<h1>Manager Finansów - Gabi & Norf</h1>
			
			{/* ===== DODAJ PRZYCISK AI RAPORTÓW ===== */}
			<div className="main-navigation" style={{
				display: 'flex', 
				gap: '12px', 
				marginBottom: '20px',
				justifyContent: 'center',
				flexWrap: 'wrap'
			}}>
				<button 
					onClick={() => setShowAIModal(true)}
					className="ai-report-button"
					style={{
						background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
						color: 'white',
						border: 'none',
						padding: '12px 24px',
						borderRadius: '8px',
						cursor: 'pointer',
						fontSize: '14px',
						fontWeight: '600',
						boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
						transition: 'all 0.2s ease',
						display: 'flex',
						alignItems: 'center',
						gap: '8px'
					}}
					onMouseOver={(e) => {
						e.target.style.transform = 'translateY(-2px)'
						e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)'
					}}
					onMouseOut={(e) => {
						e.target.style.transform = 'translateY(0)'
						e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)'
					}}>
					🤖 Raporty AI dla pary
				</button>
			</div>
			
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
			
			{/* ===== DODAJ MODAL AI RAPORTÓW ===== */}
			<AIReportModal
				isVisible={showAIModal}
				onClose={() => setShowAIModal(false)}
			/>
			
			{/* Twoje inne modały i komponenty... */}
		</div>
	)
}

export default App
```

## Alternatywa: Integracja jako część istniejącego dashboardu

Jeśli chcesz dodać przycisk w komponencie `StatisticsDashboard`:

```jsx
// W StatisticsDashboard.jsx
import { useState } from 'react'
import AIReportModal from './AIReportModal'

export default function StatisticsDashboard({ transactions, months, selectedMonthId, setSelectedMonthId }) {
	const [showAIModal, setShowAIModal] = useState(false)

	return (
		<div className="statistics-dashboard">
			<h2>Dashboard Statystyk</h2>
			
			{/* Istniejące elementy dashboardu */}
			{/* ... */}
			
			{/* Sekcja AI Raportów */}
			<div className="ai-reports-section" style={{
				background: '#f8f9fa',
				padding: '20px',
				borderRadius: '8px',
				marginTop: '20px',
				textAlign: 'center'
			}}>
				<h3 style={{ margin: '0 0 12px 0', color: '#333' }}>
					🤖 Inteligentne Analizy Finansowe
				</h3>
				<p style={{ margin: '0 0 16px 0', color: '#666' }}>
					Wygeneruj personalizowane raporty AI dla waszych wspólnych finansów
				</p>
				<button 
					onClick={() => setShowAIModal(true)}
					className="ai-report-button"
					style={{
						background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
						color: 'white',
						border: 'none',
						padding: '10px 20px',
						borderRadius: '6px',
						cursor: 'pointer',
						fontSize: '14px',
						fontWeight: '500'
					}}>
					Otwórz Raporty AI
				</button>
			</div>

			{/* Modal AI */}
			<AIReportModal
				isVisible={showAIModal}
				onClose={() => setShowAIModal(false)}
			/>
		</div>
	)
}
```

## Alternatywa: Nawigacja z zakładkami

```jsx
// W App.jsx z nawigacją zakładkową
const [activeTab, setActiveTab] = useState('dashboard')

return (
	<div className='App'>
		<h1>Manager Finansów - Gabi & Norf</h1>
		
		{/* Nawigacja zakładek */}
		<nav className="main-tabs" style={{
			display: 'flex',
			gap: '4px',
			marginBottom: '20px',
			borderBottom: '2px solid #e9ecef'
		}}>
			<button 
				className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
				onClick={() => setActiveTab('dashboard')}
				style={getTabStyle(activeTab === 'dashboard')}>
				📊 Dashboard
			</button>
			<button 
				className={`tab-btn ${activeTab === 'entry' ? 'active' : ''}`}
				onClick={() => setActiveTab('entry')}
				style={getTabStyle(activeTab === 'entry')}>
				✏️ Dodaj Transakcję
			</button>
			<button 
				className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
				onClick={() => setActiveTab('stats')}
				style={getTabStyle(activeTab === 'stats')}>
				📈 Statystyki
			</button>
			<button 
				className={`tab-btn ${activeTab === 'ai-reports' ? 'active' : ''}`}
				onClick={() => setActiveTab('ai-reports')}
				style={getTabStyle(activeTab === 'ai-reports')}>
				🤖 Raporty AI
			</button>
		</nav>

		{/* Zawartość zakładek */}
		{activeTab === 'dashboard' && (
			<StatisticsDashboard {...dashboardProps} />
		)}

		{activeTab === 'entry' && (
			<DataEntryForm {...entryProps} />
		)}

		{activeTab === 'stats' && (
			<ShoppingStats transactions={transactions} />
		)}

		{activeTab === 'ai-reports' && (
			<div className="ai-reports-page">
				<h2>🤖 Raporty AI dla Gabi & Norf</h2>
				<p>Generuj inteligentne analizy waszych wspólnych finansów</p>
				<AIReportModal
					isVisible={true} // Zawsze widoczny na tej zakładce
					onClose={() => setActiveTab('dashboard')} // Wróć do dashboard
				/>
			</div>
		)}
	</div>
)

// Funkcja stylowania zakładek
function getTabStyle(isActive) {
	return {
		padding: '10px 20px',
		border: 'none',
		background: isActive ? '#007bff' : 'transparent',
		color: isActive ? 'white' : '#666',
		cursor: 'pointer',
		borderBottom: isActive ? '2px solid #007bff' : '2px solid transparent',
		fontSize: '14px',
		fontWeight: isActive ? '600' : '400',
		transition: 'all 0.2s'
	}
}
```

## Integracja z istniejącymi stylami CSS

Dodaj do `App.css`:

```css
/* ===== AI REPORT BUTTON ===== */
.ai-report-button {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: white;
	border: none;
	padding: 12px 24px;
	border-radius: 8px;
	cursor: pointer;
	font-size: 14px;
	font-weight: 600;
	box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
	transition: all 0.2s ease;
	display: inline-flex;
	align-items: center;
	gap: 8px;
}

.ai-report-button:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.ai-report-button:active {
	transform: translateY(0);
	box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

/* ===== MAIN NAVIGATION ===== */
.main-navigation {
	display: flex;
	gap: 12px;
	margin-bottom: 20px;
	justify-content: center;
	flex-wrap: wrap;
}

/* ===== AI REPORTS SECTION ===== */
.ai-reports-section {
	background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
	padding: 20px;
	border-radius: 12px;
	margin: 20px 0;
	text-align: center;
	border: 1px solid #dee2e6;
}

.ai-reports-section h3 {
	margin: 0 0 12px 0;
	color: #333;
	font-size: 1.2em;
}

.ai-reports-section p {
	margin: 0 0 16px 0;
	color: #666;
	line-height: 1.5;
}

/* ===== TABS NAVIGATION ===== */
.main-tabs {
	display: flex;
	gap: 4px;
	margin-bottom: 20px;
	border-bottom: 2px solid #e9ecef;
	overflow-x: auto;
}

.tab-btn {
	padding: 10px 20px;
	border: none;
	background: transparent;
	cursor: pointer;
	border-bottom: 2px solid transparent;
	font-size: 14px;
	white-space: nowrap;
	transition: all 0.2s;
}

.tab-btn.active {
	background: #007bff;
	color: white;
	border-bottom-color: #007bff;
	font-weight: 600;
}

.tab-btn:not(.active) {
	color: #666;
}

.tab-btn:hover:not(.active) {
	background: #f8f9fa;
	color: #495057;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
	.main-navigation {
		flex-direction: column;
		align-items: center;
	}
	
	.ai-report-button {
		width: 100%;
		max-width: 300px;
		justify-content: center;
	}
	
	.main-tabs {
		flex-wrap: wrap;
		justify-content: center;
	}
	
	.tab-btn {
		flex: 1;
		min-width: 120px;
	}
}
```

## Testowanie integracji

### Checklist integracji:
- [ ] Import `AIReportModal` działa bez błędów
- [ ] Przycisk "Raporty AI" jest widoczny
- [ ] Modal otwiera się po kliknięciu
- [ ] Modal zamyka się po kliknięciu X lub "Zamknij"
- [ ] Status OpenAI wyświetla się poprawnie
- [ ] Stylowanie jest spójne z resztą aplikacji
- [ ] Responsywność działa na mobile
- [ ] Nie ma konfliktów z istniejącymi komponentami

### Debug przy problemach:
```jsx
// Dodaj console.log do debugowania
const [showAIModal, setShowAIModal] = useState(false)

console.log('AI Modal state:', showAIModal) // Debug

const handleOpenAI = () => {
	console.log('Opening AI modal') // Debug
	setShowAIModal(true)
}

return (
	// ... JSX
	<button onClick={handleOpenAI}>
		🤖 Raporty AI
	</button>
	
	{showAIModal && (
		<AIReportModal
			isVisible={showAIModal}
			onClose={() => {
				console.log('Closing AI modal') // Debug
				setShowAIModal(false)
			}}
		/>
	)}
)
```