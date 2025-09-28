# Troubleshooting Raportów AI - Rozwiązywanie problemów

## 🚨 Najczęstsze problemy i rozwiązania

### 1. Problemy z konfiguracją OpenAI

#### Problem: "OpenAI API key not configured"
```
Error: OPENAI_API_KEY is not configured
```

**Rozwiązanie:**
1. Sprawdź plik `backend/.env`:
   ```env
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
2. Upewnij się, że klucz jest prawidłowy (zaczyna się od `sk-`)
3. Zrestartuj backend serwer po dodaniu klucza
4. Sprawdź czy nie ma spacji przed/po kluczu API

#### Problem: "Błąd połączenia z OpenAI API"
**Możliwe przyczyny:**
- Nieprawidłowy klucz API
- Brak środków na koncie OpenAI
- Przekroczony limit użycia
- Problemy z siecią

**Rozwiązania:**
```bash
# Sprawdź saldo na OpenAI Platform:
# https://platform.openai.com/account/usage

# Sprawdź limity:
# https://platform.openai.com/account/limits
```

### 2. Problemy z importami i komponentami

#### Problem: `Cannot resolve module './components/AIReportModal'`
```
Module not found: Error: Can't resolve './components/AIReportModal'
```

**Rozwiązanie:**
- Sprawdź czy plik `AIReportModal.jsx` istnieje w `src/components/`
- Upewnij się, że nazwa pliku jest dokładnie `AIReportModal.jsx` (wielkość liter!)
- Sprawdź import: `import AIReportModal from './components/AIReportModal'`

#### Problem: CSS style nie działają
**Rozwiązanie:**
- Sprawdź czy `AIReportModal.css` jest zaimportowany w komponencie:
  ```jsx
  import './AIReportModal.css'
  ```
- Sprawdź czy nie ma konfliktów z istniejącymi stylami
- Użyj DevTools (F12) żeby sprawdzić które style są aplikowane

### 3. Problemy z backend API

#### Problem: 500 Error przy generowaniu raportu
**Debug backend:**
```js
// Dodaj logi w aiRoutes.js
console.log('Financial data:', financialData)
console.log('OpenAI request:', { reportType, month, customPrompt })
```

**Sprawdź:**
- Czy wszystkie wymagane tabele istnieją w bazie danych
- Czy połączenie z PostgreSQL działa
- Czy pool connection jest prawidłowy

#### Problem: "Cannot read property 'rows' of undefined"
**Rozwiązanie:**
Sprawdź połączenie z bazą danych w `aiRoutes.js`:
```js
// Dodaj error handling
try {
    const client = await pool.connect()
    // ... queries
} catch (error) {
    console.error('Database connection error:', error)
    throw error
} finally {
    if (client) client.release()
}
```

### 4. Problemy z generowaniem plików TXT

#### Problem: Plik TXT się nie zapisuje
**Sprawdź ścieżki:**
```js
// W aiRoutes.js sprawdź czy folder istnieje
const reportsDir = path.join(__dirname, '..', '..', 'Raporty')
console.log('Reports directory:', reportsDir)

if (!fs.existsSync(reportsDir)) {
    console.log('Creating reports directory...')
    fs.mkdirSync(reportsDir, { recursive: true })
}
```

**Sprawdź uprawnienia:**
```bash
# Linux/Mac
chmod 755 "Manager Finansow/Raporty"

# Windows - sprawdź czy folder nie jest read-only
```

#### Problem: Błąd zapisu pliku
```
Error: ENOENT: no such file or directory
```

**Rozwiązanie:**
```js
// Użyj path.resolve dla pewności
const reportsDir = path.resolve(__dirname, '..', '..', 'Raporty')
const filePath = path.join(reportsDir, reportFileName)

console.log('Full file path:', filePath)
```

### 5. Problemy z zawartością raportów

#### Problem: Raporty są po angielsku
**Rozwiązanie:**
Dodaj do system prompt:
```js
let systemPrompt = `Jesteś ekspertem finansowym. 
WAŻNE: Odpowiadaj WYŁĄCZNIE w języku polskim. 
Używaj polskich nazw miesięcy, walut i terminów finansowych.`
```

#### Problem: Raport jest za krótki/za długi
**Dostosuj parametry:**
```js
const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...],
    max_tokens: 3000,        // Zwiększ dla dłuższych raportów
    temperature: 0.7,        // Zmniejsz dla bardziej precyzyjnych odpowiedzi
})
```

#### Problem: Raporty nie zawierają konkretnych danych
**Sprawdź dane wejściowe:**
```js
// Dodaj debug przed wywołaniem OpenAI
console.log('Transactions count:', financialData.transactions.length)
console.log('Sample transaction:', financialData.transactions[0])
console.log('Account balances:', financialData.accountBalances)
```

### 6. Problemy z interfejsem użytkownika

#### Problem: Modal nie otwiera się
**Debug React state:**
```jsx
// Dodaj console.log w komponencie
const [showAIModal, setShowAIModal] = useState(false)

