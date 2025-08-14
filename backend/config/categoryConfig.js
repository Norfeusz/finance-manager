// Plik: backend/config/categoryConfig.js
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

module.exports = { CATEGORY_CONFIG };