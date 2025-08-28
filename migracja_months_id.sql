-- Migracja do unikalnych id miesięcy w formacie 'YYYY-MM'

-- 1. Dodaj nowe pole id_new tekstowe do months
ALTER TABLE months ADD COLUMN id_new VARCHAR(7);

-- 2. Uzupełnij id_new na podstawie roku i miesiąca
UPDATE months SET id_new = LPAD(year::text, 4, '0') || '-' || LPAD(month::text, 2, '0');

-- 3. Zmień klucz główny na id_new
ALTER TABLE months DROP CONSTRAINT months_pkey;
ALTER TABLE months ADD PRIMARY KEY (id_new);

-- 4. Zmień powiązania w transactions
ALTER TABLE transactions ALTER COLUMN month_id TYPE VARCHAR(7) USING (
  (SELECT id_new FROM months WHERE months.id = transactions.month_id)
);
ALTER TABLE transactions DROP CONSTRAINT transactions_month_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_month_id_fkey FOREIGN KEY (month_id) REFERENCES months(id_new);

-- 5. Usuń stare id, zamień id_new na id
ALTER TABLE months DROP COLUMN id;
ALTER TABLE months RENAME COLUMN id_new TO id;