console.log('AI Modal visible:', showAIModal) // Debug

const handleOpenModal = () => {
    console.log('Opening modal...')
    setShowAIModal(true)
}

return (
    <div>
        <button onClick={handleOpenModal}>Otwórz AI</button>
        {showAIModal && <AIReportModal isVisible={true} onClose={() => setShowAIModal(false)} />}
    </div>
)
```

#### Problem: Modal otwiera się ale jest pusty
**Sprawdź warunki renderowania:**
```jsx
// W AIReportModal.jsx
export default function AIReportModal({ isVisible, onClose }) {
    console.log('Modal props:', { isVisible, onClose }) // Debug
    
    if (!isVisible) {
        console.log('Modal not visible, returning null')
        return null
    }
    
    return (
        <div className='ai-modal-overlay'>
            {/* ... content */}
        </div>
    )
}
```

### 7. Problemy z kosztami i limitami OpenAI

#### Problem: Za wysokie koszty
**Optymalizacja:**
```js
// Używaj tańszego modelu
model: 'gpt-4o-mini', // zamiast 'gpt-4'

// Ogranicz dane wejściowe
const limitedTransactions = financialData.transactions.slice(0, 50)

// Zmniejsz max_tokens
max_tokens: 2000, // zamiast 3000+
```

#### Problem: Rate limit exceeded
**Rozwiązanie:**
```js
// Dodaj retry logic
async function callOpenAIWithRetry(openai, params, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await openai.chat.completions.create(params)
        } catch (error) {
            if (error.status === 429 && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
                continue
            }
            throw error
        }
    }
}
```

### 8. Problemy z bazą danych

#### Problem: Brak danych w raportach
**Sprawdź zapytania SQL:**
```sql
-- Testuj zapytania bezpośrednio w pgAdmin/psql
SELECT COUNT(*) FROM transactions;
SELECT DISTINCT account_id FROM transactions;
SELECT * FROM accounts LIMIT 5;
```

#### Problem: "relation does not exist"
**Sprawdź nazwy tabel:**
```js
// W aiRoutes.js dostosuj nazwy tabel do swojej struktury
const transactionsResult = await client.query(`
    SELECT * FROM your_transactions_table_name  -- Zmień nazwę
    -- ...
`)
```

### 9. Problemy z CORS

#### Problem: CORS błędy w przeglądarce
```
Access to fetch at 'http://localhost:3002/api/ai/status' blocked by CORS policy
```

**Rozwiązanie w backend/server.js:**
```js
const cors = require('cors')

app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}))
```

### 10. Debug workflow

#### Krok po kroku debugowanie:

1. **Sprawdź backend:**
   ```bash
   curl http://localhost:3002/api/ai/status
   ```

2. **Sprawdź frontend:**
   ```js
   fetch('http://localhost:3002/api/ai/status')
     .then(r => r.json())
     .then(console.log)
   ```

3. **Sprawdź bazę danych:**
   ```sql
   SELECT COUNT(*) FROM transactions;
   ```

4. **Sprawdź OpenAI:**
   ```bash
   # Test klucza API przez curl
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

#### Włącz szczegółowe logowanie:
```js
// W aiRoutes.js
console.log('=== AI REPORT DEBUG ===')
console.log('Request body:', req.body)
console.log('Financial data summary:', {
    transactionsCount: financialData.transactions.length,
    accountsCount: financialData.accountBalances.length,
    monthsCount: financialData.months?.length || 0
})
console.log('OpenAI request:', { 
    model: 'gpt-4o-mini',
    messagesCount: 2,
    maxTokens: 3000
})
```

## 📞 Gdy nic nie pomaga

1. **Sprawdź całą ścieżkę:**
   - Frontend button click → Modal open → API call → Backend route → Database query → OpenAI API → Response → File save

2. **Porównaj z głównym projektem:**
   - Sprawdź działający kod w "Manager Finansow - Norf"
   - Porównaj struktury plików i konfigurację

3. **Zrestartuj wszystko:**
   ```bash
   # Backend
   cd "Manager Finansow/backend"
   npm install
   npm start

   # Frontend
   cd "Manager Finansow/frontend"  
   npm install
   npm start
   ```

4. **Sprawdź wersje Node.js:**
   ```bash
   node --version  # Powinno być >= 16
   npm --version
   ```

5. **Wyczyść cache:**
   ```bash
   # Frontend
   rm -rf node_modules package-lock.json
   npm install

   # Browser
   # Ctrl+Shift+R (hard refresh)
   # F12 → Network tab → Disable cache
   ```