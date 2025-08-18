-- Tabela przechowująca stan początkowy kont oraz ich aktualne saldo
CREATE TABLE IF NOT EXISTS account_balances (
    id SERIAL PRIMARY KEY,
    account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
    initial_balance NUMERIC(12,2) DEFAULT 0 NOT NULL,
    current_balance NUMERIC(12,2) DEFAULT 0 NOT NULL,
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(account_id)
);
