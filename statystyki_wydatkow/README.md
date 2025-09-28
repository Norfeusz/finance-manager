# Transfer Statystyk Wydatków - Manager Finansów

Ten pakiet zawiera kompletną funkcjonalność statystyk wydatków z nawigacją między miesiąca### Różnice od Oryginalnego Projektu

### System Kategorii
- **Kategorie główne**: auta, dom, wyjścia i szama do domu, pies, prezenty, wyjazdy, rachunki, subkonta
- **Podkategorie**: jedzenie, słodycze, chemia, apteka, alkohol, higiena, kwiatki, zakupy (dla zakupów codziennych)
- **Suma 'ZC'**: automatycznie obliczana suma wszystkich podkategorii zakupów codziennych
- **Dynamiczne dodawanie**: możliwość dodawania nowych kategorii głównych i podkategorii
- Inicjalizacja pobiera dane z `categories` i `subcategories` połączonych z `transactions`ednimi i zarządzaniem kategoriami, przygotowaną do transferu z głównego projektu do projektu współdzielonego z Gabi.

## Zawartość Pakietu

### 1. Backend API Routes
**Plik:** `expenseStatisticsRoutes.js`
- Kompletne API REST dla statystyk wydatków
- 8 głównych endpointów:
  - `GET /:monthId` - pobranie statystyk dla miesiąca
  - `POST /` - utworzenie/aktualizacja statystyki
  - `PATCH /:id/status` - zmiana statusu otwarte/zamknięte
  - `DELETE /:id` - usunięcie statystyki
  - `POST /initialize` - inicjalizacja statystyk na podstawie transakcji
  - `GET /averages` - pobranie średnich dla wszystkich kategorii
  - `GET /category/:categoryName/details` - szczegóły konkretnej kategorii
  - `PATCH /month/:monthId/toggle-all` - przełączenie wszystkich statusów

### 2. Frontend Component
**Plik:** `ExpenseStatisticsModal.tsx`
- Kompletny modal React z TypeScript
- Funkcjonalności:
  - Nawigacja między miesiącami (← / →)
  - Wyświetlanie podsumowania (suma, liczba otwartych/zamkniętych)
  - Edycja kwot bezpośrednio w liście (klik na kwotę)
  - Przełączanie statusów kategori (otwarte/zamknięte)
  - Dodawanie nowych kategorii
  - Usuwanie kategorii
  - Inicjalizacja statystyk na podstawie transakcji
  - Akcje globalne (otwórz/zamknij wszystkie)

### 3. Stylowanie CSS
**Plik:** `ExpenseStatisticsModal.scss`
- Kompletne style SCSS
- Responsywny design
- Różne kolory dla statusów (zielony = otwarte, czerwony = zamknięte)
- Animacje i przejścia
- Mobile-first approach

## Wymagania Systemowe

### Struktura Bazy Danych
Tabela `expense_statistics` powinna mieć następujące kolumny:
```sql
CREATE TABLE expense_statistics (
    id SERIAL PRIMARY KEY,
    month_id INTEGER NOT NULL REFERENCES months(id),
    category_section VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0,
    is_open BOOLEAN DEFAULT true,
    last_edited TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month_id, category_section)
);
```

### Dostosowanie do Struktury Kategorii
System jest przygotowany do pracy z kategoriami głównymi + podkategoriami zakupów codziennych:
- **Kategorie główne**: auta, dom, wyjścia i szama do domu, pies, prezenty, wyjazdy, rachunki, subkonta
- **Podkategorie zakupów codziennych**: jedzenie, słodycze, chemia, apteka, alkohol, higiena, kwiatki, zakupy
- **Specjalna kategoria 'ZC'**: suma wszystkich podkategorii zakupów codziennych
- `category_section` przechowuje nazwę kategorii lub podkategorii
- Funkcja inicjalizacji automatycznie tworzy wszystkie kategorie i podkategorie
- System rozróżnia wizualnie kategorie główne od podkategorii

### Zależności
- React z TypeScript
- SCSS/Sass do stylowania
- Backend z Express.js i PostgreSQL
- Connection pool dla bazy danych

## Instrukcja Instalacji

### 1. Backend
```bash
# Dodaj routes do głównego pliku serwera (app.js lub server.js)
app.use('/api/expense-statistics', require('./routes/expenseStatisticsRoutes'))
```

### 2. Frontend
```bash
# Skopiuj pliki do odpowiednich katalogów
# ExpenseStatisticsModal.tsx -> src/components/
# ExpenseStatisticsModal.scss -> src/components/ lub src/styles/
```

### 3. Konfiguracja
```typescript
// Upewnij się, że API_URL jest ustawione w zmiennych środowiskowych
// REACT_APP_API_URL=http://localhost:3001
```

## Użycie Komponentu

```typescript
import ExpenseStatisticsModal from './components/ExpenseStatisticsModal'

// W komponencie rodzica
const [showStatistics, setShowStatistics] = useState(false)
const [activeMonth, setActiveMonth] = useState<number | null>(null)
const [monthName, setMonthName] = useState('')

// Obsługa nawigacji między miesiącami
const handleMonthChange = (direction: 'prev' | 'next') => {
  // Logika zmiany miesiąca
}

// Renderowanie
<ExpenseStatisticsModal
  isVisible={showStatistics}
  onClose={() => setShowStatistics(false)}
  activeMonth={activeMonth}
  monthName={monthName}
  onMonthChange={handleMonthChange}
/>
```

