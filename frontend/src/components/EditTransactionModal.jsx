import { useState } from 'react'
import Modal from './Modal'

function EditTransactionModal({ isOpen, onClose, transaction, onSave, isTransfer = false }) {
	const [formData, setFormData] = useState({
		date: transaction.date ? new Date(transaction.date).toISOString().slice(0, 10) : '',
		account: transaction.account || transaction.fromAccount || '',
		toAccount: transaction.toAccount || '',
		cost: transaction.cost || transaction.amount || 0,
		description: transaction.description || '',
		extraDescription: transaction.extraDescription || '',
	})

	if (!isOpen) return null

	const handleChange = e => {
		const { name, value } = e.target
		setFormData(prev => ({ ...prev, [name]: value }))
	}

	const handleSubmit = async e => {
		e.preventDefault()

		// Sprawdź saldo konta przed zapisaniem zmian
		try {
			if (isTransfer) {
				// Dla transferów sprawdzamy konto źródłowe
				const checkResponse = await fetch(`http://localhost:3002/api/accounts/check-balance`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						account: formData.account,
						amount: parseFloat(formData.cost),
						excludeTransactionId: transaction.id, // Wykluczamy bieżący transfer z obliczeń
					}),
				})

				const checkResult = await checkResponse.json()

				if (checkResponse.status === 200 && checkResult.willBeNegative) {
					const proceedWithNegativeBalance = window.confirm(
						`Po dokonaniu transferu, saldo konta "${
							formData.account
						}" spadnie poniżej zera (${checkResult.projectedBalance.toFixed(
							2
						)} zł). Czy na pewno chcesz zaakceptować ten transfer?`
					)

					if (!proceedWithNegativeBalance) {
						return
					}
				}
			} else if (parseFloat(formData.cost) > 0) {
				// Dla wydatków sprawdzamy saldo konta
				const checkResponse = await fetch(`http://localhost:3002/api/accounts/check-balance`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						account: formData.account,
						amount: parseFloat(formData.cost),
						excludeTransactionId: transaction.id, // Wykluczamy bieżącą transakcję z obliczeń
					}),
				})

				const checkResult = await checkResponse.json()

				if (checkResponse.status === 200 && checkResult.willBeNegative) {
					const proceedWithNegativeBalance = window.confirm(
						`Po dokonaniu wydatku, saldo konta "${
							formData.account
						}" spadnie poniżej zera (${checkResult.projectedBalance.toFixed(
							2
						)} zł). Czy na pewno chcesz zaakceptować ten wydatek?`
					)

					if (!proceedWithNegativeBalance) {
						return
					}
				}
			}
		} catch (error) {
			console.error('Błąd podczas sprawdzania salda konta:', error)
			// Kontynuujemy mimo błędu sprawdzania, aby nie blokować funkcjonalności
		}

		// Dla transferów, aktualizujemy opis jeśli zmieniono konto docelowe
		if (isTransfer) {
			const updatedFormData = { ...formData }
			if (transaction.toAccount !== formData.toAccount) {
				updatedFormData.description = `Transfer do: ${formData.toAccount}`
			}
			onSave(updatedFormData)
		} else {
			onSave(formData)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} title='Edytuj transakcję'>
			<form onSubmit={handleSubmit} className='edit-transaction-form'>
				<div className='form-group'>
					<label htmlFor='date'>Data:</label>
					<input type='date' id='date' name='date' value={formData.date} onChange={handleChange} required />
				</div>

				{isTransfer ? (
					<>
						<div className='form-group'>
							<label htmlFor='account'>Z konta:</label>
							<input
								type='text'
								id='account'
								name='account'
								value={formData.account}
								onChange={handleChange}
								required
							/>
						</div>
						<div className='form-group'>
							<label htmlFor='toAccount'>Na konto:</label>
							<input
								type='text'
								id='toAccount'
								name='toAccount'
								value={formData.toAccount}
								onChange={handleChange}
								required
							/>
						</div>
					</>
				) : (
					<div className='form-group'>
						<label htmlFor='account'>Konto:</label>
						<input type='text' id='account' name='account' value={formData.account} onChange={handleChange} required />
					</div>
				)}

				<div className='form-group'>
					<label htmlFor='cost'>{isTransfer ? 'Kwota:' : 'Koszt:'}</label>
					<input
						type='number'
						step='0.01'
						id='cost'
						name='cost'
						value={formData.cost}
						onChange={handleChange}
						required
					/>
				</div>

				{!isTransfer && (
					<div className='form-group'>
						<label htmlFor='description'>Opis:</label>
						<input
							type='text'
							id='description'
							name='description'
							value={formData.description}
							onChange={handleChange}
						/>
					</div>
				)}

				<div className='form-group'>
					<label htmlFor='extraDescription'>Notatka:</label>
					<textarea
						id='extraDescription'
						name='extraDescription'
						rows='3'
						value={formData.extraDescription}
						onChange={handleChange}></textarea>
				</div>
				<div className='actions'>
					<button type='button' onClick={onClose}>
						Anuluj
					</button>
					<button type='submit' className='primary'>
						Zapisz zmiany
					</button>
				</div>
			</form>
		</Modal>
	)
}

export default EditTransactionModal
