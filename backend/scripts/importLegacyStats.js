const fs = require('fs');
const path = require('path');
const { getGoogleSheets } = require('../config/googleSheets');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Mapa komórek dla starych arkuszy na podstawie Twoich wytycznych
const LEGACY_MAP = {
    'styczeń 2025': {
        'zakupy codzienne': 'C1', 'auta': 'F1', 'dom': 'I1', 'wyjścia i szama do domu': 'L1',
        'rachunki': 'O1', 'prezenty': 'R1', 'pies': 'U1', 'wpływy': 'X1'
    },
    'luty 2025': {
        'auta': 'F1', 'dom': 'I1', 'wyjścia i szama do domu': 'L1', 'rachunki': 'O1',
        'prezenty': 'R1', 'pies': 'U1', 'wpływy': 'X1',
        'jedzenie': 'AA2', 'zakupy': 'AA3', 'słodycze': 'AA4', 'chemia': 'AA5',
        'apteka': 'AA6', 'alkohol': 'AA7', 'higiena': 'AA8'
    },
    'marzec 2025': {
        'auta': 'F1', 'dom': 'I1', 'wyjścia i szama do domu': 'L1', 'rachunki': 'O1',
        'prezenty': 'R1', 'pies': 'U1', 'wpływy': 'X1',
        'jedzenie': 'AA2', 'zakupy': 'AA3', 'słodycze': 'AA4', 'chemia': 'AA5',
        'apteka': 'AA6', 'alkohol': 'AA7', 'higiena': 'AA8', 'kwiatki': 'AA9'
    },
    'kwiecień 2025': 'marzec 2025', // Kwiecień ma ten sam układ co Marzec
    'maj 2025': {
        'auta': 'F1', 'dom': 'I1', 'wyjścia i szama do domu': 'L1', 'subkonta': 'O1',
        'prezenty': 'R1', 'pies': 'U1', 'wpływy': 'X1',
        'jedzenie': 'AA2', 'zakupy': 'AA3', 'słodycze': 'AA4', 'chemia': 'AA5',
        'apteka': 'AA6', 'alkohol': 'AA7', 'higiena': 'AA8', 'kwiatki': 'AA9'
    },
    'czerwiec 2025': 'maj 2025', // Czerwiec ma ten sam układ co Maj
    'lipiec 2025': 'maj 2025'   // Lipiec ma ten sam układ co Maj
};

const parseValue = (value) => {
    if (typeof value !== 'string') return 0;
    return parseFloat(value.replace('zł', '').replace(',', '.').trim()) || 0;
};

const importLegacyData = async () => {
    console.log('Rozpoczynam import danych archiwalnych...');
    const googleSheets = await getGoogleSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const legacyStats = {
        totals: {},
        counts: {}
    };

    const sheetsToProcess = Object.keys(LEGACY_MAP);

    for (const sheetName of sheetsToProcess) {
        console.log(`Przetwarzam arkusz: ${sheetName}...`);
        let mapping = LEGACY_MAP[sheetName];
        // Jeśli mapowanie jest aliasem do innego miesiąca, użyj tamtego mapowania
        if (typeof mapping === 'string') {
            mapping = LEGACY_MAP[mapping];
        }

        const cells = Object.values(mapping);
        const response = await googleSheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges: cells.map(cell => `'${sheetName}'!${cell}`)
        });

        const values = response.data.valueRanges || [];
        const categories = Object.keys(mapping);

        categories.forEach((category, index) => {
            const value = values[index]?.values?.[0]?.[0];
            
            if (value !== undefined) { // Liczymy miesiąc tylko, jeśli komórka istnieje
                const numericValue = parseValue(value);
                legacyStats.totals[category] = (legacyStats.totals[category] || 0) + numericValue;
                legacyStats.counts[category] = (legacyStats.counts[category] || 0) + 1;
            }
        });
    }

    const outputPath = path.join(__dirname, '../legacy-stats.json');
    fs.writeFileSync(outputPath, JSON.stringify(legacyStats, null, 2));
    console.log(`\nImport zakończony! Dane zapisano w pliku: ${outputPath}`);
};

importLegacyData();