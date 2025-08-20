const pool = require('./backend/db/pool');

async function checkAndCreateCategory() {
  const client = await pool.connect();
  try {
    // Sprawdź czy kategoria istnieje
    const checkRes = await client.query(
      'SELECT id, name FROM categories WHERE name = $1',
      ['Wspólne wydatki']
    );
    
    console.log('Wyniki wyszukiwania kategorii:', checkRes.rows);
    
    // Jeśli kategoria nie istnieje, dodaj ją
    if (checkRes.rows.length === 0) {
      console.log('Kategoria "Wspólne wydatki" nie istnieje. Dodawanie...');
      const insertRes = await client.query(
        'INSERT INTO categories (name) VALUES ($1) RETURNING id, name',
        ['Wspólne wydatki']
      );
      console.log('Dodano kategorię:', insertRes.rows[0]);
    } else {
      console.log('Kategoria "Wspólne wydatki" już istnieje.');
    }
  } catch (err) {
    console.error('Błąd:', err);
  } finally {
    client.release();
  }
}

checkAndCreateCategory().catch(console.error).finally(() => {
  pool.end();
});
