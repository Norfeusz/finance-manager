import React, { useState, useEffect } from 'react'
import './AIReportModal.css'

/**
 * @typedef {'monthly' | 'yearly' | 'investment' | 'custom'} ReportType
 */

/**
 * @typedef {Object} AIStatus
 * @property {'not_configured' | 'connected' | 'error' | 'loading'} status
 * @property {string} message
 */

/**
 * Modal do generowania raportów AI dla projektu Manager Finansów Gabi & Norf
 * @param {Object} props
 * @param {boolean} props.isVisible - Czy modal jest widoczny
 * @param {Function} props.onClose - Funkcja zamykania modala
 */
export default function AIReportModal({ isVisible, onClose }) {
	const [reportType, setReportType] = useState('monthly')
	const [selectedMonth, setSelectedMonth] = useState('')
	const [customPrompt, setCustomPrompt] = useState('')
	const [generatedReport, setGeneratedReport] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isTxtLoading, setIsTxtLoading] = useState(false)
	const [aiStatus, setAiStatus] = useState({ status: 'loading', message: 'Sprawdzanie...' })

	// API Base URL - dostosuj do swojego portu backendu
	const API_BASE = 'http://localhost:3002/api'

	// Sprawdź status AI przy otwieraniu modalki
	useEffect(() => {
		if (isVisible) {
			checkAIStatus()
		}
	}, [isVisible])

	const checkAIStatus = async () => {
		try {
			const response = await fetch(`${API_BASE}/ai/status`)
			const data = await response.json()
			setAiStatus(data)
		} catch (error) {
			setAiStatus({
				status: 'error',
				message: 'Błąd połączenia z serwerem',
			})
		}
	}

	const generateReport = async () => {
		if (reportType === 'custom' && !customPrompt.trim()) {
			alert('Wpisz niestandardowe zapytanie')
			return
		}

		setIsLoading(true)
		setGeneratedReport('')

		try {
			const requestBody = {
				reportType,
				...(reportType === 'monthly' && selectedMonth && { month: selectedMonth }),
				...(reportType === 'custom' && { customPrompt }),
			}

			const response = await fetch(`${API_BASE}/ai/generate-report`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
			})

			const data = await response.json()

			if (data.success) {
				setGeneratedReport(data.report)
			} else {
				setGeneratedReport(`Błąd: ${data.error || 'Nieznany błąd'}`)
			}
		} catch (error) {
			setGeneratedReport(`Błąd połączenia: ${error}`)
		} finally {
			setIsLoading(false)
		}
	}

	const generateTXTReport = async () => {
		if (reportType === 'custom' && !customPrompt.trim()) {
			alert('Wpisz niestandardowe zapytanie')
			return
		}

		setIsTxtLoading(true)

		try {
			const requestBody = {
				reportType,
				...(reportType === 'monthly' && selectedMonth && { month: selectedMonth }),
				...(reportType === 'custom' && { customPrompt }),
			}

			const response = await fetch(`${API_BASE}/ai/generate-txt`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
			})

			const data = await response.json()

			if (data.success) {
				alert(`✅ Raport TXT został zapisany!\n📄 Nazwa: ${data.fileName}\n📁 Lokalizacja: ${data.filePath}`)
			} else {
				alert(`❌ Błąd: ${data.error || 'Nieznany błąd'}`)
			}
		} catch (error) {
			alert(`❌ Błąd połączenia: ${error}`)
		} finally {
			setIsTxtLoading(false)
		}
	}

	if (!isVisible) return null

	return (
		<div className='ai-modal-overlay' onClick={onClose}>
			<div className='ai-modal-content' onClick={e => e.stopPropagation()}>
				<div className='ai-modal-header'>
					<h2>🤖 Raporty AI - Gabi & Norf</h2>
					<button className='ai-modal-close-btn' onClick={onClose}>
						×
					</button>
				</div>

				<div className='ai-modal-body'>
					{/* Status AI */}
					<div className={`ai-status ai-status-${aiStatus.status}`}>
						<strong>Status OpenAI:</strong> {aiStatus.message}
					</div>

					{aiStatus.status === 'connected' && (
						<>
							{/* Typ raportu */}
							<div className='ai-form-group'>
								<label htmlFor='report-type'>Typ raportu:</label>
								<select
									id='report-type'
									value={reportType}
									onChange={e => setReportType(e.target.value)}
									className='ai-form-select'>
									<option value='monthly'>📊 Raport miesięczny dla pary</option>
									<option value='yearly'>📈 Raport roczny wspólnych finansów</option>
									<option value='investment'>💰 Plan inwestycyjny dla pary</option>
									<option value='custom'>✍️ Niestandardowe zapytanie</option>
								</select>
							</div>

							{/* Wybór miesiąca dla raportu miesięcznego */}
							{reportType === 'monthly' && (
								<div className='ai-form-group'>
									<label htmlFor='month-select'>Miesiąc (opcjonalnie):</label>
									<input
										id='month-select'
										type='month'
										value={selectedMonth}
										onChange={e => setSelectedMonth(e.target.value)}
										className='ai-form-input'
									/>
									<small className='ai-form-hint'>Pozostaw puste dla bieżącego miesiąca</small>
								</div>
							)}

							{/* Niestandardowe zapytanie */}
							{reportType === 'custom' && (
								<div className='ai-form-group'>
									<label htmlFor='custom-prompt'>Twoje zapytanie dla AI:</label>
									<textarea
										id='custom-prompt'
										value={customPrompt}
										onChange={e => setCustomPrompt(e.target.value)}
										placeholder='Np. Przeanalizuj nasze wspólne wydatki na jedzenie i zaproponuj jak możemy oszczędzać jako para...'
										className='ai-form-textarea'
										rows={4}
									/>
								</div>
							)}

							{/* Przyciski generowania */}
							<div className='ai-buttons-container'>
								<button
									onClick={generateReport}
									disabled={isLoading || isTxtLoading}
									className='ai-btn ai-btn-primary'>
									{isLoading ? '🔄 Generuję raport...' : '🚀 Wygeneruj raport'}
								</button>
								
								<button
									onClick={generateTXTReport}
									disabled={isLoading || isTxtLoading}
									className='ai-btn ai-btn-success'>
									{isTxtLoading ? '🔄 Zapisuję TXT...' : '📝 Pobierz jako TXT'}
								</button>
							</div>

							{/* Wygenerowany raport */}
							{generatedReport && (
								<div className='ai-report-result'>
									<h3>📋 Wygenerowany raport</h3>
									<div className='ai-report-content'>
										{generatedReport.split('\n').map((line, index) => (
											<p key={index} className={line.startsWith('#') ? 'report-heading' : ''}>
												{line}
											</p>
										))}
									</div>
									<div className='ai-report-actions'>
										<button
											onClick={() => navigator.clipboard.writeText(generatedReport)}
											className='ai-btn ai-btn-secondary'>
											📋 Skopiuj raport
										</button>
									</div>
								</div>
							)}
						</>
					)}

					{aiStatus.status === 'not_configured' && (
						<div className='ai-setup-instructions'>
							<h3>⚙️ Konfiguracja OpenAI</h3>
							<p>Aby używać raportów AI, musisz skonfigurować klucz API OpenAI:</p>
							<ol>
								<li>
									Uzyskaj klucz API z{' '}
									<a 
										href='https://platform.openai.com/api-keys' 
										target='_blank' 
										rel='noopener noreferrer'
										className='ai-link'>
										OpenAI Platform
									</a>
								</li>
								<li>
									Dodaj do pliku <code className='ai-code'>backend/.env</code>:
								</li>
								<li>
									<code className='ai-code'>OPENAI_API_KEY=twój_klucz_tutaj</code>
								</li>
								<li>Zrestartuj backend serwer</li>
							</ol>
							<div className='ai-info-box'>
								<strong>💡 Wskazówka:</strong> Raporty AI analizują wspólne finanse Gabi i Norf, 
								dając praktyczne porady dla zarządzania budżetem jako para.
							</div>
						</div>
					)}

					{aiStatus.status === 'error' && (
						<div className='ai-error-message'>
							<h3>❌ Błąd połączenia</h3>
							<p>{aiStatus.message}</p>
							<button onClick={checkAIStatus} className='ai-btn ai-btn-secondary'>
								🔄 Sprawdź ponownie
							</button>
						</div>
					)}
				</div>

				<div className='ai-modal-footer'>
					<button onClick={onClose} className='ai-btn ai-btn-secondary'>
						Zamknij
					</button>
				</div>
			</div>
		</div>
	)
}