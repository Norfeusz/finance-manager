const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const getShoppingStats = async (req, res) => {
    try {
        // Wczytaj historyczne dane z pliku legacy-stats.json
        const legacyStatsPath = path.join(__dirname, '../legacy-stats.json');
        let legacyData = { totals: {}, counts: {} };
        if (fs.existsSync(legacyStatsPath)) {
            legacyData = JSON.parse(fs.readFileSync(legacyStatsPath, 'utf8'));
        }
        
        const historicalTotals = legacyData.totals;
        const categoryCounts = legacyData.counts;
        
        // Pobierz bieżący miesiąc
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        // Określ poprzedni miesiąc
        let previousMonth = currentMonth - 1;
        let previousYear = currentYear;
        if (previousMonth === 0) {
            previousMonth = 12;
            previousYear -= 1;
        }
        
        // Połącz z bazą danych
        const client = await pool.connect();
        const currentMonthTotals = {};
        const previousMonthTotals = {};
        
        try {
            // Znajdź id bieżącego miesiąca
            const monthResult = await client.query(
                'SELECT id FROM months WHERE year = $1 AND month = $2',
                [currentYear, currentMonth]
            );
            
            if (monthResult.rows.length === 0) {
                // Miesiąc nie istnieje, zwróć puste statystyki dla bieżącego miesiąca
                console.log('Bieżący miesiąc nie istnieje w bazie danych');
            }
            
            const monthId = monthResult.rows.length > 0 ? monthResult.rows[0].id : null;
            
            // Znajdź id poprzedniego miesiąca
            const prevMonthResult = await client.query(
                'SELECT id FROM months WHERE year = $1 AND month = $2',
                [previousYear, previousMonth]
            );
            
            const prevMonthId = prevMonthResult.rows.length > 0 ? prevMonthResult.rows[0].id : null;
            
            // Mapowanie nazw kategorii z bazy danych na nazwy używane w fronendzie
            const categoryMapping = {
                'Zakupy spożywcze': 'zakupy codzienne',
                'Transport': 'auta',
                'Mieszkanie': 'dom',
                'Rozrywka': 'wyjścia i szama do domu',
                'Zwierzęta': 'pies',
                'Prezenty': 'prezenty',
                'Zdrowie': 'apteka',
                'Odzież': 'zakupy',
                'Edukacja': 'zakupy',
                'Elektronika': 'zakupy'
            };
            
            // Funkcja do konwersji nazwy kategorii z bazy danych na nazwę używaną w fronendzie
            const mapCategoryName = (dbCategoryName) => {
                // Jeśli istnieje mapowanie, użyj go
                if (categoryMapping[dbCategoryName]) {
                    return categoryMapping[dbCategoryName];
                }
                // W przeciwnym razie użyj nazwy z bazy danych, ale z małej litery (frontend używa nazw z małej litery)
                return dbCategoryName.toLowerCase();
            };
            
            // Mapowanie nazw podkategorii na nazwy używane w fronendzie
            const subcategoryMapping = {
                'Podstawowe': 'jedzenie',
                'Przekąski': 'słodycze',
                'Napoje': 'alkohol',
                'Chemia': 'chemia',
                'Higiena': 'higiena',
                'Leki': 'apteka'
            };
            
            // Funkcja do pobierania danych dla określonego miesiąca
            async function getMonthlyData(monthId, resultObject) {
                if (!monthId) return;
                
                // Pobierz sumy wydatków dla wszystkich kategorii w danym miesiącu
                const categoryStatsResult = await client.query(`
                    SELECT 
                        c.name AS category_name, 
                        SUM(t.amount) AS total_amount
                    FROM 
                        transactions t
                    JOIN 
                        categories c ON t.category_id = c.id
                    WHERE 
                        t.month_id = $1 
                        AND t.type = 'expense'
                    GROUP BY 
                        c.name
                `, [monthId]);
                
                // Dodaj sumy kategorii do wyniku
                categoryStatsResult.rows.forEach(row => {
                    const categoryKey = mapCategoryName(row.category_name);
                    resultObject[categoryKey] = parseFloat(row.total_amount);
                });
                
                // Pobierz szczegóły dla podkategorii "Zakupy spożywcze"
                const subcategoryStatsResult = await client.query(`
                    SELECT 
                        sc.name AS subcategory_name, 
                        SUM(t.amount) AS total_amount
                    FROM 
                        transactions t
                    JOIN 
                        categories c ON t.category_id = c.id
                    JOIN 
                        subcategories sc ON t.subcategory_id = sc.id
                    WHERE 
                        t.month_id = $1 
                        AND t.type = 'expense'
                        AND c.name = 'Zakupy spożywcze'
                    GROUP BY 
                        sc.name
                `, [monthId]);
                
                // Dodaj sumy podkategorii do wyniku
                subcategoryStatsResult.rows.forEach(row => {
                    const subcategoryKey = subcategoryMapping[row.subcategory_name] || row.subcategory_name.toLowerCase();
                    resultObject[subcategoryKey] = parseFloat(row.total_amount);
                });
            }
            
            // Pobierz dane dla bieżącego miesiąca
            if (monthId) {
                await getMonthlyData(monthId, currentMonthTotals);
            }
            
            // Pobierz dane dla poprzedniego miesiąca
            if (prevMonthId) {
                await getMonthlyData(prevMonthId, previousMonthTotals);
            }
            
        } finally {
            client.release();
        }
        // Oblicz średnie historyczne
        const historicalAverage = {};
        for (const categoryName in historicalTotals) {
            if (categoryCounts[categoryName] > 0) {
                historicalAverage[categoryName] = historicalTotals[categoryName] / categoryCounts[categoryName];
            }
        }
        
        // Zwróć kompletne statystyki
        res.status(200).json({ 
            currentMonth: currentMonthTotals,
            previousMonth: previousMonthTotals,
            historicalAverage 
        });
    } catch (error) {
        console.error('Błąd podczas obliczania statystyk:', error);
        res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message });
    }
};
// Średnie kategorii dla wybranego miesiąca: średnia ze wszystkich zamkniętych miesięcy wcześniejszych niż podany month_id
const getCategoryAverages = async (req, res) => {
    try {
        const monthId = (req.query.month_id || '').toString();
        if (!/^\d{4}-\d{2}$/.test(monthId)) return res.status(400).json({ message: 'Parametr month_id w formacie YYYY-MM wymagany' });

        const client = await pool.connect();
        try {
            console.log(`Obliczanie średnich dla miesiąca: ${monthId}`);
            
            // Pobierz dane z tabeli statistics dla miesięcy z is_open = false (zamkniętych)
            // i wcześniejszych niż wybrany miesiąc
            const statisticsQuery = `
                SELECT category, subcategory, amount 
                FROM statistics 
                WHERE is_open = false AND month_id < $1
                ORDER BY month_id, category, subcategory
            `;
            
            const statsRows = await client.query(statisticsQuery, [monthId]);
            console.log(`Znaleziono ${statsRows.rows.length} rekordów statystyk`);
            
            // Grupuj dane według kategorii/podkategorii
            const categoryData = new Map(); // klucz -> { sum: number, count: number }
            
            statsRows.rows.forEach(row => {
                const category = row.category;
                const subcategory = row.subcategory;
                const amount = parseFloat(row.amount) || 0;
                
                // Klucz dla głównej kategorii
                let mainKey = category;
                
                // Dla podkategorii tworzymy osobny klucz
                if (subcategory) {
                    // Podkategorie mają swoje własne klucze
                    const subKey = subcategory;
                    if (!categoryData.has(subKey)) {
                        categoryData.set(subKey, { sum: 0, count: 0 });
                    }
                    categoryData.get(subKey).sum += amount;
                    categoryData.get(subKey).count += 1;
                }
                
                // Główna kategoria - liczmy zawsze (nawet jeśli ma podkategorie)
                if (!categoryData.has(mainKey)) {
                    categoryData.set(mainKey, { sum: 0, count: 0 });
                }
                categoryData.get(mainKey).sum += amount;
                categoryData.get(mainKey).count += 1;
            });
            
            // Oblicz średnie
            const averages = {};
            for (const [key, data] of categoryData.entries()) {
                if (data.count > 0) {
                    averages[key] = +(data.sum / data.count).toFixed(2);
                }
            }
            
            console.log(`Obliczone średnie:`, averages);
            res.json({ month_id: monthId, averages });
            
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Błąd liczenia średnich kategorii:', e);
        res.status(500).json({ message: 'Błąd serwera', error: e.message });
    }
};


// Funkcja do czyszczenia cache średnich (do użycia gdy zmieniają się statusy miesięcy)
const clearAveragesCache = () => {
	averagesCache.data = null
	averagesCache.timestamp = null
	averagesCache.closedMonthsHash = null
	console.log('Cache średnich został wyczyszczony')
}

// Średnie kategorii z 3 ostatnich miesięcy dla których istnieją dane dla danej kategorii
const getCategoryAveragesLast3Months = async (req, res) => {
	try {
		const monthId = (req.query.month_id || '').toString()
		if (!/^\d{4}-\d{2}$/.test(monthId))
			return res.status(400).json({ message: 'Parametr month_id w formacie YYYY-MM wymagany' })

		const client = await pool.connect()
		try {
			console.log(`=== getCategoryAveragesLast3Months START ===`)
			console.log(`Obliczanie średnich z 3 ostatnich miesięcy dla: ${monthId}`)

			// Pobierz wszystkie dostępne miesiące z zamkniętymi statystykami
			const availableMonthsQuery = `
				SELECT DISTINCT month_id 
				FROM statistics 
				WHERE is_open = false 
				ORDER BY month_id DESC
			`
			const availableMonthsResult = await client.query(availableMonthsQuery)
			const availableMonths = availableMonthsResult.rows.map(row => row.month_id)

			console.log(`Dostępne zamknięte miesiące: [${availableMonths.join(', ')}]`)

			// Pobierz wszystkie dane
			const statisticsQuery = `
				SELECT month_id, category, subcategory, amount 
				FROM statistics 
				WHERE is_open = false
				ORDER BY month_id DESC, category, subcategory
			`
			const statsRows = await client.query(statisticsQuery)
			console.log(`Znaleziono ${statsRows.rows.length} rekordów statystyk`)

			// Grupuj dane według kategorii
			const categoryMonthlyData = new Map()

			statsRows.rows.forEach(row => {
				const category = row.category
				const subcategory = row.subcategory
				const amount = parseFloat(row.amount) || 0
				const monthId = row.month_id

				let mainKey = category

				// Dla podkategorii
				if (subcategory) {
					const subKey = subcategory
					if (!categoryMonthlyData.has(subKey)) {
						categoryMonthlyData.set(subKey, [])
					}
					categoryMonthlyData.get(subKey).push({ month_id: monthId, amount })
				}

				// Główna kategoria
				if (!categoryMonthlyData.has(mainKey)) {
					categoryMonthlyData.set(mainKey, [])
				}
				categoryMonthlyData.get(mainKey).push({ month_id: monthId, amount })
			})

			// Oblicz średnie z 3 ostatnich miesięcy
			const averages = {}
			
			for (const [categoryKey, monthlyData] of categoryMonthlyData.entries()) {
				const sortedData = monthlyData
					.filter(item => item.amount > 0)
					.sort((a, b) => b.month_id.localeCompare(a.month_id))

				if (sortedData.length === 0) continue

				const last3MonthsData = sortedData.slice(0, 3)
				
				if (last3MonthsData.length > 0) {
					const sum = last3MonthsData.reduce((acc, item) => acc + item.amount, 0)
					const average = sum / last3MonthsData.length
					
					averages[categoryKey] = {
						average: +(average).toFixed(2),
						monthsUsed: last3MonthsData.length,
						monthsIncluded: last3MonthsData.map(item => item.month_id),
						amounts: last3MonthsData.map(item => ({ month: item.month_id, amount: item.amount }))
					}
				}
			}

			console.log(`Obliczone średnie z ostatnich 3 miesięcy dla ${Object.keys(averages).length} kategorii`)

			res.json({ 
				month_id: monthId, 
				averages,
				metadata: {
					totalCategories: Object.keys(averages).length,
					availableMonths: availableMonths.length,
					calculationMethod: 'last_3_months_with_data'
				}
			})
		} finally {
			client.release()
		}
	} catch (e) {
		console.error('Błąd liczenia średnich z 3 ostatnich miesięcy:', e)
		res.status(500).json({ message: 'Błąd serwera', error: e.message })
	}
}

module.exports = { getShoppingStats, getCategoryAverages, clearAveragesCache, getCategoryAveragesLast3Months };