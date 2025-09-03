const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

/**
 * GET /api/months - pobieranie wszystkich miesięcy
 */
router.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM months ORDER BY year DESC, month DESC'
      );
      
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas pobierania miesięcy:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania miesięcy', error: error.message });
  }
});

/**
 * GET /api/months/current - pobieranie bieżącego miesiąca
 */
router.get('/current', async (req, res) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM months WHERE year = $1 AND month = $2',
        [currentYear, currentMonth]
      );
      
      if (result.rows.length === 0) {
        // Nie tworzymy automatycznie – informujemy, że brak bieżącego miesiąca
        return res.status(404).json({ message: 'Brak bieżącego miesiąca' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas pobierania bieżącego miesiąca:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania bieżącego miesiąca', error: error.message });
  }
});

/**
 * GET /api/months/:id - pobieranie miesiąca po ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM months WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono miesiąca o podanym ID' });
      }
      
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas pobierania miesiąca:', error);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania miesiąca', error: error.message });
  }
});

/**
 * POST /api/months - dodawanie nowego miesiąca
 */
router.post('/', async (req, res) => {
  try {
    const { year, month, forceCreate, budget } = req.body;
    if (!year || !month) return res.status(400).json({ message: 'Rok i miesiąc są wymagane' });
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return res.status(400).json({ message: 'Nieprawidłowe dane. Miesiąc 1-12.' });
    const monthId = `${year.toString().padStart(4,'0')}-${month.toString().padStart(2,'0')}`;
    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT * FROM months WHERE id = $1', [monthId]);
      if (existing.rows.length) {
        return res.status(200).json({ exists: true, month: existing.rows[0] });
      }
      if (!forceCreate) {
        return res.status(202).json({ needsConfirmation: true, action: 'create', monthId });
      }
      const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
      const insertResult = await client.query(
        'INSERT INTO months (id, year, month, label, is_closed, budget) VALUES ($1,$2,$3,$4,false,$5) RETURNING *',
        [monthId, year, month, monthLabel, budget ?? null]
      );
      // Zmaterializuj aktywne stałe rachunki do monthly_bills dla nowego miesiąca
      try {
        await client.query(`
          INSERT INTO monthly_bills (month_id, name, recipient, amount)
          SELECT $1, name, recipient, amount FROM recurring_bills
          WHERE is_active = TRUE AND start_month_id <= $1 AND (end_month_id IS NULL OR end_month_id >= $1)
        `, [monthId]);
      } catch (se2) { console.warn('Materializacja recurring bills pominięta:', se2.message); }
      // Upewnij się, że saldo otwarcia Rachunki dla tego miesiąca istnieje: jeśli zapis z zamykania poprzedniego już był, nic nie rób
      try {
        const accRes = await client.query("SELECT id FROM accounts WHERE name = 'Rachunki'");
        if (accRes.rows.length) {
          const accountId = accRes.rows[0].id;
          // Sprawdź czy istnieje wpis opening dla tego miesiąca, jeśli nie – sprawdź poprzedni month_id i skopiuj
          const exists = await client.query('SELECT 1 FROM account_month_openings WHERE account_id=$1 AND month_id=$2', [accountId, monthId]);
          if (!exists.rows.length) {
            // Wylicz poprzedni miesiąc
            const d = new Date(year, month - 1, 1); d.setMonth(d.getMonth() - 1);
            const prevId = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const prevOpen = await client.query('SELECT opening_balance FROM account_month_openings WHERE account_id=$1 AND month_id=$2', [accountId, prevId]);
            if (prevOpen.rows.length) {
              await client.query(
                `INSERT INTO account_month_openings (account_id, month_id, opening_balance)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (account_id, month_id) DO NOTHING`,
                [accountId, monthId, Number(prevOpen.rows[0].opening_balance)]
              );
            }
          }
        }
      } catch (se) { console.warn('Seed opening for Rachunki pominięty:', se.message); }
      
      // Inicjalizacja statystyk dla nowego miesiąca
      try {
        // Pobierz wszystkie kategorie wydatków
        const categories = await client.query(`
          SELECT id, name FROM categories 
          WHERE name NOT IN ('Wpływy') 
          ORDER BY name
        `);
        
        // Pobierz podkategorie dla "zakupy codzienne" 
        const shoppingCategoryId = await client.query(`
          SELECT id FROM categories WHERE LOWER(name) = 'zakupy codzienne'
        `);
        
        let subcategories = [];
        if (shoppingCategoryId.rows.length > 0) {
          const subcatResult = await client.query(`
            SELECT id, name FROM subcategories 
            WHERE category_id = $1 
            ORDER BY name
          `, [shoppingCategoryId.rows[0].id]);
          subcategories = subcatResult.rows;
        }
        
        // Wstaw rekordy dla kategorii głównych
        for (const category of categories.rows) {
          await client.query(`
            INSERT INTO statistics (month_id, category, subcategory, amount, last_edited, is_open)
            VALUES ($1, $2, NULL, 0, NOW(), true)
            ON CONFLICT DO NOTHING
          `, [monthId, category.name]);
        }
        
        // Wstaw rekordy dla podkategorii zakupów codziennych
        for (const subcategory of subcategories) {
          await client.query(`
            INSERT INTO statistics (month_id, category, subcategory, amount, last_edited, is_open)
            VALUES ($1, $2, $3, 0, NOW(), true)
            ON CONFLICT DO NOTHING
          `, [monthId, 'zakupy codzienne', subcategory.name]);
        }
        
        console.log(`Zainicjalizowano ${categories.rows.length} kategorii i ${subcategories.length} podkategorii dla miesiąca ${monthId}`);
      } catch (se) { 
        console.warn('Inicjalizacja statystyk pominięta:', se.message); 
      }
      
      res.status(201).json({ created: true, month: insertResult.rows[0] });
    } finally { client.release(); }
  } catch (error) {
    console.error('Błąd podczas tworzenia miesiąca:', error);
    res.status(500).json({ message: 'Błąd serwera', error: error.message });
  }
});

