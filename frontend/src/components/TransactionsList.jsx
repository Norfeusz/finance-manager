import React from 'react'
import { getAccountDisplayName, getCategoryDisplayName, formatDate } from '../utils/transactionUtils'
import './TransactionsList.css'

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
 * Komponent wyświetlający listę transakcji
 * @param {Object} props
 * @param {Transaction[]} props.transactions - Lista transakcji do wyświetlenia
 * @param {Function} props.onEdit - Funkcja edycji transakcji (id) => void
 * @param {Function} props.onDelete - Funkcja usuwania transakcji (id) => void
 * @param {Function} props.onSort - Funkcja sortowania (field) => void
 * @param {string} props.sortBy - Pole według którego sortujemy
 * @param {string} props.sortOrder - Kierunek sortowania ('asc' lub 'desc')
 */
export default function TransactionsList({ transactions = [], onEdit, onDelete, onSort, sortBy, sortOrder }) {
	// Funkcja obsługi kliknięcia w nagłówek
	const handleHeaderClick = field => {
		if (onSort) {
			onSort(field)
		}
	}

	// Funkcja zwracająca ikonę sortowania
	const getSortIcon = field => {
		if (sortBy !== field) {
			return ' ↕️' // Neutralna ikona gdy nie sortujemy po tym polu
		}
		return sortOrder === 'asc' ? ' ↑' : ' ↓'
	}

	if (transactions.length === 0) {
		return <p className='no-transactions'>Brak transakcji. Dodaj pierwszą transakcję powyżej.</p>
	}

	return (
		<div className='transactions-list'>
			<div className='transactions-header'>
				<div
					className='transaction-date sortable-header'
					onClick={() => handleHeaderClick('date')}
					title='Sortuj według daty'>
					Data{getSortIcon('date')}
				</div>
				<div
					className='transaction-description sortable-header'
					onClick={() => handleHeaderClick('description')}
					title='Sortuj według opisu'>
					Opis{getSortIcon('description')}
				</div>
				<div className='transaction-type'>Typ</div>
				<div className='transaction-category'>Kategoria</div>
				<div
					className='transaction-account sortable-header'
					onClick={() => handleHeaderClick('account')}
					title='Sortuj według konta'>
					Konto{getSortIcon('account')}
				</div>
				<div
					className='transaction-amount sortable-header'
					onClick={() => handleHeaderClick('amount')}
					title='Sortuj według kwoty'>
					Kwota{getSortIcon('amount')}
				</div>
				<div className='transaction-actions'>Akcje</div>
			</div>
			{transactions.map((transaction, index) => {
				const transactionId = transaction.id || index

				return (
					<div
						key={transactionId}
						className={`transaction-item ${
							transaction.type === 'income' ? 'transaction-income' : 'transaction-expense'
						}`}>
						<div className='transaction-date'>{formatDate(transaction.date)}</div>

						<div className='transaction-description'>{transaction.description || '-'}</div>

						<div className='transaction-type'>
							{transaction.type === 'income'
								? 'Przychód'
								: transaction.type === 'expense'
								? 'Wydatek'
								: transaction.type === 'transfer'
								? 'Przepływ'
								: 'Dług'}
						</div>

						<div className='transaction-category'>
							{transaction.category ? getCategoryDisplayName(transaction.category) : '-'}
						</div>

						<div className='transaction-account'>{getAccountDisplayName(transaction.account)}</div>

						<div
							className={`transaction-amount ${
								transaction.type === 'income' ? 'balance-positive' : 'balance-negative'
							}`}>
							{transaction.type === 'income' ? '+' : '-'}
							{Math.abs(parseFloat((transaction.cost || transaction.amount)?.toString() || '0') || 0).toFixed(2)}
							{transaction.account === 'euro' ? ' EUR' : ' PLN'}
						</div>

						<div className='transaction-actions'>
							{transaction.id && (
								<>
									<button className='edit-btn' onClick={() => onEdit(transaction.id)} title='Edytuj transakcję'>
										✏️
									</button>
									<button className='delete-btn' onClick={() => onDelete(transaction.id)} title='Usuń transakcję'>
										🗑️
									</button>
								</>
							)}
						</div>
					</div>
				)
			})}
		</div>
	)
}
