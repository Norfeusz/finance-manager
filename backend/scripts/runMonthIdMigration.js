// Skrypt idempotentnej migracji month_id -> 'YYYY-MM' bez potrzeby psql.
// Uruchom: npm run migrate:monthid
// Działa także jeśli migracja była częściowo wykonana.

const pool = require('../db/pool');

async function getColType(client, table, col) {
  const { rows } = await client.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, col]
  );
  return rows[0]?.data_type || null;
}

async function columnExists(client, table, col) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, col]
  );
  return rows.length > 0;
}

async function getPrimaryKeyConstraint(client, table) {
  const { rows } = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = $1::regclass AND contype = 'p'
  `, [table]);
  return rows[0]?.conname || null;
}

async function getForeignKeys(client, table) {
  const { rows } = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = $1::regclass AND contype = 'f'
  `, [table]);
  return rows;
}

// Klucze obce INNYCH tabel wskazujące na podaną tabelę (referencing fks)
async function getReferencingForeignKeys(client, referencedTable) {
  const { rows } = await client.query(`
    SELECT conname,
           conrelid::regclass AS table_name,
           pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = $1::regclass
  `, [referencedTable]);
  return rows;
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('== Start migracji month_id (int -> YYYY-MM) ==');
    await client.query('BEGIN');

    const monthsIdType = await getColType(client, 'months', 'id');
    if (!monthsIdType) throw new Error('Tabela months.id nie istnieje');

    if (monthsIdType === 'character varying') {
      console.log('Months.id jest już VARCHAR – migracja pominięta.');
      await client.query('ROLLBACK');
      return;
    }

    // 1. Dodaj id_new jeśli brak
    const hasIdNew = await columnExists(client, 'months', 'id_new');
    if (!hasIdNew) {
      console.log('Dodaję months.id_new ...');
      await client.query('ALTER TABLE months ADD COLUMN id_new VARCHAR(7)');
      await client.query(`UPDATE months SET id_new = LPAD(year::text,4,'0') || '-' || LPAD(month::text,2,'0')`);
    } else {
      console.log('Kolumna id_new już istnieje.');
    }

    // 2. Primary key – jeśli PK nie jest na id_new to zmieniamy
    const pkName = await getPrimaryKeyConstraint(client, 'months');
    if (pkName) {
      // Jeśli PK jeszcze nie na id_new – trzeba go zmienić; wcześniej usuwamy FKs wskazujące na months
      const { rows: pkCols } = await client.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'months'::regclass AND i.indisprimary
      `);
      const pkIsOnIdNew = pkCols.some(r => r.attname === 'id_new');
      if (!pkIsOnIdNew) {
        const refFks = await getReferencingForeignKeys(client, 'months');
        for (const fk of refFks) {
          console.log(`Usuwam zależny FK ${fk.conname} z tabeli ${fk.table_name}`);
          await client.query(`ALTER TABLE ${fk.table_name} DROP CONSTRAINT ${fk.conname}`);
        }
        console.log(`Usuwam stary PK ${pkName} ...`);
        await client.query(`ALTER TABLE months DROP CONSTRAINT ${pkName}`);
        await client.query('ALTER TABLE months ADD PRIMARY KEY (id_new)');
      } else {
        console.log('Primary key już na id_new.');
      }
    } else {
      console.log('Brak PK – dodaję na id_new');
      await client.query('ALTER TABLE months ADD PRIMARY KEY (id_new)');
    }

    // 3. Transactions – jeśli month_id jest integer to przepisujemy
    const transMonthType = await getColType(client, 'transactions', 'month_id');
    if (transMonthType && transMonthType !== 'character varying') {
      console.log('Migracja transactions.month_id -> varchar...');
      const fks = await getForeignKeys(client, 'transactions');
      for (const fk of fks) {
        if (fk.def.includes('(month_id)')) {
          console.log('Usuwam FK', fk.conname);
          await client.query(`ALTER TABLE transactions DROP CONSTRAINT ${fk.conname}`);
        }
      }
      const hasTmp = await columnExists(client, 'transactions', 'month_id_new');
      if (!hasTmp) {
        await client.query('ALTER TABLE transactions ADD COLUMN month_id_new VARCHAR(7)');
      }
      await client.query(`UPDATE transactions t SET month_id_new = m.id_new FROM months m WHERE t.month_id = m.id`);
      await client.query('ALTER TABLE transactions DROP COLUMN month_id');
      await client.query('ALTER TABLE transactions RENAME COLUMN month_id_new TO month_id');
      await client.query('ALTER TABLE transactions ADD CONSTRAINT transactions_month_id_fkey FOREIGN KEY (month_id) REFERENCES months(id_new) ON DELETE CASCADE');
    } else if (transMonthType === 'character varying') {
      console.log('transactions.month_id już jest VARCHAR – pomijam.');
    } else {
      console.log('Kolumna transactions.month_id nie istnieje – pomijam.');
    }

    // 4. Zamiana id_new -> id (zachowując stare id jako id_old) jeśli jeszcze nie
    const stillInt = await getColType(client, 'months', 'id');
    if (stillInt === 'integer') {
      const hasIdOld = await columnExists(client, 'months', 'id_old');
      if (!hasIdOld) {
        console.log('Przemianowanie columns id -> id_old, id_new -> id');
        await client.query('ALTER TABLE months RENAME COLUMN id TO id_old');
        await client.query('ALTER TABLE months RENAME COLUMN id_new TO id');
      }
    }

    // 5. Final: upewnij się, że PK jest na (id)
    const finalType = await getColType(client, 'months', 'id');
    if (finalType === 'character varying') {
      const pk2 = await getPrimaryKeyConstraint(client, 'months');
      if (pk2) {
        // sprawdź czy pk obejmuje column id (po rename)
        const { rows: pkCols2 } = await client.query(`
          SELECT a.attname
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = 'months'::regclass AND i.indisprimary
        `);
        const onId = pkCols2.some(r => r.attname === 'id');
        if (!onId) {
          console.log('Przenoszę PK na kolumnę id');
          await client.query(`ALTER TABLE months DROP CONSTRAINT ${pk2}`);
          await client.query('ALTER TABLE months ADD PRIMARY KEY (id)');
        }
      } else {
        console.log('Dodaję PK na id');
        await client.query('ALTER TABLE months ADD PRIMARY KEY (id)');
      }
    }

    await client.query('COMMIT');
    console.log('== Migracja zakończona (idempotent) ==');
  } catch (err) {
    console.error('Błąd migracji -> ROLLBACK:', err.message);
    try { await client.query('ROLLBACK'); } catch {}
  } finally {
    client.release();
    await pool.end();
  }
}

run();
