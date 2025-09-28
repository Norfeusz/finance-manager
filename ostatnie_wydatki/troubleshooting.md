# Troubleshooting - Rozwiązywanie problemów

## 🚨 Najczęstsze problemy i ich rozwiązania

### 1. Błędy importów

#### Problem: `Cannot resolve module './TransactionsList'`
```
Module not found: Error: Can't resolve './TransactionsList' in 'src/components'
```

**Rozwiązanie:**
- Sprawdź czy plik `TransactionsList.jsx` istnieje w katalogu `src/components/`
- Upewnij się, że nazwa pliku jest dokładnie `TransactionsList.jsx` (zwróć uwagę na wielkość liter)
- Sprawdź czy ścieżka import jest prawidłowa: `import TransactionsList from './TransactionsList'`

#### Problem: `Cannot resolve module '../utils/transactionUtils'`
**Rozwiązanie:**
- Utwórz katalog `src/utils/` jeśli nie istnieje
- Skopiuj plik `transactionUtils.js` do `src/utils/`
- Sprawdź ścieżkę importu - dla pliku w `src/components/` używaj `'../utils/transactionUtils'`

### 2. Problemy z danymi

#### Problem: Komponenty się renderują ale nie ma transakcji
**Sprawdź:**
```jsx
// W App.jsx, dodaj console.log do debugowania:
console.log('Transactions received:', transactions)
console.log('Transactions type:', typeof transactions)
console.log('Transactions length:', transactions?.length)
```

**Możliwe przyczyny:**
- API zwraca obiekt `{transactions: []}` zamiast array - dostosuj kod:
```jsx
// Jeśli API zwraca obiekt:
const data = await response.json()
setTransactions(data.transactions || data) // Obsłuż oba formaty
```

#### Problem: Błąd "Cannot read property 'filter' of undefined"
**Rozwiązanie:**
```jsx
// W RecentTransactions.jsx, dodaj domyślną wartość:
export default function RecentTransactions({ transactions = [], onEdit, onDelete }) {
    // transactions ma teraz domyślną wartość pustej tablicy
}
```

### 3. Problemy z filtrami

#### Problem: Filtr dat nie działa
**Sprawdź format dat w danych:**
```jsx
// Dodaj debug w getFilteredTransactions():
console.log('Sample transaction date:', filtered[0]?.date)
console.log('Date type:', typeof filtered[0]?.date)
```

**Rozwiązania:**
- Jeśli daty są w formacie `DD.MM.YYYY`, dostosuj logikę filtrowania:
```jsx
const transactionDate = t.date.includes('.') 
    ? new Date(t.date.split('.').reverse().join('-')) // DD.MM.YYYY → YYYY-MM-DD
    : new Date(t.date)
```

#### Problem: Wyszukiwarka nie znajduje transakcji
**Sprawdź czy pole `description` istnieje:**
```jsx
// W getFilteredTransactions(), dodaj sprawdzenie:
if (searchQuery.trim()) {
    filtered = filtered.filter(t => 
        t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase().trim())
    )
}
```

### 4. Problemy z CSS/stylami

#### Problem: Komponenty wyglądają źle lub nie mają stylów
**Sprawdź:**
- Czy pliki CSS są zaimportowane w komponentach:
```jsx
import './RecentTransactions.css' // W RecentTransactions.jsx
import './TransactionsList.css'   // W TransactionsList.jsx
```

#### Problem: Style są nadpisywane
**Rozwiązania:**
- Dodaj specyficzność do klas CSS:
```css
/* Zamiast: */
.transaction-item { ... }

/* Użyj: */
.recent-transactions-container .transaction-item { ... }
```

- Sprawdź czy nie ma konfliktów z istniejącymi stylami przez DevTools (F12)

### 5. Problemy z funkcjami CRUD

#### Problem: Przyciski edycji/usuwania nie działają
**Sprawdź czy funkcje są przekazane:**
```jsx
// W App.jsx:
<RecentTransactions
    transactions={transactions}
    onEdit={handleEditTransaction}    // ← Upewnij się że te funkcje istnieją
    onDelete={handleDeleteTransaction} // ← i są przekazane
/>
```

