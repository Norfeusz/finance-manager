-- Skrypt SQL do utworzenia bazy dla managera finansów z obsługą miesięcy, kont, kategorii i podkategorii

CREATE TABLE months (
    id SERIAL PRIMARY KEY,
    year INT NOT NULL,
    month INT NOT NULL,
    label VARCHAR(32),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE subcategories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    category_id INT REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, name)
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    month_id INT REFERENCES months(id) ON DELETE CASCADE,
    account_id INT REFERENCES accounts(id),
    category_id INT REFERENCES categories(id),
    subcategory_id INT REFERENCES subcategories(id),
    type VARCHAR(16) NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount NUMERIC(12,2) NOT NULL,
    description VARCHAR(255),
    extra_description VARCHAR(255),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Przykładowe indeksy dla wydajności
CREATE INDEX idx_transactions_month ON transactions(month_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_subcategory ON transactions(subcategory_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);

-- Przykładowe dane startowe
INSERT INTO accounts (name) VALUES ('Wspólne'), ('Gotówka'), ('Oszczędnościowe'), ('Rachunki'), ('KWNR');
INSERT INTO categories (name) VALUES ('Zakupy codzienne'), ('Opłaty'), ('Rozrywka'), ('Transport'), ('Zdrowie'), ('Inne');

INSERT INTO subcategories (name, category_id) VALUES ('Jedzenie', 1), ('Chemia', 1), ('Dziecko', 1);

-- Tabela na archiwalne statystyki miesięczne
CREATE TABLE archived_statistics (
    id SERIAL PRIMARY KEY,
    year INT NOT NULL,
    month INT NOT NULL,
    category VARCHAR(64) NOT NULL,
    subcategory VARCHAR(64),
    amount NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
