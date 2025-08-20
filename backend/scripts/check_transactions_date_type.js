const pool = require('../db/pool');
(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT data_type, udt_name FROM information_schema.columns WHERE table_name='transactions' AND column_name='date'`);
    console.log('transactions.date column info:', res.rows[0]);
    const sample = await client.query('SELECT id, date FROM transactions ORDER BY id DESC LIMIT 5');
    console.log('Sample last 5 date values:');
    sample.rows.forEach(r => console.log(r));
  } catch(e){
    console.error(e);
  } finally { client.release(); process.exit(0);} 
})();