// Endpoint pomocniczy do weryfikacji lub tworzenia przy dodawaniu transakcji
router.post('/ensure', async (req, res) => {
  try {
    const { month_id, allowCreate, allowReopen, budget } = req.body; // month_id w formacie YYYY-MM
    if (!month_id || !/^\d{4}-\d{2}$/.test(month_id)) return res.status(400).json({ message: 'month_id wymagane w formacie YYYY-MM' });
    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT * FROM months WHERE id = $1', [month_id]);
      if (!existing.rows.length) {
        if (!allowCreate) return res.status(202).json({ needsConfirmation: true, action: 'create', month_id });
        const parts = month_id.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const label = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(year, month-1, 1));
        const inserted = await client.query('INSERT INTO months (id, year, month, label, is_closed, budget) VALUES ($1,$2,$3,$4,false,$5) RETURNING *', [month_id, year, month, label, budget ?? null]);
        // Materializacja stałych rachunków do monthly_bills
        try {
          await client.query(`
            INSERT INTO monthly_bills (month_id, name, recipient, amount)
            SELECT $1, name, recipient, amount FROM recurring_bills
            WHERE is_active = TRUE AND start_month_id <= $1 AND (end_month_id IS NULL OR end_month_id >= $1)
          `, [month_id]);
        } catch (se3) { console.warn('Materializacja recurring bills (ensure) pominięta:', se3.message); }
        // Seed opening Rachunki z poprzedniego snapshotu jeśli brak
        try {
          const accRes = await client.query("SELECT id FROM accounts WHERE name = 'Rachunki'");
          if (accRes.rows.length) {
            const accountId = accRes.rows[0].id;
            const exists = await client.query('SELECT 1 FROM account_month_openings WHERE account_id=$1 AND month_id=$2', [accountId, month_id]);
            if (!exists.rows.length) {
              const y = parseInt(year), m = parseInt(month);
              const d = new Date(y, m - 1, 1); d.setMonth(d.getMonth() - 1);
              const prevId = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              const prevOpen = await client.query('SELECT opening_balance FROM account_month_openings WHERE account_id=$1 AND month_id=$2', [accountId, prevId]);
              if (prevOpen.rows.length) {
                await client.query(
                  `INSERT INTO account_month_openings (account_id, month_id, opening_balance)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (account_id, month_id) DO NOTHING`,
                  [accountId, month_id, Number(prevOpen.rows[0].opening_balance)]
                );
              }
            }
          }
        } catch (se) { console.warn('Seed opening for Rachunki (ensure) pominięty:', se.message); }
        
        // Inicjalizacja statystyk dla nowego miesiąca w ensure
        try {
          // Pobierz wszystkie kategorie wydatków
          const categories = await client.query(`
            SELECT id, name FROM categories 
            WHERE name NOT IN ('Wpływy') 
            ORDER BY name
          `);
          
          // Pobierz podkategorie dla "zakupy codzienne" 
          const shoppingCategoryId = await client.query(`
            SELECT id FROM categories WHERE LOWER(name) = 'zakupy codzienne'
          `);
          
          let subcategories = [];
          if (shoppingCategoryId.rows.length > 0) {
            const subcatResult = await client.query(`
              SELECT id, name FROM subcategories 
              WHERE category_id = $1 
              ORDER BY name
            `, [shoppingCategoryId.rows[0].id]);
            subcategories = subcatResult.rows;
          }
          
          // Wstaw rekordy dla kategorii głównych
          for (const category of categories.rows) {
            await client.query(`
              INSERT INTO statistics (month_id, category, subcategory, amount, last_edited, is_open)
              VALUES ($1, $2, NULL, 0, NOW(), true)
              ON CONFLICT DO NOTHING
            `, [month_id, category.name]);
          }
          
          // Wstaw rekordy dla podkategorii zakupów codziennych
          for (const subcategory of subcategories) {
            await client.query(`
              INSERT INTO statistics (month_id, category, subcategory, amount, last_edited, is_open)
              VALUES ($1, $2, $3, 0, NOW(), true)
              ON CONFLICT DO NOTHING
            `, [month_id, 'zakupy codzienne', subcategory.name]);
          }
          
          console.log(`Zainicjalizowano ${categories.rows.length} kategorii i ${subcategories.length} podkategorii dla miesiąca ${month_id} (ensure)`);
        } catch (statErr) {
          console.warn('Inicjalizacja statystyk w ensure pominięta:', statErr.message);
        }
        
        return res.status(201).json({ created: true, month: inserted.rows[0] });
      }
      const monthRow = existing.rows[0];
      if (monthRow.is_closed) {
        if (!allowReopen) return res.status(202).json({ needsConfirmation: true, action: 'reopen', month_id });
        
        await client.query('BEGIN');
        try {
          const reopened = await client.query('UPDATE months SET is_closed = false WHERE id = $1 RETURNING *', [month_id]);
          // Zaktualizuj status is_open w tabeli statistics na true dla otwieranego miesiąca
          await client.query('UPDATE statistics SET is_open = true WHERE month_id = $1', [month_id]);
          console.log(`Otwarto statystyki dla miesiąca ${month_id} (is_open = true) przez ensure`);
          await client.query('COMMIT');
          return res.status(200).json({ reopened: true, month: reopened.rows[0] });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
      }
      return res.status(200).json({ ok: true, month: monthRow });
    } finally { client.release(); }
  } catch (e) {
    console.error('Błąd ensure month:', e);
    res.status(500).json({ message: 'Błąd serwera', error: e.message });
  }
});

