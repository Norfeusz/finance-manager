// Test bezpośredni logiki aktualizacji statystyk
console.log('=== TEST LOGIKI AKTUALIZACJI STATYSTYK ===');

// Symulacja danych
const testScenarios = [
    {
        name: 'Główna kategoria',
        categoryId: 13, // auta
        categoryName: 'auta',
        subcategoryId: null,
        subcategoryName: null,
        expectedStatCategory: 'auta',
        expectedStatSubcategory: null
    },
    {
        name: 'Podkategoria zakupów codziennych',
        categoryId: 14, // zakupy codzienne
        categoryName: 'zakupy codzienne',
        subcategoryId: 25, // jedzenie
        subcategoryName: 'jedzenie',
        expectedStatCategory: 'ZC',
        expectedStatSubcategory: 'jedzenie'
    },
    {
        name: 'Podkategoria innej kategorii',
        categoryId: 7, // Zakupy spożywcze
        categoryName: 'Zakupy spożywcze',
        subcategoryId: 4, // Podstawowe
        subcategoryName: 'Podstawowe',
        expectedStatCategory: 'Zakupy spożywcze',
        expectedStatSubcategory: 'Podstawowe'
    }
];

// Test logiki mapowania
function testMappingLogic(scenario) {
    console.log(`\n--- Test: ${scenario.name} ---`);
    console.log(`Input: categoryName='${scenario.categoryName}', subcategoryName='${scenario.subcategoryName}'`);
    
    // Logika z funkcji updateStatistics
    let statCategory, statSubcategory;
    
    if (scenario.subcategoryName) {
        // To jest podkategoria - sprawdź czy to "zakupy codzienne"
        if (scenario.categoryName && scenario.categoryName.toLowerCase() === 'zakupy codzienne') {
            statCategory = 'ZC'; // Używamy "ZC" dla podkategorii zakupów codziennych
            statSubcategory = scenario.subcategoryName;
        } else {
            // Inne podkategorie - używamy nazwy głównej kategorii
            statCategory = scenario.categoryName;
            statSubcategory = scenario.subcategoryName;
        }
    } else {
        // To jest główna kategoria
        statCategory = scenario.categoryName;
        statSubcategory = null;
    }
    
    console.log(`Output: statCategory='${statCategory}', statSubcategory='${statSubcategory}'`);
    console.log(`Expected: statCategory='${scenario.expectedStatCategory}', statSubcategory='${scenario.expectedStatSubcategory}'`);
    
    const isCorrect = (statCategory === scenario.expectedStatCategory && statSubcategory === scenario.expectedStatSubcategory);
    console.log(`Result: ${isCorrect ? '✅ PASS' : '❌ FAIL'}`);
    
    return isCorrect;
}

// Uruchom testy
let allPassed = true;
testScenarios.forEach(scenario => {
    const passed = testMappingLogic(scenario);
    if (!passed) allPassed = false;
});

console.log(`\n=== WYNIK KOŃCOWY ===`);
console.log(`${allPassed ? '✅ Wszystkie testy przeszły' : '❌ Niektóre testy nie przeszły'}`);

console.log('\n=== TEST ZAPYTANIA SQL ===');
console.log('Przykładowe zapytanie do aktualizacji statystyk:');
console.log(`
UPDATE statistics 
SET amount = amount + 25.50, last_edited = NOW() 
WHERE month_id = '2025-08' 
  AND category = 'ZC' 
  AND subcategory = 'jedzenie'
`);

console.log('\nPrzykładowe zapytanie do sprawdzenia statystyk:');
console.log(`
SELECT category, subcategory, amount 
FROM statistics 
WHERE month_id = '2025-08' 
  AND (category = 'ZC' OR category = 'auta')
ORDER BY category, subcategory
`);

console.log('\n=== TEST ZAKOŃCZONY ===');
