-- Tabela przechowująca stan początkowy kont oraz ich aktualne saldo
CREATE TABLE IF NOT EXISTS account_balances (
    id SERIAL PRIMARY KEY,
    account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
    initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
    current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(account_id)
);

-- Wstawianie początkowych stanów kont zgodnie z wymaganiami
INSERT INTO account_balances (account_id, initial_balance, current_balance)
SELECT id, 
    CASE 
        WHEN name = 'Wspólne' THEN 85.65
        WHEN name = 'Oszczędnościowe' THEN 970.71
        WHEN name = 'Gotówka' THEN 0
        WHEN name = 'Rachunki' THEN 0
        WHEN name = 'KWNR' THEN 0
        ELSE 0
    END AS initial_balance,
    CASE 
        WHEN name = 'Wspólne' THEN 85.65
        WHEN name = 'Oszczędnościowe' THEN 970.71
        WHEN name = 'Gotówka' THEN 0
        WHEN name = 'Rachunki' THEN 0
        WHEN name = 'KWNR' THEN 0
        ELSE 0
    END AS current_balance
FROM accounts
WHERE name IN ('Wspólne', 'Gotówka', 'Oszczędnościowe', 'Rachunki', 'KWNR')
ON CONFLICT (account_id) DO NOTHING;

-- Dodaj indeks dla wydajności
CREATE INDEX IF NOT EXISTS idx_account_balances_account ON account_balances(account_id);
