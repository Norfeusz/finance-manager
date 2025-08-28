const pool = require('../db/pool');
(async () => {
  const client = await pool.connect();
  try {
    const acc = await client.query("SELECT id FROM accounts WHERE name = 'KWNR'");
    const kwnrId = acc.rows[0]?.id;
    console.log('KWNR id:', kwnrId);
    const total = await client.query('SELECT count(*) FROM transactions');
    console.log('Transactions total:', total.rows[0].count);
    const byAcc = await client.query('SELECT count(*) FROM transactions WHERE account_id = $1', [kwnrId]);
    console.log('By account_id=KWNR:', byAcc.rows[0].count);
    const byCat = await client.query("SELECT count(*) FROM transactions t JOIN categories c ON t.category_id = c.id WHERE c.name = 'Wydatek KWNR'");
    console.log("By category 'Wydatek KWNR':", byCat.rows[0].count);
    const sample = await client.query(`SELECT t.id, t.type, t.amount, t.description, t.extra_description, t.date, a.name as account, c.name as category
      FROM transactions t
      LEFT JOIN accounts a ON a.id = t.account_id
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.account_id = $1 OR c.name = 'Wydatek KWNR'
      ORDER BY t.date DESC, t.id DESC LIMIT 10`, [kwnrId]);
    console.log('Sample rows:', sample.rows);
  } catch (e) { console.error(e); } finally { client.release(); process.exit(0); }
})();
