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

        // Mappings zgodne z getShoppingStats
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
        const subcategoryMapping = {
            'Podstawowe': 'jedzenie',
            'Przekąski': 'słodycze',
            'Napoje': 'alkohol',
            'Chemia': 'chemia',
            'Higiena': 'higiena',
            'Leki': 'apteka'
        };

        const client = await pool.connect();
        try {
            // Wyznacz rok/miesiąc docelowy
            const [yy, mm] = monthId.split('-').map(Number);
            const monthKey = (y, m) => `${y}-${String(m).padStart(2,'0')}`;

            // 1) Spróbuj policzyć ze źródła archived_statistics (miesiące archiwalne traktujemy jako zamknięte)
            const archRows = await client.query(
                `SELECT year, month, category, subcategory, amount::float AS amount
                 FROM archived_statistics
                 WHERE (year < $1) OR (year = $1 AND month < $2)
                 ORDER BY year, month`,
                [yy, mm]
            );

            const normalize = (s) => (s || '').toString().trim();
            const toUiCategory = (dbCat) => {
                const name = normalize(dbCat);
                if (categoryMapping[name]) return categoryMapping[name];
                return name.toLowerCase();
            };
            const toUiSubcategory = (dbSub) => {
                const name = normalize(dbSub);
                if (!name) return '';
                // Mapuj znane podkategorie; w archiwum często są już w formacie docelowym (małe litery)
                const map = {
                    'Jedzenie':'jedzenie','Słodycze':'słodycze','Chemia':'chemia','Higiena':'higiena','Leki':'apteka','Napoje':'alkohol','Podstawowe':'jedzenie',
                };
                return (map[name] || name).toLowerCase();
            };

            const monthKeySetPerCategory = new Map(); // key -> Set(month_id) dla zliczania count
            const sumsPerCategory = new Map(); // key -> sum

            if (archRows.rows.length) {
                // Zbuduj miesięczne rekordy dla kluczy
                const perMonthPerKey = new Map(); // month_id -> Map(key -> amount)
                archRows.rows.forEach(r => {
                    const mId = monthKey(r.year, r.month);
                    const uiCat = toUiCategory(r.category);
                    const uiSub = toUiSubcategory(r.subcategory);
                    const amount = Number(r.amount) || 0;
                    // Główna kategoria
                    const keys = [];
                    if (uiCat) keys.push(uiCat.toLowerCase());
                    // Podkategoria tylko dla Zakupy codzienne (liczona niezależnie)
                    if (uiCat.toLowerCase() === 'zakupy codzienne' && uiSub) keys.push(uiSub.toLowerCase());
                    if (!keys.length) return;
                    if (!perMonthPerKey.has(mId)) perMonthPerKey.set(mId, new Map());
                    const map = perMonthPerKey.get(mId);
                    keys.forEach(k => {
                        map.set(k, (map.get(k) || 0) + amount);
                    });
                });

                // Agreguj do sum i count (liczymy tylko miesiące, gdzie klucz wystąpił — nawet jeśli kwota = 0)
                for (const [mId, keyMap] of perMonthPerKey.entries()) {
                    for (const [k, v] of keyMap.entries()) {
                        sumsPerCategory.set(k, (sumsPerCategory.get(k) || 0) + (Number(v) || 0));
                        if (!monthKeySetPerCategory.has(k)) monthKeySetPerCategory.set(k, new Set());
                        monthKeySetPerCategory.get(k).add(mId);
                    }
                }
            }

            // Jeśli nie mamy żadnych danych archiwalnych (np. brak archiwum), fallback do transakcji (miesiące < wybrany)
            if (sumsPerCategory.size === 0) {
                // Pobierz listę miesięcy wcześniejszych niż wybrany (bez warunku is_closed — zgodnie z informacją o braku flagi w archiwum)
                const monthsRes = await client.query('SELECT id, year, month FROM months WHERE id < $1 ORDER BY id', [monthId]);
                const monthIds = monthsRes.rows.map(r => r.id);
                if (monthIds.length) {
                    const catRows = await client.query(`
                        SELECT t.month_id, c.name AS category_name, SUM(t.amount)::float AS total
                        FROM transactions t
                        JOIN categories c ON t.category_id = c.id
                        WHERE t.type = 'expense' AND t.month_id = ANY($1)
                        GROUP BY t.month_id, c.name
                    `, [monthIds]);
                    const subRows = await client.query(`
                        SELECT t.month_id, sc.name AS subcategory_name, SUM(t.amount)::float AS total
                        FROM transactions t
                        JOIN categories c ON t.category_id = c.id
                        JOIN subcategories sc ON t.subcategory_id = sc.id
                        WHERE t.type = 'expense' AND t.month_id = ANY($1) AND c.name = 'Zakupy spożywcze'
                        GROUP BY t.month_id, sc.name
                    `, [monthIds]);
                    const perMonthPerKey = new Map();
                    const setKey = (mId, k, val) => {
                        if (!perMonthPerKey.has(mId)) perMonthPerKey.set(mId, new Map());
                        const map = perMonthPerKey.get(mId);
                        map.set(k, (map.get(k) || 0) + val);
                    };
                    catRows.rows.forEach(r => {
                        const key = (toUiCategory(r.category_name) || '').toLowerCase();
                        const val = Number(r.total) || 0;
                        setKey(r.month_id, key, val);
                    });
                    subRows.rows.forEach(r => {
                        const key = (toUiSubcategory(r.subcategory_name) || '').toLowerCase();
                        const val = Number(r.total) || 0;
                        setKey(r.month_id, key, val);
                    });
                    for (const [mId, keyMap] of perMonthPerKey.entries()) {
                        for (const [k, v] of keyMap.entries()) {
                            sumsPerCategory.set(k, (sumsPerCategory.get(k) || 0) + (Number(v) || 0));
                            if (!monthKeySetPerCategory.has(k)) monthKeySetPerCategory.set(k, new Set());
                            monthKeySetPerCategory.get(k).add(mId);
                        }
                    }
                }
            }

            const averages = {};
            for (const [key, sum] of sumsPerCategory.entries()) {
                const cnt = (monthKeySetPerCategory.get(key) || new Set()).size;
                if (cnt > 0) averages[key] = +(sum / cnt).toFixed(2);
            }

            res.json({ month_id: monthId, averages });
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Błąd liczenia średnich kategorii:', e);
        res.status(500).json({ message: 'Błąd serwera', error: e.message });
    }
};

module.exports = { getShoppingStats, getCategoryAverages };