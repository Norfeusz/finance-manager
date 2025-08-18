-- Tabela przechowująca stan początkowy kont oraz ich aktualne saldo
CREATE TABLE account_balances (
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
CREATE INDEX idx_account_balances_account ON account_balances(account_id);

-- Funkcja do aktualizacji salda konta przy dodawaniu nowych transakcji
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $func$
BEGIN
    IF NEW.type = 'income' THEN
        -- Wpływ - zwiększa saldo konta
        UPDATE account_balances 
        SET current_balance = current_balance + NEW.amount,
            last_updated = NOW()
        WHERE account_id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
        -- Wydatek - zmniejsza saldo konta
        UPDATE account_balances 
        SET current_balance = current_balance - NEW.amount,
            last_updated = NOW()
        WHERE account_id = NEW.account_id;
    ELSIF NEW.type = 'transfer' THEN
        -- Transfer - obsługa w osobnym triggerze
        NULL;
    END IF;
    
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_account_balance
AFTER INSERT ON transactions
FOR EACH ROW
WHEN (NEW.type IN ('income', 'expense'))
EXECUTE FUNCTION update_account_balance();
