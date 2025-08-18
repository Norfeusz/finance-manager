const pool = require('../db/pool');

/**
 * Skrypt inicjalizujący podstawowe dane w bazie PostgreSQL
 */
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Inicjalizacja bazy danych...');
    await client.query('BEGIN');

    // Sprawdzenie i utworzenie podstawowych kont
    console.log('Tworzenie i aktualizacja podstawowych kont...');
    const basicAccounts = ['Wspólne', 'Gotówka', 'Oszczędnościowe', 'Rachunki', 'KWNR'];
    
    // Najpierw znajdź wszystkie istniejące konta
    const existingAccounts = await client.query('SELECT id, name FROM accounts');
    const existingNames = existingAccounts.rows.map(row => row.name);
    
    // Sprawdź, które konta trzeba zaktualizować
    if (existingNames.includes('Główne') && !existingNames.includes('Wspólne')) {
      // Zaktualizuj 'Główne' na 'Wspólne'
      await client.query(`UPDATE accounts SET name = 'Wspólne' WHERE name = 'Główne'`);
      console.log('Zaktualizowano konto: Główne -> Wspólne');
    }
    
    // Zaktualizuj pozostałe konta, jeśli istnieją
    const mappings = {
      'Konto bankowe': 'Gotówka',
      'Oszczędności': 'Oszczędnościowe'
    };
    
    for (const [oldName, newName] of Object.entries(mappings)) {
      if (existingNames.includes(oldName) && !existingNames.includes(newName)) {
        await client.query('UPDATE accounts SET name = $1 WHERE name = $2', [newName, oldName]);
        console.log(`Zaktualizowano konto: ${oldName} -> ${newName}`);
      }
    }
    
    // Dodaj nowe konta, jeśli nie istnieją
    for (const accountName of basicAccounts) {
      const accountCheck = await client.query('SELECT id FROM accounts WHERE name = $1', [accountName]);
      
      if (accountCheck.rows.length === 0) {
        await client.query('INSERT INTO accounts (name) VALUES ($1)', [accountName]);
        console.log(`- Utworzono konto: ${accountName}`);
      }
    }

    // Sprawdzenie i utworzenie podstawowych kategorii
    console.log('Tworzenie podstawowych kategorii...');
    const basicCategories = [
      { name: 'Zakupy spożywcze', subcategories: ['Podstawowe', 'Przekąski', 'Napoje'] },
      { name: 'Transport', subcategories: ['Paliwo', 'Bilety', 'Utrzymanie pojazdu'] },
      { name: 'Mieszkanie', subcategories: ['Czynsz', 'Media', 'Naprawy'] },
      { name: 'Rozrywka', subcategories: ['Kino', 'Restauracje', 'Hobby'] },
      { name: 'Zdrowie', subcategories: ['Leki', 'Wizyty lekarskie', 'Aktywność fizyczna'] },
      { name: 'Odzież', subcategories: [] },
      { name: 'Edukacja', subcategories: ['Książki', 'Kursy', 'Szkolenia'] },
      { name: 'Elektronika', subcategories: [] },
      { name: 'Wpływy', subcategories: ['Wynagrodzenie', 'Prezenty', 'Zwroty'] }
    ];
    
    for (const category of basicCategories) {
      const categoryCheck = await client.query('SELECT id FROM categories WHERE name = $1', [category.name]);
      
      let categoryId;
      if (categoryCheck.rows.length === 0) {
        const categoryResult = await client.query(
          'INSERT INTO categories (name) VALUES ($1) RETURNING id', 
          [category.name]
        );
        categoryId = categoryResult.rows[0].id;
        console.log(`- Utworzono kategorię: ${category.name}`);
      } else {
        categoryId = categoryCheck.rows[0].id;
      }
      
      // Dodawanie podkategorii
      for (const subcategoryName of category.subcategories) {
        const subcategoryCheck = await client.query(
          'SELECT id FROM subcategories WHERE name = $1 AND category_id = $2', 
          [subcategoryName, categoryId]
        );
        
        if (subcategoryCheck.rows.length === 0) {
          await client.query(
            'INSERT INTO subcategories (name, category_id) VALUES ($1, $2)', 
            [subcategoryName, categoryId]
          );
          console.log(`  - Dodano podkategorię: ${subcategoryName} do ${category.name}`);
        }
      }
    }

    // Sprawdzenie i utworzenie bieżącego miesiąca
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(currentDate);
    
    const monthCheck = await client.query(
      'SELECT id FROM months WHERE year = $1 AND month = $2', 
      [currentYear, currentMonth]
    );
    
    if (monthCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO months (year, month, label) VALUES ($1, $2, $3)', 
        [currentYear, currentMonth, monthLabel]
      );
      console.log(`- Utworzono bieżący miesiąc: ${monthLabel}`);
    }

    await client.query('COMMIT');
    console.log('Inicjalizacja bazy danych zakończona pomyślnie!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Błąd podczas inicjalizacji bazy danych:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { initializeDatabase };
