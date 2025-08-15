const { getGoogleSheets } = require('../config/googleSheets');
const { CATEGORY_CONFIG } = require('../config/categoryConfig');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const getTransactions = async (req, res) => {
    console.log('START getTransactions');
    try {
        const year = req.query.year || new Date().getFullYear();
        const month = req.query.month || new Date().getMonth() + 1;
        const dateForSheet = new Date(year, month - 1);
        const sheetName = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(dateForSheet);
        console.log('sheetName:', sheetName);
        const googleSheets = await getGoogleSheets();
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        let allTransactions = [];

        for (const [categoryName, config] of Object.entries(CATEGORY_CONFIG)) {
            console.log('Pobieram kategorię:', categoryName, 'zakres:', config.start + '3:' + config.end + '1000');
            const range = `'${sheetName}'!${config.start}3:${config.end}1000`;
            try {
                const response = await googleSheets.spreadsheets.values.get({ spreadsheetId, range });
                const rows = response.data.values || [];
                console.log('Liczba wierszy pobranych dla', categoryName, ':', rows.length);
                const transactions = rows.map((row, index) => {
                    if (row.every(cell => !cell)) return null;
                    const rowId = index + 3;
                    return {
                        id: `${categoryName}-${rowId}`,
                        rowId: rowId,
                        category: categoryName, type: config.type,
                        account: row[0],
                        cost: parseFloat(String(row[1] || '0').replace(',', '.')) || 0,
                        description: row[2], date: row[3], extraDescription: row[4] || ''
                    };
                }).filter(Boolean);
                allTransactions = [...allTransactions, ...transactions];
            } catch (error) {
                console.error(`Nie można było odczytać danych dla kategorii "${categoryName}" w arkuszu "${sheetName}":`, error);
            }
        }
        allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        console.log('Zwracam transakcje, liczba:', allTransactions.length);
        res.status(200).json(allTransactions);
    } catch (error) {
        console.error('Błąd podczas pobierania transakcji:', error);
        res.status(500).json({ message: 'Wystąpił błąd po stronie serwera.', error: error.message });
    }
};
module.exports = { getTransactions };