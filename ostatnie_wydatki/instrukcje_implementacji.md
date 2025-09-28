# Instrukcje implementacji komponentów "Ostatnie transakcje"

## Przegląd
Te instrukcje pomogą ci zaimplementować funkcjonalność "Ostatnie transakcje" z filtrami i paginacją w projekcie "Manager Finansow" (JSX).

## Struktura projektu docelowego
- **Frontend**: React JSX (nie TSX) na porcie 3000
- **Backend**: Express.js na porcie 3002  
- **API endpoint**: `GET /api/transactions?month_id={monthId}`
- **Odpowiedź API**: Array transakcji lub obiekt `{transactions: [], balance: number}`

## Krok 1: Skopiuj pliki

### 1.1 Skopiuj komponenty
```bash
# Skopiuj do Manager Finansow/frontend/src/components/
RecentTransactions.jsx
TransactionsList.jsx
```

### 1.2 Skopiuj funkcje pomocnicze
```bash
# Utwórz katalog (jeśli nie istnieje):
Manager Finansow/frontend/src/utils/

# Skopiuj:
transactionUtils.js
```

### 1.3 Skopiuj style CSS
```bash
# Skopiuj do Manager Finansow/frontend/src/components/
RecentTransactions.css
TransactionsList.css
```

## Krok 2: Dostosuj ścieżki importów

### 2.1 W RecentTransactions.jsx
```jsx
// Zmień linię 2:
import TransactionsList from './TransactionsList'

// Dodaj import CSS (linia 3):
import './RecentTransactions.css'
```

### 2.2 W TransactionsList.jsx  
```jsx
// Zmień linię 2 na właściwą ścieżkę do utils:
import { getAccountDisplayName, getCategoryDisplayName, formatDate } from '../utils/transactionUtils'

// Dodaj import CSS (linia 3):
import './TransactionsList.css'
```

## Krok 3: Dostosuj funkcje pomocnicze

### 3.1 Edytuj transactionUtils.js
Dostosuj mapowania kont i kategorii do twojego projektu:

```js
// W funkcji getAccountDisplayName():
const accountMapping = {
    // Twoje mapowania kont - sprawdź jakie nazwy używasz w bazie danych
    'konto_glowne': 'Konto główne',
    'gotowka': 'Gotówka',
    // ... dodaj pozostałe
}

// W funkcji getCategoryDisplayName():
const categoryMapping = {
    // Twoje mapowania kategorii - sprawdź jakie nazwy używasz w bazie danych  
    'zakupy_codzienne': 'Zakupy codzienne',
    // ... dodaj pozostałe
}
```

## Krok 4: Zintegruj z App.jsx

### 4.1 Dodaj import w App.jsx
```jsx
import RecentTransactions from './components/RecentTransactions'
```

### 4.2 Dodaj funkcje obsługi (jeśli nie istnieją)
```jsx
// Funkcja edycji transakcji
const handleEditTransaction = (id) => {
    console.log('Edytuj transakcję:', id)
    // Implementuj logikę edycji
}

// Funkcja usuwania transakcji  
const handleDeleteTransaction = (id) => {
    if (window.confirm('Czy na pewno chcesz usunąć tę transakcję?')) {
        console.log('Usuń transakcję:', id)
        // Implementuj logikę usuwania
    }
}
```

### 4.3 Dodaj komponent do renderowania
```jsx
// W return statement App.jsx, dodaj:
<RecentTransactions
    transactions={transactions}
    onEdit={handleEditTransaction}
    onDelete={handleDeleteTransaction}
/>
```

## Krok 5: Sprawdź format danych transakcji

### 5.1 Wymagana struktura transakcji
```js
const transaction = {
    id: number,              // Wymagane dla edycji/usuwania
    amount: number,          // Kwota transakcji
    description: string,     // Opis transakcji
    account: string,         // Nazwa konta
    type: string,           // 'income'|'expense'|'transfer'|'debt'
    category: string,       // Opcjonalne - kategoria
    date: string           // Format YYYY-MM-DD lub DD.MM.YYYY
}
```

### 5.2 Sprawdź odpowiedź API
Upewnij się, że API zwraca dane w odpowiednim formacie:

```js
// Opcja 1: Bezpośrednio array
GET /api/transactions → Transaction[]

// Opcja 2: Obiekt z tablicą
GET /api/transactions → { transactions: Transaction[], balance?: number }
```

## Krok 6: Testowanie

### 6.1 Sprawdź działanie filtrów
- [ ] Filtr po typie transakcji
- [ ] Filtr po zakresie dat  
- [ ] Wyszukiwarka po opisie
- [ ] Własny zakres dat

### 6.2 Sprawdź paginację
- [ ] Ładuj więcej/mniej transakcji
- [ ] Kontrola liczby elementów na stronie
- [ ] Reset paginacji przy zmianie filtrów

### 6.3 Sprawdź funkcje CRUD
- [ ] Edycja transakcji (przycisk ✏️)
- [ ] Usuwanie transakcji (przycisk 🗑️)
- [ ] Wyświetlanie transakcji

## Krok 7: Stylowanie (opcjonalne)

### 7.1 Dostosuj kolory/style
Edytuj pliki CSS aby dopasować do twojego designu:
- `RecentTransactions.css` - filtry i paginacja
- `TransactionsList.css` - lista transakcji

### 7.2 Responsive design
Style zawierają breakpointy responsive - sprawdź na różnych rozdzielczościach.

## Rozwiązywanie problemów

### Problem: Błędy importów
```bash
# Sprawdź ścieżki:
- Czy utils/transactionUtils.js istnieje?
- Czy ścieżki są względne do lokalizacji pliku?
```

### Problem: Brak danych
```bash
# Sprawdź:
- Czy transactions jest przekazywane jako prop?
- Czy API zwraca dane w oczekiwanym formacie?
- Sprawdź konsole deweloperską (F12)
```

### Problem: Style nie działają
```bash
# Sprawdź:
- Czy pliki CSS są zaimportowane?
- Czy nazwy klas CSS się zgadzają?
- Sprawdź czy CSS nie jest nadpisywany przez inne style
```

### Problem: Filtry nie działają
```bash
# Sprawdź:
- Czy pola date, type, description istnieją w transakcjach?
- Czy daty są w odpowiednim formacie?
- Sprawdź konsole deweloperską pod kątem błędów JavaScript
```

## Dodatkowe funkcje (opcjonalne)

### Export do CSV/Excel
```jsx
// Można dodać funkcję eksportu w RecentTransactions.jsx
const exportTransactions = () => {
    const csv = filteredTransactions.map(t => 
        `${t.date},${t.description},${t.type},${t.amount}`
    ).join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transactions.csv'
    a.click()
}
```

### Sortowanie po kolumnach
```jsx
// Można dodać sortowanie klikając w nagłówki kolumn
const [sortField, setSortField] = useState('date')
const [sortDirection, setSortDirection] = useState('desc')
```

## Wsparcie
Jeśli napotkasz problemy:
1. Sprawdź konsole deweloperską (F12)
2. Upewnij się, że wszystkie pliki zostały skopiowane
3. Sprawdź czy ścieżki importów są prawidłowe
4. Zweryfikuj format danych z API