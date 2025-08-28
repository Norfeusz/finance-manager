const pool = require('../db/pool');
(async ()=>{
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const ensureMonth = async (id) => {
      const [y,m] = id.split('-');
      const label = new Intl.DateTimeFormat('pl-PL',{month:'long',year:'numeric'}).format(new Date(Number(y), Number(m)-1, 1));
      const r = await c.query('SELECT id FROM months WHERE id=$1',[id]);
      if(!r.rows.length){
        await c.query('INSERT INTO months (id,year,month,label,is_closed) VALUES ($1,$2,$3,$4,false)', [id, Number(y), Number(m), label]);
        console.log('Created month', id);
      } else {
        console.log('Month exists', id);
      }
    };
    await ensureMonth('2025-04');
    await ensureMonth('2025-06');
    await ensureMonth('2025-08');

    const acc = await c.query("SELECT id FROM accounts WHERE name='KWNR'");
    if(!acc.rows.length) throw new Error('Brak konta KWNR');
    const kwnrId = acc.rows[0].id;
    const cat = await c.query("SELECT id FROM categories WHERE name='Wydatek KWNR'");
    if(!cat.rows.length) throw new Error("Brak kategorii 'Wydatek KWNR'");
    const catId = cat.rows[0].id;

    // Current balance
    const balR = await c.query('SELECT id,current_balance FROM account_balances WHERE account_id=$1',[kwnrId]);
    if(!balR.rows.length){
      await c.query('INSERT INTO account_balances (account_id, initial_balance, current_balance) VALUES ($1,0,0)', [kwnrId]);
    }
    const getBal = async ()=> Number((await c.query('SELECT current_balance FROM account_balances WHERE account_id=$1',[kwnrId])).rows[0].current_balance);

    // Insert two historical KWNR expenses
    const addExpense = async (monthId, date, amount, desc, who) => {
      const newBal = (await getBal()) - amount;
      const ins = await c.query(
        `INSERT INTO transactions (month_id, account_id, category_id, type, amount, description, extra_description, date, balance_after)
         VALUES ($1,$2,$3,'expense',$4,$5,$6,$7::date,$8)
         RETURNING id`, [monthId, kwnrId, catId, amount, desc, who, date, newBal]
      );
      await c.query('UPDATE account_balances SET current_balance = $2, last_updated = NOW() WHERE account_id = $1', [kwnrId, newBal]);
      console.log('Inserted expense', ins.rows[0].id, monthId, amount, desc, who);
    };

    // Insert one income to KWNR
    const addIncome = async (monthId, date, amount, desc) => {
      const newBal = (await getBal()) + amount;
      const ins = await c.query(
        `INSERT INTO transactions (month_id, account_id, type, amount, description, date, balance_after)
         VALUES ($1,$2,'income',$3,$4,$5::date,$6)
         RETURNING id`, [monthId, kwnrId, amount, desc, date, newBal]
      );
      await c.query('UPDATE account_balances SET current_balance = $2, last_updated = NOW() WHERE account_id = $1', [kwnrId, newBal]);
      console.log('Inserted income', ins.rows[0].id, monthId, amount, desc);
    };

    await addExpense('2025-04', '2025-04-15', 120.00, 'Opony', 'Gabi');
    await addExpense('2025-06', '2025-06-05', 85.50, 'Przegląd auta', 'Norf');
    await addIncome('2025-08', '2025-08-10', 500.00, 'Wpływ z: Wspólne');

    await c.query('COMMIT');
    console.log('KWNR sample seeded.');
  } catch(e){
    await c.query('ROLLBACK');
    console.error('Seed error:', e.message);
  } finally { c.release(); }
})();