#### Problem: `handleDeleteTransaction` wywołuje błąd serwera
**Debug:**
```jsx
const handleDeleteTransaction = async (id) => {
    console.log('Usuwam transakcję:', id) // Debug
    
    try {
        const response = await fetch(`http://localhost:3002/api/transactions/${id}`, {
            method: 'DELETE'
        })
        
        console.log('Response status:', response.status) // Debug
        
        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Server error: ${response.status} - ${errorText}`)
        }
        
        // Success
        setRefreshKey(prev => prev + 1)
    } catch (error) {
        console.error('Delete error:', error)
        alert('Błąd usuwania: ' + error.message)
    }
}
```

### 6. Problemy z backendem

#### Problem: CORS errors
```
Access to fetch at 'http://localhost:3002/api/transactions' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Rozwiązanie w backend/server.js:**
```js
const cors = require('cors')

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}))
```

#### Problem: Endpoint nie istnieje
**Sprawdź czy backend ma route:**
```js
// W backend/routes/transactionRoutes.js lub server.js:
app.delete('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params
        // Logika usuwania
        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})
```

### 7. Problemy z paginacją

#### Problem: "Załaduj więcej" nie działa
**Debug:**
```jsx
// W RecentTransactions.jsx, dodaj logi:
const loadMoreTransactions = () => {
    console.log('Current visible:', visibleTransactionsCount)
    console.log('Items per page:', itemsPerPage)
    console.log('Total filtered:', getFilteredTransactions().length)
    
    setVisibleTransactionsCount(prev => {
        const newValue = prev + itemsPerPage
        console.log('New visible count:', newValue)
        return newValue
    })
}
```

### 8. Problemy z wydajnością

#### Problem: Komponent jest wolny przy wielu transakcjach
**Optymalizacje:**
```jsx
import { useMemo } from 'react'

// W RecentTransactions.jsx:
const filteredTransactions = useMemo(() => {
    return getFilteredTransactions()
}, [transactions, transactionFilter, dateRange, searchQuery, customDateFrom, customDateTo])

const displayedTransactions = useMemo(() => {
    return filteredTransactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, visibleTransactionsCount)
}, [filteredTransactions, visibleTransactionsCount])
```

## 🛠 Narzędzia debugowania

### 1. Console.log strategically
```jsx
// Na początku komponentu:
console.log('RecentTransactions props:', { transactions, onEdit, onDelete })

// W funkcjach filtrujących:
console.log('Filter state:', { transactionFilter, dateRange, searchQuery })

// W funkcjach API:
console.log('API response:', data)
```

### 2. React Developer Tools
- Zainstaluj React DevTools extension
- Sprawdź props i state komponentów
- Użyj Profiler do analizy wydajności

### 3. Network tab (F12)
- Sprawdź czy requesty API są wysyłane
- Sprawdź odpowiedzi serwera
- Sprawdź status codes (200, 404, 500, etc.)

### 4. Temporary UI indicators
```jsx
// Dodaj tymczasowe wskaźniki stanu:
<div style={{background: 'yellow', padding: '10px'}}>
    DEBUG: Transactions count: {transactions.length} | 
    Filtered: {getFilteredTransactions().length} |
    Visible: {visibleTransactionsCount}
</div>
```

## 📞 Gdy nic nie pomaga

1. **Sprawdź całą ścieżkę danych:**
   - Backend API → Network Tab → Frontend State → Component Props → UI

2. **Porównaj z działającym kodem:**
   - Sprawdź główny projekt "Manager Finansow - Norf"
   - Porównaj strukturę plików i importy

3. **Zrestartuj development server:**
   ```bash
   # Frontend:
   cd "Manager Finansow/frontend"
   npm start

   # Backend:
   cd "Manager Finansow/backend"  
   npm start # lub node server.js
   ```

4. **Sprawdź wersje zależności:**
   ```bash
   npm list react react-dom
   ```

5. **Usuń cache:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```