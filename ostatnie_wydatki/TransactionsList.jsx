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
 */
export default function TransactionsList({ transactions = [], onEdit, onDelete }) {
	if (transactions.length === 0) {
		return <p className="no-transactions">Brak transakcji. Dodaj pierwszą transakcję powyżej.</p>
	}

	return (
		<div className='transactions-list'>
			<div className='transactions-header'>
				<div className='transaction-date'>Data</div>
				<div className='transaction-description'>Opis</div>
				<div className='transaction-type'>Typ</div>
				<div className='transaction-category'>Kategoria</div>
				<div className='transaction-account'>Konto</div>
				<div className='transaction-amount'>Kwota</div>
				<div className='transaction-actions'>Akcje</div>
			</div>
			{transactions.map((transaction, index) => {
				const transactionId = transaction.id || index
				
				return (
					<div
						key={transactionId}
						className={`transaction-item ${
							transaction.type === 'income' 
								? 'transaction-income' 
								: 'transaction-expense'
						}`}>
						
						<div className='transaction-date'>
							{formatDate(transaction.date)}
						</div>
						
						<div className='transaction-description'>
							{transaction.description || '-'}
						</div>
						
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
							{transaction.category 
								? getCategoryDisplayName(transaction.category) 
								: '-'
							}
						</div>
						
						<div className='transaction-account'>
							{getAccountDisplayName(transaction.account)}
						</div>
						
						<div className={`transaction-amount ${
							transaction.type === 'income' 
								? 'balance-positive' 
								: 'balance-negative'
						}`}>
							{transaction.type === 'income' ? '+' : '-'}
							{Math.abs(parseFloat(transaction.amount?.toString() || '0') || 0).toFixed(2)}
							{transaction.account === 'euro' ? ' EUR' : ' PLN'}
						</div>
						
						<div className='transaction-actions'>
							{transaction.id && (
								<>
									<button 
										className='edit-btn' 
										onClick={() => onEdit(transaction.id)} 
										title='Edytuj transakcję'>
										✏️
									</button>
									<button 
										className='delete-btn' 
										onClick={() => onDelete(transaction.id)} 
										title='Usuń transakcję'>
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