import React, { useState } from 'react'
import TransactionsList from './TransactionsList'
import './RecentTransactions.css'

/**
 * @typedef {Object} Transaction
 * @property {number} [id] - ID transakcji
 * @property {number} amount - Kwota transakcji
 * @property {string} description - Opis transakcji
 * @property {string} account - Konto transakcji
 * @property {'income'|'expense'|'transfer'|'debt'} type - Typ transakcji
 * @property {string} [category] - Kategoria transakcji
 * @property {string} date - Data w formacie YYYY-MM-DD
 */

/**
 * Komponent wyświetlający ostatnie transakcje z filtrami i paginacją
 * @param {Object} props
 * @param {Transaction[]} props.transactions - Lista wszystkich transakcji
 * @param {Function} props.onEdit - Funkcja edycji transakcji (id) => void
 * @param {Function} props.onDelete - Funkcja usuwania transakcji (id) => void
 */
export default function RecentTransactions({ transactions = [], onEdit, onDelete }) {
	console.log('RecentTransactions otrzymał:', transactions.length, 'transakcji')

	// Stan dla filtrów
	const [transactionFilter, setTransactionFilter] = useState('all')
	const [dateRange, setDateRange] = useState('all')
	const [customDateFrom, setCustomDateFrom] = useState('')
	const [customDateTo, setCustomDateTo] = useState('')
	const [searchQuery, setSearchQuery] = useState('')

	// Stan dla paginacji
	const [visibleTransactionsCount, setVisibleTransactionsCount] = useState(10)
	const [itemsPerPage, setItemsPerPage] = useState(10)

	/**
	 * Funkcja filtrowania transakcji
	 */
	const getFilteredTransactions = () => {
		let filtered = transactions

		// Filtruj po typie
		if (transactionFilter !== 'all') {
			filtered = filtered.filter(t => t.type === transactionFilter)
		}

		// Filtruj po opisie (wyszukiwarka)
		if (searchQuery.trim()) {
			filtered = filtered.filter(
				t => t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase().trim())
			)
		}

		// Filtruj po zakresie dat
		if (dateRange !== 'all') {
			const now = new Date()
			let fromDate = null
			let toDate = null

			switch (dateRange) {
				case 'current-month':
					fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
					toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
					break
				case 'last-3-months':
					fromDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)
					toDate = now
					break
				case 'last-6-months':
					fromDate = new Date(now.getFullYear(), now.getMonth() - 5, 1)
					toDate = now
					break
				case 'last-year':
					fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
					toDate = now
					break
				case 'custom':
					if (customDateFrom) fromDate = new Date(customDateFrom)
					if (customDateTo) toDate = new Date(customDateTo + 'T23:59:59')
					break
			}

			filtered = filtered.filter(t => {
				const transactionDate = new Date(t.date)
				const matchesFrom = !fromDate || transactionDate >= fromDate
				const matchesTo = !toDate || transactionDate <= toDate
				return matchesFrom && matchesTo
			})
		}

		return filtered
	}

	// Funkcje paginacji
	const loadMoreTransactions = () => {
		setVisibleTransactionsCount(prev => prev + itemsPerPage)
	}

	const loadLessTransactions = () => {
		setVisibleTransactionsCount(prev => Math.max(itemsPerPage, prev - itemsPerPage))
	}

	// Reset paginacji przy zmianie filtra
	const resetPagination = () => {
		setVisibleTransactionsCount(itemsPerPage)
	}

	const filteredTransactions = getFilteredTransactions()
	const displayedTransactions = filteredTransactions
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, visibleTransactionsCount)

	return (
		<div className='recent-transactions-container'>
			<h2>Ostatnie Transakcje</h2>

			{/* Filtry transakcji */}
			<div className='transaction-filters'>
				{/* Filtr typu transakcji */}
				<div className='filter-group'>
					<label htmlFor='transaction-filter'>Typ:</label>
					<select
						id='transaction-filter'
						value={transactionFilter}
						onChange={e => {
							setTransactionFilter(e.target.value)
							resetPagination()
						}}
						className='filter-select'>
						<option value='all'>Wszystkie</option>
						<option value='expense'>Tylko wydatki</option>
						<option value='income'>Tylko przychody</option>
						<option value='transfer'>Tylko przepływy</option>
						<option value='debt'>Tylko długi</option>
					</select>
				</div>

				{/* Filtr zakresu dat */}
				<div className='filter-group'>
					<label htmlFor='date-range-filter'>Okres:</label>
					<select
						id='date-range-filter'
						value={dateRange}
						onChange={e => {
							setDateRange(e.target.value)
							resetPagination()
						}}
						className='filter-select'>
						<option value='all'>Wszystkie</option>
						<option value='current-month'>Bieżący miesiąc</option>
						<option value='last-3-months'>Ostatnie 3 miesiące</option>
						<option value='last-6-months'>Ostatnie 6 miesięcy</option>
						<option value='last-year'>Ostatni rok</option>
						<option value='custom'>Własny zakres</option>
					</select>
				</div>

				{/* Własny zakres dat - pokazuje się tylko gdy wybrano 'custom' */}
				{dateRange === 'custom' && (
					<div className='custom-date-range'>
						<div className='date-input-group'>
							<label>Od:</label>
							<input
								type='date'
								value={customDateFrom}
								onChange={e => {
									setCustomDateFrom(e.target.value)
									resetPagination()
								}}
								className='date-input'
							/>
						</div>
						<div className='date-input-group'>
							<label>Do:</label>
							<input
								type='date'
								value={customDateTo}
								onChange={e => {
									setCustomDateTo(e.target.value)
									resetPagination()
								}}
								className='date-input'
							/>
						</div>
					</div>
				)}

				{/* Wyszukiwarka po opisie */}
				<div className='filter-group search-group'>
					<label htmlFor='search-input'>Szukaj:</label>
					<input
						id='search-input'
						type='text'
						placeholder='Wpisz opis transakcji...'
						value={searchQuery}
						onChange={e => {
							setSearchQuery(e.target.value)
							resetPagination()
						}}
						className='search-input'
					/>
					{searchQuery && (
						<button
							onClick={() => {
								setSearchQuery('')
								resetPagination()
							}}
							className='clear-search-btn'
							title='Wyczyść wyszukiwanie'>
							×
						</button>
					)}
				</div>
			</div>

			{/* Lista transakcji */}
			<TransactionsList transactions={displayedTransactions} onEdit={onEdit} onDelete={onDelete} />

			{/* Kontrolki paginacji */}
			<div className='pagination-controls'>
				{visibleTransactionsCount > itemsPerPage && (
					<button className='pagination-btn' onClick={loadLessTransactions}>
						Załaduj poprzednie
					</button>
				)}

				{visibleTransactionsCount < filteredTransactions.length && (
					<button className='pagination-btn' onClick={loadMoreTransactions}>
						Załaduj kolejne
					</button>
				)}

				{/* Kontrola liczby elementów na stronie */}
				<div className='items-per-page-control'>
					<label htmlFor='items-per-page'>Wyświetlaj na stronie:</label>
					<select
						id='items-per-page'
						value={itemsPerPage}
						onChange={e => {
							const newItemsPerPage = parseInt(e.target.value)
							setItemsPerPage(newItemsPerPage)
							setVisibleTransactionsCount(newItemsPerPage)
						}}
						className='items-per-page-select'>
						<option value={10}>10</option>
						<option value={25}>25</option>
						<option value={50}>50</option>
					</select>
				</div>
			</div>

			{/* Informacja o wynikach */}
			<div className='results-info'>
				Wyświetlono {displayedTransactions.length} z {filteredTransactions.length}
				{filteredTransactions.length !== transactions.length && ` (z ${transactions.length} całości)`}
			</div>
		</div>
	)
}
