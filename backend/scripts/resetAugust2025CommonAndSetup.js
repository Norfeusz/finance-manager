// Reset sierpień 2025: wyzeruj przepływy Wspólne, ustaw salda startowe i dodaj wpływy początkowe
const pool = require('../db/pool');

async function resetAugust2025() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ustal parametry
    const targetYear = 2025;
    const targetMonth = 8; // sierpień
    const monthId = `${targetYear}-${String(targetMonth).padStart(2,'0')}`;

    // Zapewnij miesiąc
    const m = await client.query('SELECT * FROM months WHERE id = $1', [monthId]);
    if (!m.rows.length) {
      await client.query('INSERT INTO months(id, year, month) VALUES($1,$2,$3)', [monthId, targetYear, targetMonth]);
    }

    // Pobierz ID kont
    const acc = await client.query("SELECT id, name FROM accounts WHERE name IN ('Wspólne','Oszczędnościowe','Gabi','Norf')");
    const map = Object.fromEntries(acc.rows.map(r => [r.name, r.id]));
    if (!map['Wspólne'] || !map['Oszczędnościowe']) {
      throw new Error('Brak kont Wspólne/Oszczędnościowe');
    }

    // Usuń wszystkie transakcje z/do konta Wspólne w sierpniu 2025 (income, expense, transfer)
    await client.query(`
      DELETE FROM transactions 
      WHERE month_id = $1 AND account_id = $2
    `, [monthId, map['Wspólne']]);

    // Opcjonalnie: usuń transfery z/do Wspólne, jeśli były zapisane pod innymi kontami
    // (w naszym modelu transfery zapisujemy na obu kontach; jeśli jest inaczej, dostosuj tu WHERE)

    // Ustaw salda startowe kont
    // Wspólne: 134,24
    await client.query(`
      INSERT INTO account_balances(account_id, initial_balance, current_balance)
      VALUES($1, $2, $2)
      ON CONFLICT (account_id) DO UPDATE SET initial_balance = EXCLUDED.initial_balance, current_balance = EXCLUDED.current_balance, last_updated = NOW()
    `, [map['Wspólne'], 134.24]);

    // Oszczędnościowe: 984,89
    await client.query(`
      INSERT INTO account_balances(account_id, initial_balance, current_balance)
      VALUES($1, $2, $2)
      ON CONFLICT (account_id) DO UPDATE SET initial_balance = EXCLUDED.initial_balance, current_balance = EXCLUDED.current_balance, last_updated = NOW()
    `, [map['Oszczędnościowe'], 984.89]);

    // Dodaj wpływy początkowe 2x2000 na Wspólne (dzień 1 miesiąca)
    const addIncome = async (from, amount) => {
      await client.query(
        `INSERT INTO transactions(month_id, account_id, type, amount, description, extra_description, date)
         VALUES($1,$2,'income',$3,$4,$5,$6)`,
        [monthId, map['Wspólne'], amount, 'Wpływ początkowy', `Wpływ początkowy od: ${from}`, `${monthId}-01`]
      );
      await client.query(
        `UPDATE account_balances SET current_balance = current_balance + $1, last_updated = NOW() WHERE account_id = $2`,
        [amount, map['Wspólne']]
      );
    };

    await addIncome('Gabi', 2000.00);
    await addIncome('Norf', 2000.00);

    await client.query('COMMIT');
    console.log('Reset sierpień 2025 zakończony. Salda i wpływy początkowe ustawione.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Błąd resetu sierpień 2025:', e);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  resetAugust2025();
}

module.exports = { resetAugust2025 };
