const pool = require('./backend/db/pool');

async function checkCategories() {
  const client = await pool.connect();
  
  try {
    console.log('=== Sprawdzenie kategorii ===\n');
    
    // Sprawdź wszystkie kategorie w tabeli categories
    console.log('1. Kategorie w tabeli categories:');
    const categoriesResult = await client.query('SELECT name FROM categories ORDER BY name');
    categoriesResult.rows.forEach(row => {
      console.log(`  - "${row.name}"`);
    });
    
    console.log('\n2. Kategorie w tabeli statistics z amount > 0:');
    const statsResult = await client.query(`
      SELECT category, SUM(amount) as total_amount, COUNT(*) as record_count
      FROM statistics 
      WHERE amount > 0
      GROUP BY category 
      ORDER BY category
    `);
    statsResult.rows.forEach(row => {
      console.log(`  - "${row.category}": ${row.total_amount} zł (${row.record_count} rekordów)`);
    });
    
    console.log('\n3. Kategorie w tabeli statistics z amount = 0:');
    const zeroStatsResult = await client.query(`
      SELECT category, COUNT(*) as month_count 
      FROM statistics 
      WHERE amount = 0 
      GROUP BY category 
      ORDER BY category
    `);
    zeroStatsResult.rows.forEach(row => {
      console.log(`  - "${row.category}": ${row.month_count} miesięcy z 0 amount`);
    });
    
    console.log('\n4. categoryMapping z expenseController.js:');
    const categoryMapping = {
      'transport': 'Transport',
      'auta': 'Transport',
      'dom': 'dom',
      'pies': 'pies',
      'wyjścia / jedzenie na mieście': 'wyjścia i szama do domu'
    };
    
    Object.entries(categoryMapping).forEach(([frontend, backend]) => {
      console.log(`  "${frontend}" → "${backend}"`);
    });
    
    console.log('\n5. Sprawdzenie średnich dla problematycznych kategorii:');
    const avgResult = await client.query(`
      SELECT 
        category,
        COUNT(*) as total_months,
        SUM(CASE WHEN is_open = false THEN 1 ELSE 0 END) as closed_months,
        SUM(CASE WHEN is_open = false THEN amount ELSE 0 END) as total_amount,
        CASE 
          WHEN SUM(CASE WHEN is_open = false THEN 1 ELSE 0 END) > 0 
          THEN SUM(CASE WHEN is_open = false THEN amount ELSE 0 END) / SUM(CASE WHEN is_open = false THEN 1 ELSE 0 END)::float
          ELSE 0 
        END as calculated_average
      FROM statistics 
      WHERE category IN ('dom', 'pies', 'wyjścia i szama do domu')
      GROUP BY category
      ORDER BY category
    `);
    
    avgResult.rows.forEach(row => {
      console.log(`  "${row.category}":`);
      console.log(`    - Miesięcy zamkniętych: ${row.closed_months}/${row.total_months}`);
      console.log(`    - Kwota: ${row.total_amount}`);
      console.log(`    - Średnia: ${row.calculated_average}`);
    });
    
  } catch (error) {
    console.error('Błąd:', error);
  } finally {
    client.release();
  }
}

checkCategories().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
