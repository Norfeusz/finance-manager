const { getGoogleSheets } = require('../config/googleSheets');
const { CATEGORY_CONFIG } = require('../config/categoryConfig');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const addTransaction = async (req, res) => {
  try {
    const transactions = Array.isArray(req.body) ? req.body : [req.body];
    if (transactions.length === 0) return res.status(400).json({ message: 'Brak transakcji.' });

    const googleSheets = await getGoogleSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const groupedTransactions = {};

    for (const transaction of transactions) {
        const { flowType, data } = transaction;
        const { date, extraDescription } = data;
        const sheetName = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(date));
        
        let category, newRowForSheet;
        const baseDescription = extraDescription || '';

        switch (flowType) {
            case 'expense':
                category = data.mainCategory;
                let desc = data.subCategory || data.description || '';
                newRowForSheet = [data.account, parseFloat(data.cost), desc, data.date, baseDescription];
                break;
            case 'income':
                category = 'wpływy';
                newRowForSheet = [data.toAccount, parseFloat(data.amount), data.from, data.date, baseDescription];
                break;
            case 'transfer':
                category = 'transfery';
                newRowForSheet = [data.fromAccount, data.toAccount, parseFloat(data.amount), data.date, baseDescription];
                break;
            default: continue;
        }
        
        const groupKey = `${sheetName}__${category}`;
        if (!groupedTransactions[groupKey]) groupedTransactions[groupKey] = [];
        groupedTransactions[groupKey].push(newRowForSheet);
    }

    for (const groupKey in groupedTransactions) {
        const [sheetName, category] = groupKey.split('__');
        const newRows = groupedTransactions[groupKey];
        const config = CATEGORY_CONFIG[category];
        if (!config) continue;

        const dataRange = `'${sheetName}'!${config.start}3:${config.end}1000`;
        let existingData = [];
        try {
            const getResponse = await googleSheets.spreadsheets.values.get({ spreadsheetId, range: dataRange });
            const rawRows = getResponse.data.values || [];
            existingData = rawRows.map(row => row.slice(0, 5));
        } catch(err) { console.log(`Zakres ${dataRange} jest pusty.`); }

        const allData = [...existingData, ...newRows];
        allData.sort((a, b) => {
            if (!a[3] || !b[3]) return 0;
            return new Date(a[3]) - new Date(b[3]);
        });

        await googleSheets.spreadsheets.values.clear({ spreadsheetId, range: dataRange });

        const writeRange = `'${sheetName}'!${config.start}3`;
        await googleSheets.spreadsheets.values.update({
          spreadsheetId, range: writeRange, valueInputOption: 'USER_ENTERED', resource: { values: allData },
        });
    }
    res.status(200).json({ message: `Pomyślnie przetworzono ${transactions.length} wpis(ów).` });
  } catch (error) {
    console.error(`Błąd krytyczny:`, error);
    res.status(500).json({ message: 'Krytyczny błąd serwera.', error: error.message });
  }
};

const deleteTransaction = async (req, res) => {
    try {
        const { date, category, rowId } = req.body;
        if (!date || !category || !rowId) {
            return res.status(400).json({ message: 'Brak wymaganych danych do usunięcia transakcji.' });
        }

        const googleSheets = await getGoogleSheets();
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        const sheetName = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(date));
        const config = CATEGORY_CONFIG[category];
        
        if (!config) {
            return res.status(404).json({ message: 'Nie znaleziono konfiguracji dla podanej kategorii.' });
        }

        const clearRange = `'${sheetName}'!${config.start}${rowId}:${config.end}${rowId}`;

        await googleSheets.spreadsheets.values.clear({
            spreadsheetId,
            range: clearRange,
        });

        res.status(200).json({ message: 'Transakcja została pomyślnie usunięta.' });
    } catch (error) {
        console.error('Błąd podczas usuwania transakcji:', error);
        res.status(500).json({ message: 'Błąd serwera podczas usuwania transakcji.', error: error.message });
    }
};

const updateTransaction = async (req, res) => {
    try {
        const { original, updated } = req.body;
        if (!original || !updated) {
            return res.status(400).json({ message: 'Brak danych do aktualizacji.' });
        }

        const googleSheets = await getGoogleSheets();
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        const sheetName = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(original.date));
        const config = CATEGORY_CONFIG[original.category];

        if (!config) {
            return res.status(404).json({ message: 'Nie znaleziono konfiguracji dla podanej kategorii.' });
        }

        const range = `'${sheetName}'!${config.start}${original.rowId}:${config.end}${original.rowId}`;
        const newValues = [
            [
                updated.account,
                parseFloat(String(updated.cost || '0').replace(',', '.')),
                updated.description,
                updated.date,
                updated.extraDescription
            ]
        ];

        await googleSheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: newValues },
        });

        res.status(200).json({ message: 'Transakcja została pomyślnie zaktualizowana.' });
    } catch (error) {
        console.error('Błąd podczas aktualizacji transakcji:', error);
        res.status(500).json({ message: 'Błąd serwera podczas aktualizacji.', error: error.message });
    }
};

module.exports = { addTransaction, deleteTransaction, updateTransaction };