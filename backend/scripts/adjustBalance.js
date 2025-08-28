// Adjust current_balance for a given account by a delta (can be negative)
// Usage: node backend/scripts/adjustBalance.js --account "Wspólne" --delta -4272.21

const pool = require('../db/pool');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--account' || a === '-a') { out.account = args[++i]; }
    else if (a === '--delta' || a === '-d') { out.delta = Number(String(args[++i]).replace(',', '.')); }
  }
  return out;
}

(async () => {
  const { account, delta } = parseArgs();
  if (!account || !isFinite(delta)) {
    console.error('Użycie: node backend/scripts/adjustBalance.js --account "Wspólne" --delta -4272.21');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const accRes = await client.query('SELECT id FROM accounts WHERE name = $1', [account]);
    if (!accRes.rows.length) {
      throw new Error(`Nie znaleziono konta: ${account}`);
    }
    const accountId = accRes.rows[0].id;
    const beforeRes = await client.query('SELECT current_balance FROM account_balances WHERE account_id = $1', [accountId]);
    if (!beforeRes.rows.length) {
      throw new Error(`Brak rekordu salda dla konta: ${account} (id=${accountId})`);
    }
    const before = Number(beforeRes.rows[0].current_balance);
    const upd = await client.query(
      `UPDATE account_balances SET current_balance = current_balance + $1, last_updated = NOW() WHERE account_id = $2 RETURNING current_balance`,
      [delta, accountId]
    );
    const after = Number(upd.rows[0].current_balance);
    await client.query('COMMIT');
    console.log(JSON.stringify({ account, before, delta, after }, null, 2));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Błąd modyfikacji salda:', e.message);
    process.exitCode = 2;
  } finally {
    client.release();
  }
})();
