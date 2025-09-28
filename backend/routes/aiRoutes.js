const express = require('express')
const router = express.Router()
const { OpenAI } = require('openai')
const fs = require('fs')
const path = require('path')
const pool = require('../db/pool')

// Funkcja do leniwej inicjalizacji OpenAI
function getOpenAI() {
	if (!process.env.OPENAI_API_KEY) {
		throw new Error('OPENAI_API_KEY is not configured')
	}
	return new OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
	})
}

// Funkcja pobierająca dane finansowe z bazy danych
async function getFinancialData() {
	const client = await pool.connect()
	try {
		// Pobierz wszystkie transakcje (ostatnie 200)
		const transactionsResult = await client.query(`
			SELECT 
				t.id, t.type, t.amount, t.description, t.extra_description, t.date, t.month_id,
				a.name AS account_name,
				c.name AS category_name,
				sc.name AS subcategory_name
			FROM transactions t
			LEFT JOIN accounts a ON t.account_id = a.id
			LEFT JOIN categories c ON t.category_id = c.id
			LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
			ORDER BY t.date DESC, t.id DESC
			LIMIT 200
		`)

		// Pobierz stany kont
		const accountsResult = await client.query(`
			SELECT 
				a.name,
				COALESCE(ab.current_balance, 0) as balance
			FROM accounts a
			LEFT JOIN account_balances ab ON a.id = ab.account_id
		`)

		// Pobierz listę miesięcy
		const monthsResult = await client.query(`
			SELECT id, year, month, budget as planned_budget
			FROM months 
			ORDER BY year DESC, month DESC
		`)

		// Pobierz kategorie
		const categoriesResult = await client.query(`
			SELECT DISTINCT name FROM categories WHERE name IS NOT NULL
		`)

		// Oblicz statystyki miesięczne dla ostatnich miesięcy
		const monthlyStatsResult = await client.query(`
			SELECT 
				t.month_id,
				SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as total_income,
				SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as total_expenses,
				COUNT(*) as transaction_count
			FROM transactions t
			WHERE t.month_id IS NOT NULL
			GROUP BY t.month_id
			ORDER BY t.month_id DESC
			LIMIT 12
		`)

		// Oblicz średnie wydatki по kategориях
		const categoryAveragesResult = await client.query(`
			SELECT 
				c.name as category_name,
				AVG(t.amount) as avg_amount,
				SUM(t.amount) as total_amount,
				COUNT(*) as count
			FROM transactions t
			JOIN categories c ON t.category_id = c.id
			WHERE t.type = 'expense'
			GROUP BY c.name
			ORDER BY total_amount DESC
		`)

		return {
			transactions: transactionsResult.rows || [],
			accountBalances: accountsResult.rows || [],
			months: monthsResult.rows || [],
			categories: categoriesResult.rows.map(r => r.name) || [],
			monthlyStats: monthlyStatsResult.rows || [],
			categoryAverages: categoryAveragesResult.rows || [],
		}
	} finally {
		client.release()
	}
}

// GET /api/ai/status - sprawdza status połączenia z OpenAI
router.get('/status', async (req, res) => {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return res.json({
				status: 'not_configured',
				message: 'Klucz API OpenAI nie jest skonfigurowany',
			})
		}

		// Prosta weryfikacja klucza API
		const openai = getOpenAI()
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [{ role: 'user', content: 'Test' }],
			max_tokens: 5,
		})

		res.json({
			status: 'connected',
			message: 'OpenAI API działa poprawnie',
			model: 'gpt-4o-mini',
		})
	} catch (error) {
		res.json({
			status: 'error',
			message: 'Błąd połączenia z OpenAI API',
			error: error.message,
		})
	}
})

