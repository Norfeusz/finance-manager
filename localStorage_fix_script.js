// SKRYPT DO KONSOLI PRZEGLĄDARKI
// Skopiuj i wklej w konsoli przeglądarki (F12 → Console)

console.log('=== NAPRAWA localStorage dla kategorii ===');

// 1. Sprawdź aktualne wartości
console.log('\n1. Aktualne wartości localStorage:');
const currentCategoryNames = localStorage.getItem('categoryDisplayNames');
const currentSubcategoryNames = localStorage.getItem('subcategoryDisplayNames');

if (currentCategoryNames) {
    console.log('categoryDisplayNames:', JSON.parse(currentCategoryNames));
} else {
    console.log('categoryDisplayNames: brak');
}

if (currentSubcategoryNames) {
    console.log('subcategoryDisplayNames:', JSON.parse(currentSubcategoryNames));
} else {
    console.log('subcategoryDisplayNames: brak');
}

// 2. Usuń stare dane
console.log('\n2. Usuwanie starych danych...');
localStorage.removeItem('categoryDisplayNames');
localStorage.removeItem('subcategoryDisplayNames');
console.log('✓ Usunięto stare dane');

// 3. Ustawienie nowych poprawnych wartości
console.log('\n3. Ustawianie nowych wartości...');
const correctCategoryNames = {
    'jedzenie': 'Jedzenie',
    'słodycze': 'Słodycze', 
    'chemia': 'Chemia',
    'apteka': 'Apteka',
    'alkohol': 'Alkohol',
    'higiena': 'Higiena',
    'kwiatki': 'Kwiatki',
    'zakupy': 'Inne zakupy',
    'auta': 'Auta',
    'dom': 'Dom',
    'wyjścia i szama do domu': 'Wyjścia i szama do domu',  // ← NAPRAWIONA NAZWA
    'pies': 'Pies',
    'prezenty': 'Prezenty',
    'zakupy codzienne': 'Zakupy codzienne (suma)'
};

localStorage.setItem('categoryDisplayNames', JSON.stringify(correctCategoryNames));
console.log('✓ Ustawiono nowe nazwy kategorii');
console.log('categoryDisplayNames:', correctCategoryNames);

console.log('\n🎉 GOTOWE! Odśwież stronę (F5) żeby zobaczyć zmiany.');
console.log('Kategoria "wyjścia i szama do domu" powinna teraz wyświetlać się poprawnie.');

// PODSUMOWANIE
console.log('\n=== PODSUMOWANIE ===');
console.log('✓ Usunięto stare nazwy z localStorage');
console.log('✓ Ustawiono nową nazwę: "Wyjścia i szama do domu"');
console.log('✓ Gotowe do odświeżenia strony');