// Aktualizacja / ustawienie budżetu dla miesiąca
router.post('/:id/budget', async (req, res) => {
  try {
    const { id } = req.params;
    const { budget } = req.body;
    if (budget != null && isNaN(parseFloat(budget))) return res.status(400).json({ message: 'Nieprawidłowa wartość budżetu' });
    const r = await pool.query('UPDATE months SET budget = $2 WHERE id = $1 RETURNING *', [id, budget == null ? null : parseFloat(budget)]);
    if (!r.rows.length) return res.status(404).json({ message: 'Nie znaleziono miesiąca' });
    res.json({ updated: true, month: r.rows[0] });
  } catch (e) {
    console.error('Błąd aktualizacji budżetu:', e);
    res.status(500).json({ message: 'Błąd serwera', error: e.message });
  }
});

// Zamknięcie miesiąca
router.post('/:id/close', async (req, res) => {
  try {
    const { id } = req.params; // YYYY-MM
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query('UPDATE months SET is_closed = true WHERE id = $1 RETURNING *', [id]);
      if (!r.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Nie znaleziono miesiąca' });
      }

      // Zaktualizuj status is_open w tabeli statistics na false dla zamykanego miesiąca
      await client.query('UPDATE statistics SET is_open = false WHERE month_id = $1', [id]);
      console.log(`Zamknięto statystyki dla miesiąca ${id} (is_open = false)`);

      // Wylicz następny miesiąc (YYYY-MM)
      const [yStr, mStr] = id.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = new Date(y, m - 1, 1);
      d.setMonth(d.getMonth() + 1);
      const nextId = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      // Pobierz saldo konta Rachunki i zapisz jako saldo otwarcia dla następnego miesiąca
      const accRes = await client.query("SELECT id FROM accounts WHERE name = 'Rachunki'");
      if (accRes.rows.length) {
        const accountId = accRes.rows[0].id;
        const balRes = await client.query('SELECT current_balance FROM account_balances WHERE account_id = $1', [accountId]);
        const currentBal = balRes.rows.length ? Number(balRes.rows[0].current_balance) : 0;
        await client.query(`
          INSERT INTO account_month_openings (account_id, month_id, opening_balance)
          VALUES ($1, $2, $3)
          ON CONFLICT (account_id, month_id) DO UPDATE SET opening_balance = EXCLUDED.opening_balance
        `, [accountId, nextId, currentBal]);
      }

      await client.query('COMMIT');
      res.json({ closed: true, month: r.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) { res.status(500).json({ message: 'Błąd serwera', error: e.message }); }
});

// Ponowne otwarcie miesiąca
router.post('/:id/reopen', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`=== ROZPOCZĘCIE OTWIERANIA MIESIĄCA ${id} ===`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log(`Rozpoczęto transakcję dla ${id}`);
      
      const r = await client.query('UPDATE months SET is_closed = false WHERE id = $1 RETURNING *', [id]);
      if (!r.rows.length) {
        console.log(`Nie znaleziono miesiąca ${id}`);
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Nie znaleziono miesiąca' });
      }
      console.log(`Zaktualizowano miesiąc ${id} na is_closed = false`);

      // Zaktualizuj status is_open w tabeli statistics na true dla otwieranego miesiąca
      const updateResult = await client.query('UPDATE statistics SET is_open = true WHERE month_id = $1', [id]);
      console.log(`Otwarto statystyki dla miesiąca ${id} (is_open = true), zaktualizowano ${updateResult.rowCount} rekordów`);

      await client.query('COMMIT');
      console.log(`Zacommitowano transakcję dla ${id}`);
      res.json({ reopened: true, month: r.rows[0] });
    } catch (e) {
      console.log(`Błąd podczas otwierania miesiąca ${id}:`, e);
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) { res.status(500).json({ message: 'Błąd serwera', error: e.message }); }
});

