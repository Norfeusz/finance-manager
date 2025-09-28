# Prompt dla Agenta - Transfer Statystyk Wydatków

## Kontekst
Potrzebuję zintegrować zaawansowane statystyki wydatków z głównego projektu "Manager Finansów - Norf" do tego projektu współdzielonego z Gabi. Mam przygotowany kompletny pakiet transferu z dostosowaniami do naszej struktury kategorii.

## Zadanie
Zastąp istniejący komponent `ShoppingStats.jsx` nowym zaawansowanym systemem statystyk `ExpenseStatisticsModal` z następującymi funkcjonalnościami:

### Kluczowe Funkcjonalności do Implementacji:
1. **Nawigacja między miesiącami** - strzałki ← / → w nagłówku modala
2. **Edycja kwot inline** - kliknięcie na kwotę umożliwia edycję bezpośrednio w liście  
3. **Grupowanie kategorii** - podział na "Kategorie Główne" i "Zakupy Codzienne"
4. **Zarządzanie statusami** - otwarte/zamknięte kategorie z wizualnym rozróżnieniem
5. **Dynamiczne dodawanie** - nowe kategorie główne i podkategorie zakupów codziennych
6. **Inicjalizacja automatyczna** - tworzenie statystyk na podstawie danych z bazy
7. **Akcje globalne** - otwórz/zamknij wszystkie, inicjalizuj statystyki

### Struktura Kategorii:
- **Kategorie główne**: auta, dom, wyjścia i szama do domu, pies, prezenty, wyjazdy, rachunki, subkonta
- **Podkategorie zakupów codziennych**: jedzenie, słodycze, chemia, apteka, alkohol, higiena, kwiatki, zakupy  
- **Suma ZC**: automatycznie obliczana suma wszystkich podkategorii zakupów codziennych

## Pliki do Zaimplementowania:

### 1. Backend Routes
Stwórz plik `/backend/routes/expenseStatisticsRoutes.js` z następującymi endpointami:
- `GET /:monthId` - pobranie statystyk dla miesiąca
- `POST /` - utworzenie/aktualizacja statystyki
- `PATCH /:id/status` - zmiana statusu otwarte/zamknięte
- `DELETE /:id` - usunięcie statystyki
- `POST /initialize` - inicjalizacja statystyk z transakcji
- `GET /averages` - średnie dla wszystkich kategorii
- `PATCH /month/:monthId/toggle-all` - przełączenie wszystkich statusów

### 2. Frontend Component  
Stwórz komponent `/frontend/src/components/ExpenseStatisticsModal.jsx` z:
- TypeScript interfaces dla ExpenseStatistic
- React hooks dla stanu komponentu
- Funkcje API calls do backend endpoints
- Renderowanie w grupach (kategorie główne / podkategorie)
- Formularz dodawania z wyborem typu kategorii

### 3. Stylowanie
Stwórz plik styles z:
- Responsive design mobile-first
- Kolorowe rozróżnienie statusów (zielony=otwarte, czerwony=zamknięte)
- Grupowanie wizualne kategorii
- Animacje przejść i hover effects

### 4. Tabela Bazy Danych
Upewnij się że tabela `expense_statistics` ma strukturę:
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

## Wymagania Techniczne:

### API Integration
- Użyj istniejącego API_BASE_URL z `/src/config/api.js`
- Zastosuj connection pooling dla wydajności
- Dodaj error handling i walidację danych
- Kompatybilność z istniejącą strukturą `months` i `transactions`

### Komponent Integration  
- Zachowaj istniejące props interface z komponentu rodzica
- Użyj useState i useCallback dla optymalizacji
- Implementuj cleanup w useEffect
- Dodaj accessibility (aria-labels, keyboard navigation)

### Migracja Danych
Jeśli potrzebna migracja z localStorage:
```javascript
// Skrypt migracji istniejących danych ShoppingStats
const migrateFromLocalStorage = async () => {
  const oldStats = JSON.parse(localStorage.getItem('shoppingStats') || '{}')
  // Konwertuj i wyślij do nowego API
}
```

## Instrukcje Implementacji:

### Krok 1: Backend
1. Utwórz routes file z kompletnymi endpoints
2. Dodaj routes do głównego app.js: `app.use('/api/expense-statistics', expenseStatisticsRoutes)`
3. Przetestuj endpoints przez Postman/curl

### Krok 2: Frontend  
1. Utwórz nowy komponent ExpenseStatisticsModal
2. Dodaj stylowanie SCSS z responsive design
3. Zintegruj z istniejącym parent component

### Krok 3: Testowanie
1. Sprawdź nawigację między miesiącami
2. Testuj edycję inline kwot
3. Sprawdź dodawanie nowych kategorii
4. Testuj inicjalizację statystyk
5. Sprawdź responsywność na mobile

### Krok 4: Czystka
1. Backup istniejącego ShoppingStats.jsx
2. Usuń nieużywane imports i dependencies
3. Sprawdź czy wszystkie funkcjonalności działają

## Oczekiwane Rezultaty:

### User Experience
- Intuicyjna nawigacja między miesiącami
- Szybka edycja kwot bez dodatkowych modali
- Przejrzyste grupowanie kategorii głównych i podkategorii  
- Responsywny design działający na wszystkich urządzeniach

### Performance
- Szybkie ładowanie danych z cache
- Optymalizowane re-renders przez useCallback
- Efektywne API calls z error handling

### Maintainability  
- Czytelny kod z TypeScript types
- Komponentowa architektura
- Łatwe dodawanie nowych kategorii
- Dokumentacja w komentarzach

## Dodatkowe Informacje:
- Zachowaj kompatybilność z istniejącym systemem miesięcy
- Uwzględnij różne waluty jeśli są używane (PLN/EUR)
- Dodaj loading states dla lepszego UX
- Implementuj debouncing dla search/filter jeśli potrzebne

**Cel: Zastąpić prosty ShoppingStats zaawansowanym systemem zarządzania statystykami wydatków z pełną funkcjonalnością CRUD, grupowaniem kategorii i nawigacją miesięczną.**