// POST /api/ai/generate-report - generuje raport AI (tylko do podglądu)
router.post('/generate-report', async (req, res) => {
	try {
		const { reportType = 'monthly', month, customPrompt } = req.body

		if (!process.env.OPENAI_API_KEY) {
			return res.status(500).json({
				error: 'Klucz API OpenAI nie jest skonfigurowany. Dodaj OPENAI_API_KEY do pliku .env',
			})
		}

		// Pobierz dane finansowe
		const financialData = await getFinancialData()
		console.log('Financial data loaded:', {
			transactions: financialData.transactions.length,
			accounts: financialData.accountBalances.length,
		})

		// Przygotuj prompt w zależności od typu raportu
		let systemPrompt = `Jesteś ekspertem finansowym specjalizującym się w analizie budżetów domowych dla pary Gabi i Norf. 
Analizujesz wspólne finanse pary i tworzysz szczegółowe, praktyczne raporty w języku polskim.
Skup się na praktycznych poradach dla zarządzania wspólnym budżetem.`

		let userPrompt = ''

		if (reportType === 'monthly') {
			const targetMonth = month || new Date().toISOString().slice(0, 7)
			const monthlyTransactions = financialData.transactions.filter(
				t => t.month_id === targetMonth || t.date?.startsWith?.(targetMonth)
			)

			userPrompt = `Przeanalizuj wspólne finanse Gabi i Norf za miesiąc ${targetMonth}.

DANE FINANSOWE:
- Transakcje w tym miesiącu: ${JSON.stringify(monthlyTransactions.slice(0, 50))}
- Stany kont wspólnych: ${JSON.stringify(financialData.accountBalances)}
- Dostępne kategorie wydatków: ${JSON.stringify(financialData.categories)}
- Statystyki miesięczne (ostatnie miesiące): ${JSON.stringify(financialData.monthlyStats)}
- Średnie wydatki по kategориях: ${JSON.stringify(financialData.categoryAverages)}

STWÓRZ RAPORT ZAWIERAJĄCY:
1. **Podsumowanie miesięczne** - przychody, wydatki, bilans dla pary
2. **Analiza wydatków po kategoriach** - które kategorie dominują w budżecie pary
3. **Porównanie z poprzednimi miesiącami** - trendy w wydatkach wspólnych
4. **Rekomendacje dla pary** - jak lepiej zarządzać wspólnym budżetem
5. **Podział kosztów** - analiza czy wydatki są proporcjonalne
6. **Cele oszczędnościowe** - konkretne propozycje dla pary na przyszły miesiąc`
		} else if (reportType === 'yearly') {
			userPrompt = `Przeanalizuj wspólne finanse Gabi i Norf za ostatni rok.

DANE FINANSOWE:
- Wszystkie transakcje: ${JSON.stringify(financialData.transactions.slice(0, 100))}
- Stany kont wspólnych: ${JSON.stringify(financialData.accountBalances)}
- Statystyki wszystkich miesięcy: ${JSON.stringify(financialData.monthlyStats)}
- Kategorie wydatków: ${JSON.stringify(financialData.categories)}
- Średnie wydatki по kategориях: ${JSON.stringify(financialData.categoryAverages)}

STWÓRZ ROCZNY RAPORT ZAWIERAJĄCY:
1. **Podsumowanie roku** - łączne przychody, wydatki, oszczędności pary
2. **Najważniejsze kategorie wydatków** - na co para wydaje najwięcej
3. **Analiza sezonowości** - czy wydatki pary mają wzorce sezonowe
4. **Trendy finansowe** - jak zmieniały się finanse pary w ciągu roku
5. **Plan na przyszły rok** - cele finansowe dla Gabi i Norf
6. **Rekomendacje długoterminowe** - jak para może poprawić swoje finanse`
		} else if (reportType === 'investment') {
			userPrompt = `Przygotuj plan inwestycyjny dla pary Gabi i Norf na podstawie ich finansów.

DANE FINANSOWE:
- Obecne stany kont: ${JSON.stringify(financialData.accountBalances)}
- Ostatnie transakcje: ${JSON.stringify(financialData.transactions.slice(0, 50))}
- Miesięczne statystyki: ${JSON.stringify(financialData.monthlyStats)}
- Wzorce wydatków: ${JSON.stringify(financialData.categoryAverages)}

STWÓRZ PLAN INWESTYCYJNY ZAWIERAJĄCY:
1. **Analiza obecnej sytuacji** - ile para może oszczędzać miesięcznie
2. **Cele inwestycyjne** - krótko, średnio i długoterminowe dla pary
3. **Strategia inwestycyjna** - odpowiednia dla młodej pary
4. **Podział środków** - jak para powinna alokować oszczędności
5. **Instrumenty inwestycyjne** - konkretne rekomendacje dla pary
6. **Plan awaryjny** - budowa poduszki finansowej dla pary`
		} else if (reportType === 'custom' && customPrompt) {
			userPrompt = `${customPrompt}

Kontekst: Analizujesz finanse pary Gabi i Norf. Oto ich dane finansowe:
${JSON.stringify(financialData, null, 2)}`
		}

		// Wywołanie OpenAI API
		const openai = getOpenAI()
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt },
			],
			max_tokens: 2000,
			temperature: 0.7,
		})

		const aiReport = completion.choices[0].message.content

		res.json({
			success: true,
			report: aiReport,
			reportType,
			generatedAt: new Date().toISOString(),
			dataPoints: {
				transactionCount: financialData.transactions.length,
				accountsCount: financialData.accountBalances.length,
				categoriesCount: financialData.categories.length,
				monthsCount: financialData.months.length,
			},
		})
	} catch (error) {
		console.error('Błąd generowania raportu AI:', error)
		res.status(500).json({
			error: 'Błąd generowania raportu AI',
			details: error.message,
		})
	}
})