// Usunięcie miesiąca (tylko jeśli nie ma transakcji)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params; // YYYY-MM
    const client = await pool.connect();
    try {
      const m = await client.query('SELECT * FROM months WHERE id = $1', [id]);
      if (!m.rows.length) return res.status(404).json({ message: 'Miesiąc nie istnieje' });
      const tx = await client.query('SELECT COUNT(*)::int AS cnt FROM transactions WHERE month_id = $1', [id]);
      if (tx.rows[0].cnt > 0) return res.status(409).json({ message: 'Nie można usunąć miesiąca z transakcjami' });
      await client.query('DELETE FROM months WHERE id = $1', [id]);
      res.json({ deleted: true, id });
    } finally { client.release(); }
  } catch (e) {
    console.error('Błąd usuwania miesiąca:', e);
    res.status(500).json({ message: 'Błąd serwera', error: e.message });
  }
});

// Sugestia początkowych wpływów dla nowo otwartego miesiąca
router.get('/:id/suggested-initial-incomes', async (req, res) => {
  try {
    const { id } = req.params; // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(id)) return res.status(400).json({ message: 'Format miesiąca YYYY-MM' });
    const [yearStr, monthStr] = id.split('-');
    const year = parseInt(yearStr); const month = parseInt(monthStr);
  const identifiersParam = (req.query.identifiers || 'gabi,norf').toString();
  const identifiers = identifiersParam.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  const excludePrefix = (req.query.excludePrefix || 'wpływ początkowy').toString().toLowerCase();
    // poprzedni miesiąc
    const prevDate = new Date(year, month-1, 1); prevDate.setMonth(prevDate.getMonth()-1);
    const prevId = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
    const client = await pool.connect();
    try {
      const currentMonthRes = await client.query('SELECT * FROM months WHERE id = $1', [id]);
      if (!currentMonthRes.rows.length) return res.status(404).json({ message: 'Miesiąc nie istnieje' });
      const currentMonth = currentMonthRes.rows[0];
      let budget = currentMonth.budget || 4200; // fallback
      const prevRes = await client.query('SELECT * FROM months WHERE id = $1', [prevId]);
      if (!prevRes.rows.length) {
        // brak poprzedniego => podział równy
        const half = +(budget/2).toFixed(2);
        return res.json({ baseBudget: budget, previousMonth: null, method: 'no_previous', gabi: half, norf: half });
      }
  const prev = prevRes.rows[0];
      // policz dodatkowe wpływy poprzedniego miesiąca: incomes opisujące wskazane identyfikatory (poza wpływem początkowym)
      const incomesRes = await client.query(`
        SELECT LOWER(description) as desc, SUM(amount) as sum
        FROM transactions
        WHERE month_id = $1 AND type = 'income'
        GROUP BY 1
      `, [prevId]);
      const extraMap = { };
      identifiers.forEach(idf => extraMap[idf] = 0);
      incomesRes.rows.forEach(r => {
        const d = r.desc || '';
        // pomiń wpływy początkowe
        if (d.startsWith(excludePrefix)) return;
        const match = identifiers.find(idf => d.startsWith(idf));
        if (match) extraMap[match] += parseFloat(r.sum);
      });
      const gKey = identifiers[0] || 'gabi';
      const nKey = identifiers[1] || identifiers[0] || 'norf';
      const extraGabi = extraMap[gKey] || 0;
      const extraNorf = extraMap[nKey] || 0;
  // Wzór użytkownika:
  // SWG = BM/2 + (WDN - WDG)
  // SWN = BM/2 + (WDG - WDN)
  const halfBudget = budget/2;
  // Nowy wzór przekazany przez użytkownika (ponownie zaktualizowany):
  // SWG = BM/2 + (WDN - WDG)/2
  // SWN = BM/2 + (WDG - WDN)/2
  const diff = extraNorf - extraGabi; // WDN - WDG
  const gabiStart = +(halfBudget + diff/2).toFixed(2);
  const norfStart = +(halfBudget - diff/2).toFixed(2); // równoważne halfBudget + (WDG - WDN)/2
  res.json({ baseBudget: budget, previousMonth: prevId, previousMonthClosed: prev.is_closed, method: prev.is_closed ? 'previous_closed_adjusted_halfdiff' : 'previous_open_adjusted_halfdiff', identifiers, excludePrefix, extras: extraMap, gabi: gabiStart, norf: norfStart });
    } finally { client.release(); }
  } catch (e) {
    console.error('Błąd sugerowania początkowych wpływów:', e);
    res.status(500).json({ message: 'Błąd serwera', error: e.message });
  }
});

