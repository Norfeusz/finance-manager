import React, { useState, useEffect, useCallback } from 'react'
import './ExpenseStatisticsModal.scss'

interface ExpenseStatistic {
	id: number
	month_id: number
	category_section: string
	amount: number
	is_open: boolean
	last_edited: string
}

interface Props {
	isVisible: boolean
	onClose: () => void
	activeMonth: number | null
	monthName: string
	onMonthChange: (direction: 'prev' | 'next') => void
}

const API_URL = process.env.REACT_APP_API_URL

// Domyślne kategorie główne i podkategorie zgodne z systemem drugiego projektu
const defaultMainCategories = ['auta', 'dom', 'wyjścia i szama do domu', 'pies', 'prezenty', 'wyjazdy']
const defaultSubCategories = ['jedzenie', 'słodycze', 'chemia', 'apteka', 'alkohol', 'higiena', 'kwiatki', 'zakupy']

// Funkcja mapowania nazw kategorii na przyjazne nazwy
const getCategoryDisplayName = (category: string): string => {
	const displayNames: { [key: string]: string } = {
		// Kategorie główne
		auta: 'Auta',
		dom: 'Dom',
		'wyjścia i szama do domu': 'Wyjścia i szama do domu',
		pies: 'Pies',
		prezenty: 'Prezenty',
		wyjazdy: 'Wyjazdy',
		// Podkategorie zakupów codziennych
		jedzenie: 'Jedzenie',
		słodycze: 'Słodycze',
		chemia: 'Chemia',
		apteka: 'Apteka',
		alkohol: 'Alkohol',
		higiena: 'Higiena',
		kwiatki: 'Kwiatki',
		zakupy: 'Zakupy',
		// Specjalne kategorie
		'ZC': 'Zakupy Codzienne (suma)',
		rachunki: 'Rachunki',
		subkonta: 'Subkonta'
	}
	return displayNames[category] || category
}

