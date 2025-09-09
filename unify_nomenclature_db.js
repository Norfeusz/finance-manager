const pool = require('./backend/db/pool');

async function unifyNomenclature() {
  const client = await pool.connect();
  
  try {
    console.log('=== Ujednolicenie nazewnictwa kategorii ===\n');
    
    await client.query('BEGIN');
    
    // 1. Zmiana w tabeli categories
    console.log('1. Aktualizacja tabeli categories:');
    const updateCategoriesResult = await client.query(`
      UPDATE categories 
      SET name = 'wyjścia i szama do domu' 
      WHERE name = 'wyjścia / jedzenie do domu'
    `);
    console.log(`✓ Zaktualizowano ${updateCategoriesResult.rowCount} rekordów w categories`);
    
    // 2. Zmiana w tabeli statistics
    console.log('\n2. Aktualizacja tabeli statistics:');
    const updateStatisticsResult = await client.query(`
      UPDATE statistics 
      SET category = 'wyjścia i szama do domu' 
      WHERE category = 'wyjścia / jedzenie do domu'
    `);
    console.log(`✓ Zaktualizowano ${updateStatisticsResult.rowCount} rekordów w statistics`);
    
    // 3. Sprawdź czy nie ma innych wariantów
    console.log('\n3. Sprawdzenie czy są inne warianty nazw:');
    const otherVariants = await client.query(`
      SELECT name FROM categories 
      WHERE name ILIKE '%wyjścia%' OR name ILIKE '%jedzenie%' OR name ILIKE '%szama%'
    `);
    
    if (otherVariants.rows.length > 0) {
      console.log('Znalezione warianty w categories:');
      otherVariants.rows.forEach(row => {
        console.log(`  - "${row.name}"`);
      });
    } else {
      console.log('Brak innych wariantów w categories');
    }
    
    const statisticsVariants = await client.query(`
      SELECT DISTINCT category FROM statistics 
      WHERE category ILIKE '%wyjścia%' OR category ILIKE '%jedzenie%' OR category ILIKE '%szama%'
    `);
    
    if (statisticsVariants.rows.length > 0) {
      console.log('Znalezione warianty w statistics:');
      statisticsVariants.rows.forEach(row => {
        console.log(`  - "${row.category}"`);
      });
    } else {
      console.log('Brak innych wariantów w statistics');
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Wszystkie zmiany zostały zatwierdzone w bazie danych');
    
    // 4. Sprawdzenie końcowe
    console.log('\n4. Sprawdzenie końcowe:');
    const finalCheck = await client.query(`
      SELECT name FROM categories 
      WHERE name ILIKE '%wyjścia%' OR name ILIKE '%jedzenie%' OR name ILIKE '%szama%'
    `);
    
    console.log('Kategorie po aktualizacji:');
    finalCheck.rows.forEach(row => {
      console.log(`  - "${row.name}"`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Błąd - cofnięto zmiany:', error);
  } finally {
    client.release();
  }
}

unifyNomenclature().then(() => {
  console.log('\nAktualizacja bazy danych zakończona');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