// Usuwanie istniejących wpływów początkowych (np. przed rekalkulacją)
router.delete('/:id/initial-incomes', async (req, res) => {
  try {
    const { id } = req.params;
    const prefix = (req.query.prefix || 'Wpływ początkowy').toString().toLowerCase();
    const client = await pool.connect();
    try {
      // Pobierz konta Gabi i Norf (jeśli istnieją)
      const accRes = await client.query("SELECT id,name FROM accounts WHERE name IN ('Gabi','Norf')");
      const accountIds = accRes.rows.map(r=>r.id);
      if (!accountIds.length) return res.json({ deleted:0 });
      const delRes = await client.query(`
        DELETE FROM transactions 
        WHERE month_id = $1 AND type='income' 
          AND account_id = ANY($2) 
          AND LOWER(description) LIKE $3 || '%'
        RETURNING id
      `,[id, accountIds, prefix]);
      res.json({ deleted: delRes.rows.length });
    } finally { client.release(); }
  } catch (e) {
    console.error('Błąd usuwania początkowych wpływów:', e);
    res.status(500).json({ message: 'Błąd serwera', error: e.message });
  }
});

// --- USUWANIE MIESIĄCA ---
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Sprawdź, czy miesiąc istnieje
      const checkResult = await client.query('SELECT * FROM months WHERE id = $1', [id]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: 'Nie znaleziono miesiąca o podanym ID' });
      }
      
      const month = checkResult.rows[0];
      
      // Sprawdź, czy miesiąc ma transakcje
      const transactionsCheck = await client.query(
        'SELECT COUNT(*) FROM transactions WHERE month_id = $1',
        [id]
      );
      
      if (parseInt(transactionsCheck.rows[0].count) > 0) {
        return res.status(400).json({
          message: 'Nie można usunąć miesiąca, który ma transakcje',
          transactionCount: parseInt(transactionsCheck.rows[0].count)
        });
      }
      
      // Usuń miesiąc
      await client.query('DELETE FROM months WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      res.json({ message: 'Miesiąc został pomyślnie usunięty', month });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Błąd podczas usuwania miesiąca:', error);
    res.status(500).json({ message: 'Błąd serwera podczas usuwania miesiąca', error: error.message });
  }
});


module.exports = router;