const ExpenseStatisticsModal: React.FC<Props> = ({
	isVisible,
	onClose,
	activeMonth,
	monthName,
	onMonthChange,
}) => {
	const [statistics, setStatistics] = useState<ExpenseStatistic[]>([])
	const [editingId, setEditingId] = useState<number | null>(null)
	const [editAmount, setEditAmount] = useState<string>('')
	const [newCategoryName, setNewCategoryName] = useState<string>('')
	const [showAddCategory, setShowAddCategory] = useState<boolean>(false)
	const [categoryType, setCategoryType] = useState<'main' | 'sub'>('main')

	// Pobierz statystyki dla aktywnego miesiąca
	const fetchStatistics = useCallback(async () => {
		if (!activeMonth) return

		try {
			const response = await fetch(`${API_URL}/expense-statistics/${activeMonth}`)
			const data = await response.json()
			setStatistics(data)
		} catch (error) {
			console.error('Błąd pobierania statystyk:', error)
			setStatistics([])
		}
	}, [activeMonth])

	// Zainicjalizuj statystyki dla nowego miesiąca
	const initializeStatistics = async () => {
		if (!activeMonth) return

		try {
			// Najpierw zainicjalizuj przez API
			const response = await fetch(`${API_URL}/expense-statistics/initialize`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ monthId: activeMonth }),
			})

			if (response.ok) {
				// Następnie dodaj kategorie główne jeśli nie istnieją
				for (const category of defaultMainCategories) {
					await ensureCategoryExists(category)
				}
				
				// Dodaj podkategorie zakupów codziennych
				for (const subcategory of defaultSubCategories) {
					await ensureCategoryExists(subcategory)
				}
				
				await fetchStatistics()
			} else {
				console.error('Błąd podczas inicjalizacji statystyk')
			}
		} catch (error) {
			console.error('Błąd inicjalizacji statystyk:', error)
		}
	}
	
	// Sprawdź czy kategoria istnieje, jeśli nie - dodaj ją
	const ensureCategoryExists = async (categoryName: string) => {
		try {
			const response = await fetch(`${API_URL}/expense-statistics`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					monthId: activeMonth,
					categorySection: categoryName,
					amount: 0,
				}),
			})
			// Nie sprawdzamy response.ok - może kategoria już istnieje
		} catch (error) {
			console.error(`Błąd dodawania kategorii ${categoryName}:`, error)
		}
	}

	// Aktualizuj kwotę statystyki
	const updateStatistic = async (id: number, amount: number) => {
		try {
			const statistic = statistics.find(s => s.id === id)
			if (!statistic) return

			const response = await fetch(`${API_URL}/expense-statistics`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					monthId: statistic.month_id,
					categorySection: statistic.category_section,
					amount: amount,
				}),
			})

			if (response.ok) {
				await fetchStatistics()
				setEditingId(null)
				setEditAmount('')
			} else {
				console.error('Błąd podczas aktualizacji statystyki')
			}
		} catch (error) {
			console.error('Błąd aktualizacji statystyki:', error)
		}
	}

	// Zmień status otwarcia/zamknięcia
	const toggleStatus = async (id: number, isOpen: boolean) => {
		try {
			const response = await fetch(`${API_URL}/expense-statistics/${id}/status`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ isOpen: !isOpen }),
			})

			if (response.ok) {
				await fetchStatistics()
			} else {
				console.error('Błąd podczas zmiany statusu')
			}
		} catch (error) {
			console.error('Błąd zmiany statusu:', error)
		}
	}

	// Dodaj nową kategorię
	const addCategory = async () => {
		if (!newCategoryName.trim() || !activeMonth) return

		try {
			const response = await fetch(`${API_URL}/expense-statistics`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					monthId: activeMonth,
					categorySection: newCategoryName.trim(),
					amount: 0,
				}),
			})

			if (response.ok) {
				await fetchStatistics()
				setNewCategoryName('')
				setShowAddCategory(false)
			} else {
				console.error('Błąd podczas dodawania kategorii')
			}
		} catch (error) {
			console.error('Błąd dodawania kategorii:', error)
		}
	}

	// Usuń statystykę
	const deleteStatistic = async (id: number) => {
		if (!window.confirm('Czy na pewno chcesz usunąć tę statystykę?')) return

		try {
			const response = await fetch(`${API_URL}/expense-statistics/${id}`, {
				method: 'DELETE',
			})

			if (response.ok) {
				await fetchStatistics()
			} else {
				console.error('Błąd podczas usuwania statystyki')
			}
		} catch (error) {
			console.error('Błąd usuwania statystyki:', error)
		}
	}

	// Rozpocznij edycję
	const startEdit = (id: number, currentAmount: number) => {
		setEditingId(id)
		setEditAmount(currentAmount.toString())
	}

	// Anuluj edycję
	const cancelEdit = () => {
		setEditingId(null)
		setEditAmount('')
	}

	// Zapisz edycję
	const saveEdit = () => {
		if (editingId && editAmount) {
			const amount = parseFloat(editAmount)
			if (!isNaN(amount)) {
				updateStatistic(editingId, amount)
			}
		}
	}

	// Przełącz wszystkie statusy
	const toggleAllStatuses = async (isOpen: boolean) => {
		if (!activeMonth) return

		try {
			const response = await fetch(`${API_URL}/expense-statistics/month/${activeMonth}/toggle-all`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ isOpen }),
			})

			if (response.ok) {
				await fetchStatistics()
			} else {
				console.error('Błąd podczas przełączania wszystkich statusów')
			}
		} catch (error) {
			console.error('Błąd przełączania wszystkich statusów:', error)
		}
	}

	// Wczytaj dane po otwarciu lub zmianie miesiąca
	useEffect(() => {
		if (isVisible && activeMonth) {
			fetchStatistics()
		}
	}, [isVisible, activeMonth, fetchStatistics])

	if (!isVisible) return null

	const totalAmount = statistics.reduce((sum, stat) => sum + (stat.is_open ? stat.amount : 0), 0)
	const openCount = statistics.filter(stat => stat.is_open).length
	const closedCount = statistics.filter(stat => !stat.is_open).length

	return (
		<div className='expense-statistics-modal-backdrop' onClick={onClose}>
			<div className='expense-statistics-modal' onClick={(e) => e.stopPropagation()}>
				{/* Nagłówek z nawigacją */}
				<div className='expense-statistics-header'>
					<div className='month-navigation'>
						<button
							type='button'
							onClick={() => onMonthChange('prev')}
							className='nav-button'
							aria-label='Poprzedni miesiąc'
						>
							←
						</button>
						<h2>{monthName} - Statystyki Wydatków</h2>
						<button
							type='button'
							onClick={() => onMonthChange('next')}
							className='nav-button'
							aria-label='Następny miesiąc'
						>
							→
						</button>
					</div>
					<button className='close-button' onClick={onClose} aria-label='Zamknij'>
						×
					</button>
				</div>

				{/* Podsumowanie */}
				<div className='statistics-summary'>
					<div className='summary-item'>
						<span className='label'>Suma otwartych:</span>
						<span className='amount'>{totalAmount.toFixed(2)} zł</span>
					</div>
					<div className='summary-item'>
						<span className='label'>Otwarte kategorie:</span>
						<span className='count'>{openCount}</span>
					</div>
					<div className='summary-item'>
						<span className='label'>Zamknięte kategorie:</span>
						<span className='count'>{closedCount}</span>
					</div>
				</div>

				{/* Akcje globalne */}
				<div className='global-actions'>
					<button
						onClick={initializeStatistics}
						className='init-button'
						title='Zainicjalizuj statystyki na podstawie transakcji'
					>
						Inicjalizuj Statystyki
					</button>
					<button
						onClick={() => toggleAllStatuses(true)}
						className='toggle-button open'
						title='Otwórz wszystkie kategorie'
					>
						Otwórz Wszystkie
					</button>
					<button
						onClick={() => toggleAllStatuses(false)}
						className='toggle-button close'
						title='Zamknij wszystkie kategorie'
					>
						Zamknij Wszystkie
					</button>
					<button
						onClick={() => setShowAddCategory(true)}
						className='add-button'
						title='Dodaj nową kategorię'
					>
						+ Dodaj Kategorię
					</button>
				</div>

				{/* Dodawanie nowej kategorii */}
				{showAddCategory && (
					<div className='add-category-form'>
						<div className='category-type-selector'>
							<label>
								<input
									type='radio'
									value='main'
									checked={categoryType === 'main'}
									onChange={(e) => setCategoryType(e.target.value as 'main' | 'sub')}
								/>
								Kategoria główna
							</label>
							<label>
								<input
									type='radio'
									value='sub'
									checked={categoryType === 'sub'}
									onChange={(e) => setCategoryType(e.target.value as 'main' | 'sub')}
								/>
								Podkategoria (zakupy codzienne)
							</label>
						</div>
						<input
							type='text'
							placeholder={categoryType === 'main' ? 'Nazwa kategorii głównej' : 'Nazwa podkategorii zakupów codziennych'}
							value={newCategoryName}
							onChange={(e) => setNewCategoryName(e.target.value)}
							onKeyPress={(e) => e.key === 'Enter' && addCategory()}
							autoFocus
						/>
						<button onClick={addCategory}>Dodaj</button>
						<button onClick={() => {
							setShowAddCategory(false)
							setNewCategoryName('')
							setCategoryType('main')
						}}>Anuluj</button>
					</div>
				)}

				{/* Lista statystyk */}
				<div className='statistics-list'>
					{statistics.length === 0 ? (
						<div className='empty-state'>
							<p>Brak statystyk dla tego miesiąca</p>
							<p>Użyj przycisku "Inicjalizuj Statystyki" aby utworzyć je na podstawie transakcji</p>
						</div>
					) : (
						<>
							{/* Kategorie główne */}
							<div className='category-group'>
								<h4 className='category-group-title'>Kategorie Główne</h4>
								{statistics
									.filter(stat => defaultMainCategories.includes(stat.category_section) || 
										(!defaultMainCategories.includes(stat.category_section) && 
										 !defaultSubCategories.includes(stat.category_section) &&
										 stat.category_section !== 'ZC'))
									.map((stat) => (
										<div
											key={stat.id}
											className={`statistic-item ${stat.is_open ? 'open' : 'closed'}`}
										>
											<div className='category-name'>
												{getCategoryDisplayName(stat.category_section)}
											</div>
								
								<div className='amount-section'>
									{editingId === stat.id ? (
										<div className='edit-form'>
											<input
												type='number'
												step='0.01'
												value={editAmount}
												onChange={(e) => setEditAmount(e.target.value)}
												onKeyPress={(e) => {
													if (e.key === 'Enter') saveEdit()
													if (e.key === 'Escape') cancelEdit()
												}}
												autoFocus
											/>
											<button onClick={saveEdit} className='save-button'>
												✓
											</button>
											<button onClick={cancelEdit} className='cancel-button'>
												×
											</button>
										</div>
									) : (
										<span
											className='amount'
											onClick={() => startEdit(stat.id, stat.amount)}
											title='Kliknij aby edytować'
										>
											{stat.amount.toFixed(2)} zł
										</span>
									)}
								</div>

								<div className='actions'>
									<button
										onClick={() => toggleStatus(stat.id, stat.is_open)}
										className={`status-button ${stat.is_open ? 'open' : 'closed'}`}
										title={stat.is_open ? 'Zamknij kategorię' : 'Otwórz kategorię'}
									>
										{stat.is_open ? 'Otwarte' : 'Zamknięte'}
									</button>
									<button
										onClick={() => deleteStatistic(stat.id)}
										className='delete-button'
										title='Usuń statystykę'
									>
										🗑️
									</button>
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	)
}

export default ExpenseStatisticsModal