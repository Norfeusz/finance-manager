// Plik: backend/config/categoryConfig.js
const fs = require('fs');
const path = require('path');

// Podstawowa konfiguracja kategorii
const CATEGORY_CONFIG = {
    'zakupy codzienne': { start: 'A', end: 'E', type: 'expense' },
    'auta':               { start: 'F', end: 'J', type: 'expense' },
    'dom':                { start: 'K', end: 'O', type: 'expense' },
    'wyjścia i szama do domu': { start: 'P', end: 'T', type: 'expense' },
    'pies':               { start: 'U', end: 'Y', type: 'expense' },
    'prezenty':           { start: 'Z', end: 'AD', type: 'expense' },
    'transfery':          { start: 'AE', end: 'AI', type: 'transfer' },
    'wpływy':             { start: 'AJ', end: 'AN', type: 'income' }
};

/**
 * Dodaje nową kategorię do konfiguracji
 * @param {string} categoryName - Nazwa kategorii
 * @returns {boolean} - Czy operacja się powiodła
 */
const addNewCategory = (categoryName) => {
    // Sprawdź, czy kategoria już istnieje
    if (CATEGORY_CONFIG[categoryName]) {
        console.log(`Kategoria "${categoryName}" już istnieje.`);
        return false;
    }
    
    try {
        // Znajdź ostatnią kolumnę dla kategorii wydatków
        const expenseEntries = Object.entries(CATEGORY_CONFIG)
            .filter(([_, config]) => config.type === 'expense')
            .sort((a, b) => a[1].end.localeCompare(b[1].end));
        
        let lastEndColumn = 'A';
        if (expenseEntries.length > 0) {
            lastEndColumn = expenseEntries[expenseEntries.length - 1][1].end;
        }
        
        // Wygeneruj nowy zakres kolumn (inkrementacja np. AD -> AE, AZ -> BA)
        const nextStartColumn = incrementExcelColumn(lastEndColumn);
        const nextEndColumn = incrementExcelColumn(nextStartColumn, 4); // 5 kolumn na kategorię
        
        // Dodaj nową kategorię
        CATEGORY_CONFIG[categoryName] = {
            start: nextStartColumn,
            end: nextEndColumn,
            type: 'expense'
        };
        
        console.log(`Dodano nową kategorię "${categoryName}" z zakresem ${nextStartColumn}:${nextEndColumn}`);
        return true;
    } catch (error) {
        console.error('Błąd podczas dodawania nowej kategorii:', error);
        return false;
    }
};

/**
 * Inkrementuje nazwę kolumny w stylu Excela (A -> B, Z -> AA, AZ -> BA)
 * @param {string} column - Nazwa kolumny w stylu Excela
 * @param {number} steps - Liczba kroków do inkrementacji (domyślnie 1)
 * @returns {string} - Nowa nazwa kolumny
 */
function incrementExcelColumn(column, steps = 1) {
    let result = column;
    for (let i = 0; i < steps; i++) {
        // Konwertujemy kolumnę na wartość liczbową
        let columnNumber = 0;
        for (let j = 0; j < result.length; j++) {
            columnNumber = columnNumber * 26 + (result.charCodeAt(j) - 64);
        }
        
        // Zwiększamy o 1
        columnNumber++;
        
        // Konwertujemy z powrotem na string
        let temp = '';
        while (columnNumber > 0) {
            let remainder = columnNumber % 26;
            if (remainder === 0) {
                remainder = 26;
                columnNumber--;
            }
            temp = String.fromCharCode(64 + remainder) + temp;
            columnNumber = Math.floor(columnNumber / 26);
        }
        
        result = temp;
    }
    
    return result;
}

module.exports = { 
    CATEGORY_CONFIG,
    addNewCategory 
};