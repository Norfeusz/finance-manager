/**
 * Funkcje pomocnicze dla komponentów transakcji
 */

/**
 * Formatuje datę do wyświetlenia
 * @param {string} dateString - Data w formacie YYYY-MM-DD
 * @returns {string} Sformatowana data DD.MM.YYYY
 */
export function formatDate(dateString) {
	if (!dateString) return '-'

	try {
		// Jeśli data jest już w formacie DD.MM.YYYY, zwróć ją
		if (dateString.includes('.')) {
			return dateString
		}

		// Konwertuj z YYYY-MM-DD na DD.MM.YYYY
		if (dateString.includes('-')) {
			const [year, month, day] = dateString.split('-')
			return `${day}.${month}.${year}`
		}

		// Fallback - spróbuj utworzyć obiekt Date
		const date = new Date(dateString)
		if (isNaN(date.getTime())) {
			return dateString // Zwróć oryginalną wartość jeśli nie można sparsować
		}

		const day = String(date.getDate()).padStart(2, '0')
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const year = date.getFullYear()
		return `${day}.${month}.${year}`
	} catch (error) {
		console.error('Błąd formatowania daty:', error)
		return dateString || '-'
	}
}

/**
 * Zwraca wyświetlaną nazwę konta
 * @param {string} account - Nazwa konta z bazy danych
 * @returns {string} Nazwa do wyświetlenia
 */
export function getAccountDisplayName(account) {
	const accountMapping = {
		Rachunki: 'Rachunki',
		KWNR: 'KWNR',
		Wspólne: 'Wspólne',
		wspolne: 'Wspólne',
		gotowka: 'Gotówka',
		Gotowka: 'Gotówka',
		gotówka: 'Gotówka',
		oszczednosciowe: 'Oszczędnościowe',
		inwestycje: 'Inwestycje',
		euro: 'Euro',
		dlugi: 'Długi',
		długi: 'Długi',
	}

	return accountMapping[account] || account || '-'
}

/**
 * Zwraca wyświetlaną nazwę kategorii
 * @param {string} category - Nazwa kategorii z bazy danych
 * @returns {string} Nazwa do wyświetlenia
 */
export function getCategoryDisplayName(category) {
	const categoryMapping = {
		zakupy_codzienne: 'Zakupy codzienne',
		'zakupy codzienne': 'Zakupy codzienne',
		auta: 'Auta',
		dom: 'Dom',
		'wyjścia i szama do domu': 'Wyjścia i szama',
		'wyjscia i szama do domu': 'Wyjścia i szama',
		pies: 'Pies',
		prezenty: 'Prezenty',
		rachunki: 'Rachunki',
		inne: 'Inne',
		medyczne: 'Medyczne',
		transport: 'Transport',
		rozrywka: 'Rozrywka',
		'Wydatek KWNR': 'Wydatek KWNR',
		wyjazdy: 'Wyjazdy',
	}

	return categoryMapping[category] || category || '-'
}