// POST /api/ai/generate-txt - generuje raport AI jako plik TXT
router.post('/generate-txt', async (req, res) => {
	try {
		const { reportType = 'monthly', month, customPrompt } = req.body

		if (!process.env.OPENAI_API_KEY) {
			return res.status(500).json({
				error: 'Klucz API OpenAI nie jest skonfigurowany. Dodaj OPENAI_API_KEY do pliku .env',
			})
		}

		// Pobierz dane finansowe
		const financialData = await getFinancialData()

		// Przygotuj prompt (ta sama logika co w generate-report)
		let systemPrompt = `Jesteś ekspertem finansowym specjalizującym się w analizie budżetów domowych dla pary Gabi i Norf. 
Analizujesz wspólne finanse pary i tworzysz szczegółowe, praktyczne raporty w języku polskim.
Format odpowiedzi powinien być czytelny jako zwykły tekst.`

		let userPrompt = ''
		let reportFileName = ''

		if (reportType === 'monthly') {
			const targetMonth = month || new Date().toISOString().slice(0, 7)
			reportFileName = `Raport-${targetMonth}-Gabi-Norf.txt`

			const monthlyTransactions = financialData.transactions.filter(
				t => t.month_id === targetMonth || t.date?.startsWith?.(targetMonth)
			)

			userPrompt = `Przeanalizuj wspólne finanse Gabi i Norf za miesiąc ${targetMonth}.

DANE FINANSOWE:
- Transakcje w tym miesiącu: ${JSON.stringify(monthlyTransactions.slice(0, 50))}
- Stany kont wspólnych: ${JSON.stringify(financialData.accountBalances)}
- Dostępne kategorie wydatków: ${JSON.stringify(financialData.categories)}
- Statystyki miesięczne: ${JSON.stringify(financialData.monthlyStats)}
- Średnie wydatki по kategoriях: ${JSON.stringify(financialData.categoryAverages)}

STWÓRZ RAPORT ZAWIERAJĄCY:
1. Podsumowanie miesięczne dla pary
2. Analiza wydatków po kategoriach  
3. Porównanie z poprzednimi miesiącami
4. Rekomendacje dla wspólnego budżetu
5. Cele oszczędnościowe dla pary`
		} else if (reportType === 'yearly') {
			const currentYear = new Date().getFullYear()
			reportFileName = `Raport-Roczny-${currentYear}-Gabi-Norf.txt`

			userPrompt = `Przeanalizuj wspólne finanse Gabi i Norf za rok ${currentYear}.

DANE FINANSOWE:
- Wszystkie transakcje: ${JSON.stringify(financialData.transactions.slice(0, 100))}
- Stany kont: ${JSON.stringify(financialData.accountBalances)}
- Statystyki miesięczne: ${JSON.stringify(financialData.monthlyStats)}
- Kategorie wydatków: ${JSON.stringify(financialData.categories)}

STWÓRZ ROCZNY RAPORT ZAWIERAJĄCY:
1. Podsumowanie roku dla pary
2. Główne kategorie wydatków
3. Trendy finansowe przez rok
4. Plan na następny rok
5. Rekomendacje długoterminowe`
		} else if (reportType === 'investment') {
			reportFileName = `Plan-Inwestycyjny-${new Date().toISOString().slice(0, 7)}-Gabi-Norf.txt`

			userPrompt = `Przygotuj plan inwestycyjny dla pary Gabi i Norf.

DANE FINANSOWE:
- Stany kont: ${JSON.stringify(financialData.accountBalances)}
- Ostatnie transakcje: ${JSON.stringify(financialData.transactions.slice(0, 50))}
- Wzorce wydatków: ${JSON.stringify(financialData.categoryAverages)}

STWÓRZ PLAN INWESTYCYJNY ZAWIERAJĄCY:
1. Analiza możliwości oszczędzania pary
2. Cele inwestycyjne (krótko/długoterminowe)
3. Strategia odpowiednia dla pary
4. Konkretne instrumenty inwestycyjne
5. Plan budowy rezerw finansowych`
		} else if (reportType === 'custom' && customPrompt) {
			reportFileName = `Raport-Niestandardowy-${new Date().toISOString().slice(0, 7)}-Gabi-Norf.txt`
			userPrompt = `${customPrompt}

Kontekst: Analizujesz finanse pary Gabi i Norf:
${JSON.stringify(financialData, null, 2)}`
		}

		// Wywołanie OpenAI API
		const openai = getOpenAI()
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt },
			],
			max_tokens: 3000,
			temperature: 0.7,
		})

		const aiReport = completion.choices[0].message.content

		// Przygotuj treść pliku TXT z nagłówkiem
		const currentDate = new Date().toLocaleDateString('pl-PL')
		const currentTime = new Date().toLocaleTimeString('pl-PL')
		const title = `RAPORT FINANSOWY - GABI & NORF`
		const subtitle =
			reportType === 'monthly'
				? `Miesiąc: ${month || new Date().toISOString().slice(0, 7)}`
				: reportType === 'yearly'
				? `Rok: ${new Date().getFullYear()}`
				: reportType === 'investment'
				? `Plan Inwestycyjny`
				: `Raport Niestandardowy`

		const txtContent = `${title}
${subtitle}

Wygenerowano: ${currentDate} ${currentTime}
System: Manager Finansów - Wspólny budżet Gabi & Norf

${'='.repeat(80)}

${aiReport}

${'='.repeat(80)}
Koniec raportu - Manager Finansów
Wygenerowano automatycznie przez AI: ${new Date().toISOString()}
`

		// Zapisz plik TXT do folderu Raporty
		const reportsDir = path.join(__dirname, '..', '..', 'Raporty')
		if (!fs.existsSync(reportsDir)) {
			fs.mkdirSync(reportsDir, { recursive: true })
		}

		const filePath = path.join(reportsDir, reportFileName)
		fs.writeFileSync(filePath, txtContent, 'utf8')

		res.json({
			success: true,
			message: 'Raport TXT został wygenerowany',
			fileName: reportFileName,
			filePath: filePath,
			reportType,
			generatedAt: new Date().toISOString(),
			dataPoints: {
				transactionCount: financialData.transactions.length,
				accountsCount: financialData.accountBalances.length,
				categoriesCount: financialData.categories.length,
				monthsCount: financialData.months.length,
			},
		})
	} catch (error) {
		console.error('Błąd generowania raportu TXT:', error)
		res.status(500).json({
			error: 'Błąd generowania raportu TXT',
			details: error.message,
		})
	}
})

module.exports = router