## Funkcjonalności

### Nawigacja Miesiącami
- Strzałki ← / → do przechodzenia między miesiącami
- Automatyczne ładowanie danych po zmianie miesiąca
- Wyświetlanie nazwy miesiąca w nagłówku

### Zarządzanie Statystykami
- **Edycja kwot:** Klik na kwotę → edycja inline → Enter/Esc lub przyciski
- **Status kategorii:** Przycisk "Otwarte"/"Zamknięte" dla każdej kategorii
- **Dodawanie kategorii:** Przycisk "+ Dodaj Kategorię" → wybór typu (główna/podkategoria) → formularz
- **Grupowanie:** Kategorie główne i podkategorie zakupów codziennych w osobnych sekcjach
- **Wizualne rozróżnienie:** Różne kolory dla kategorii głównych, podkategorii i sumy 'ZC'
- **Usuwanie:** Przycisk 🗑️ z potwierdzeniem

### Akcje Globalne
- **Inicjalizuj:** Tworzy statystyki na podstawie transakcji z miesiąca
- **Otwórz Wszystkie:** Ustawia wszystkie kategorie jako otwarte
- **Zamknij Wszystkie:** Ustawia wszystkie kategorie jako zamknięte

### Podsumowanie
- Suma kwot z otwartych kategorii
- Liczba otwartych kategorii
- Liczba zamkniętych kategorii

## Różnice od Oryginalnego Projektu

### Kategorie
- System uwzględnia strukturę: kategoria główna + podkategorie
- `category_section` przechowuje nazwę kategorii głównej
- Inicjalizacja pobiera kategorie z tabeli `categories` połączonej z `transactions`

### Baza Danych
- Statystyki przechowywane w tabeli `expense_statistics`
- Powiązanie przez `month_id` z tabelą `months`
- Możliwość przechowywania historii edycji (`last_edited`)

### API
- Wszystkie operacje przez REST API
- Obsługa błędów i walidacja danych
- Connection pooling dla wydajności

## Testowanie

### Backend Endpoints
```bash
# Pobierz statystyki dla miesiąca
GET /api/expense-statistics/1

# Utwórz/zaktualizuj statystykę
POST /api/expense-statistics
{
  "monthId": 1,
  "categorySection": "zakupy codzienne",
  "amount": 1500.50
}

# Zmień status
PATCH /api/expense-statistics/1/status
{
  "isOpen": false
}

# Inicjalizuj statystyki
POST /api/expense-statistics/initialize
{
  "monthId": 1
}
```

### Frontend
- Sprawdź nawigację między miesiącami
- Testuj edycję kwot (inline editing)
- Sprawdź przełączanie statusów
- Testuj dodawanie/usuwanie kategorii
- Sprawdź responsywność na mobile

## Rozwiązywanie Problemów

### Błąd: "Cannot find module 'react'"
- Upewnij się, że component znajduje się w projekcie React z TypeScript
- Sprawdź czy wszystkie dependencies są zainstalowane

### Błąd: "API_URL is undefined"
- Dodaj `REACT_APP_API_URL` do pliku `.env`
- Zrestartuj serwer development po dodaniu zmiennej

### Brak danych statystyk
- Sprawdź czy tabela `expense_statistics` istnieje
- Użyj przycisku "Inicjalizuj Statystyki"
- Sprawdź logi backend'u pod kątem błędów SQL

### Problemy z nawigacją
- Upewnij się, że funkcja `onMonthChange` jest prawidłowo zaimplementowana
- Sprawdź czy `activeMonth` i `monthName` są aktualizowane

## Integracja z Istniejącym Systemem

### Zastąpienie ShoppingStats
1. Backup istniejącego `ShoppingStats.jsx`
2. Skopiuj nowy `ExpenseStatisticsModal.tsx`
3. Zaktualizuj importy w komponencie rodzica
4. Dostosuj props do nowego interfejsu
5. Testuj wszystkie funkcjonalności

### Migracja Danych
Jeśli istniejące dane są w localStorage:
```javascript
// Skrypt migracji danych z localStorage do bazy
const migrateLocalStorageToDatabase = async () => {
  const localData = JSON.parse(localStorage.getItem('expenseStats') || '{}')
  // Konwertuj i wyślij do API
  for (const [month, stats] of Object.entries(localData)) {
    // POST /api/expense-statistics dla każdej statystyki
  }
}
```

## Wsparcie i Rozwój

### Planowane Ulepszenia
- Wykresy i wizualizacje statystyk
- Export do CSV/PDF
- Porównanie między miesiącami
- Analiza trendów i średnich
- Powiadomienia o przekroczeniach budżetu

### Zgłaszanie Błędów
- Sprawdź console przeglądarki pod kątem błędów JavaScript
- Sprawdź logi serwera backend pod kątem błędów SQL
- Sprawdź network tab w dev tools pod kątem błędów API

---

*Package przygotowany do transferu funkcjonalności statystyk wydatków z głównego projektu Manager Finansów do projektu współdzielonego z Gabi.*