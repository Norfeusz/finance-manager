const fs = require('fs');
const path = require('path');
const { getGoogleSheets } = require('../config/googleSheets');
const { CATEGORY_CONFIG } = require('../config/categoryConfig'); // <-- Poprawny import z pliku .js
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const getShoppingStats = async (req, res) => {
    try {
        const legacyStatsPath = path.join(__dirname, '../legacy-stats.json');
        let legacyData = { totals: {}, counts: {} };
        if (fs.existsSync(legacyStatsPath)) {
            legacyData = JSON.parse(fs.readFileSync(legacyStatsPath, 'utf8'));
        }
        
        const historicalTotals = legacyData.totals;
        const categoryCounts = legacyData.counts;
        const googleSheets = await getGoogleSheets();
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        const currentMonthName = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date());
        const currentMonthTotals = {};

        for (const [categoryName, config] of Object.entries(CATEGORY_CONFIG)) {
            if (config.type !== 'expense') continue;
            const range = `'${currentMonthName}'!${config.start}3:${config.end}1000`;
            try {
                const response = await googleSheets.spreadsheets.values.get({ spreadsheetId, range });
                const rows = response.data.values || [];
                let monthCategoryTotal = 0;
                rows.forEach(row => {
                    monthCategoryTotal += parseFloat(String(row[1] || '0').replace(',', '.')) || 0;
                });
                
                if (categoryName === 'zakupy codzienne') {
                    currentMonthTotals[categoryName] = monthCategoryTotal;
                    rows.forEach(row => {
                        const cost = parseFloat(String(row[1] || '0').replace(',', '.')) || 0;
                        const subCategory = row[2];
                        if (subCategory) {
                            currentMonthTotals[subCategory] = (currentMonthTotals[subCategory] || 0) + cost;
                        }
                    });
                } else {
                     currentMonthTotals[categoryName] = monthCategoryTotal;
                }
            } catch (e) { /* Ignorujemy błędy */ }
        }

        const historicalAverage = {};
        for (const categoryName in historicalTotals) {
            if (categoryCounts[categoryName] > 0) {
                historicalAverage[categoryName] = historicalTotals[categoryName] / categoryCounts[categoryName];
            }
        }
        res.status(200).json({ currentMonth: currentMonthTotals, historicalAverage });
    } catch (error) {
        console.error('Błąd podczas obliczania statystyk:', error);
        res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message });
    }
};
module.exports = { getShoppingStats };