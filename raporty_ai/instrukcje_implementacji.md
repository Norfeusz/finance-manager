# Instrukcje implementacji Raportów AI

## Przegląd
Te instrukcje pomogą ci zaimplementować funkcjonalność raportów AI w projekcie "Manager Finansow" (JSX) dla Gabi & Norf. Raporty są dostosowane do wspólnego budżetu pary i generują się tylko w formacie TXT.

## Wymagania techniczne
- **Node.js** z obsługą ES modules
- **OpenAI API Key** (płatny)
- **PostgreSQL** baza danych
- **Frontend**: React JSX na porcie 3000
- **Backend**: Express.js na porcie 3002

## Krok 1: Instalacja zależności backend

### 1.1 Zainstaluj OpenAI SDK
```bash
cd "Manager Finansow/backend"
npm install openai
```

### 1.2 Sprawdź czy masz już express i fs
Powinny być już zainstalowane. Jeśli nie:
```bash
npm install express fs path
```

## Krok 2: Konfiguracja backend

### 2.1 Skopiuj routes
```bash
# Skopiuj do Manager Finansow/backend/routes/
aiRoutes.js
```

### 2.2 Dodaj route do server.js
Edytuj `backend/server.js` i dodaj:
```js
// Dodaj import
const aiRoutes = require('./routes/aiRoutes')

// Dodaj route (po innych routes)
app.use('/api/ai', aiRoutes)
```

### 2.3 Skonfiguruj zmienne środowiskowe
Edytuj `backend/.env` i dodaj:
```env
OPENAI_API_KEY=twój_klucz_api_tutaj
```

**Jak uzyskać klucz API:**
1. Idź do https://platform.openai.com/api-keys
2. Zaloguj się lub zarejestruj
3. Utwórz nowy klucz API
4. Skopiuj klucz do pliku .env

⚠️ **UWAGA**: To płatna usługa! Sprawdź cennik na stronie OpenAI.

## Krok 3: Konfiguracja frontend

### 3.1 Skopiuj komponenty
```bash
# Skopiuj do Manager Finansow/frontend/src/components/
AIReportModal.jsx
AIReportModal.css
```

### 3.2 Zintegruj z App.jsx
Edytuj `frontend/src/App.jsx`:

```jsx
// Dodaj import
import AIReportModal from './components/AIReportModal'

// Dodaj stan dla modala (wewnątrz komponentu App)
const [showAIModal, setShowAIModal] = useState(false)

// Dodaj przycisk w interfejsie (np. w nawigacji lub dashboardzie)
<button 
    onClick={() => setShowAIModal(true)}
    className="ai-report-button"
    style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500'
    }}>
    🤖 Raporty AI
</button>

// Dodaj modal przed zamknięciem return (na końcu JSX)
{showAIModal && (
    <AIReportModal
        isVisible={showAIModal}
        onClose={() => setShowAIModal(false)}
    />
)}
```

## Krok 4: Sprawdź strukturę bazy danych

### 4.1 Wymagane tabele
Backend zakłada istnienie tych tabel:
- `transactions` (id, type, amount, description, extra_description, date, month_id, account_id, category_id, subcategory_id)
- `accounts` (id, name)
- `account_balances` (account_id, current_balance)
- `categories` (id, name)
- `subcategories` (id, name)
- `months` (id, year, month, planned_budget)

### 4.2 Dostosuj zapytania SQL (jeśli potrzeba)
Jeśli twoje nazwy tabel/kolumn się różnią, edytuj zapytania w `aiRoutes.js`:
```js
// Znajdź i dostosuj zapytania SQL do twojej struktury
const transactionsResult = await client.query(`...`)
```

## Krok 5: Utwórz folder na raporty

### 5.1 Utwórz katalog Raporty
```bash
mkdir "Manager Finansow/Raporty"
```
Lub folder zostanie utworzony automatycznie przy pierwszym raporcie.

## Krok 6: Testowanie

### 6.1 Uruchom serwery
```bash
# Backend
cd "Manager Finansow/backend"
npm start

# Frontend  
cd "Manager Finansow/frontend"
npm start
```

### 6.2 Sprawdź funkcjonalności
- [ ] Modal się otwiera
- [ ] Status OpenAI pokazuje "connected"
- [ ] Generowanie raportu w modaln działa
- [ ] Pobieranie TXT działa i zapisuje plik
- [ ] Raporty są dostosowane do wspólnego budżetu Gabi & Norf

## Krok 7: Typy raportów

### 7.1 Raport miesięczny
- Analizuje finanse pary za wybrany miesiąc
- Porównuje z poprzednimi miesiącami
- Daje rekomendacje dla wspólnego budżetu

### 7.2 Raport roczny
- Podsumowuje cały rok finansów pary
- Pokazuje trendy i wzorce
- Planuje cele na przyszły rok

### 7.3 Plan inwestycyjny
- Analizuje możliwości oszczędzania pary
- Proponuje strategię inwestycyjną
- Uwzględnia specyfikę młodej pary

### 7.4 Niestandardowe zapytanie
- Pozwala zadać dowolne pytanie AI
- Kontekst zawsze dotyczy finansów pary
- Może dotyczyć konkretnych kategorii/okresów

## Rozwiązywanie problemów

### Problem: "OpenAI API key not configured"
**Rozwiązanie:**
- Sprawdź czy `OPENAI_API_KEY` jest w pliku .env
- Zrestartuj backend po dodaniu klucza
- Sprawdź czy nie ma spacji przed/po kluczu

### Problem: "Cannot resolve module './components/AIReportModal'"
**Rozwiązanie:**
- Sprawdź czy plik `AIReportModal.jsx` istnieje w `src/components/`
- Sprawdź wielkość liter w nazwie pliku
- Sprawdź czy import jest prawidłowy

### Problem: Backend error 500 przy generowaniu raportu
**Rozwiązanie:**
- Sprawdź logi backendu w konsoli
- Sprawdź czy wszystkie wymagane tabele istnieją
- Sprawdź połączenie z bazą danych

### Problem: Plik TXT się nie zapisuje
**Rozwiązanie:**
- Sprawdź czy folder `Raporty` istnieje
- Sprawdź uprawnienia do zapisu w folderze backend
- Sprawdź ścieżki w `aiRoutes.js`

### Problem: Raporty są po angielsku
**Rozwiązanie:**
- W `aiRoutes.js` wszystkie prompts są po polsku
- Sprawdź czy używasz właściwego pliku
- OpenAI czasem odpowiada po angielsku - dodaj do prompta "Odpowiadaj TYLKO po polsku"

## Bezpieczeństwo

### Zabezpieczenia API
- Klucz OpenAI trzymaj TYLKO w pliku .env
- Nie commituj pliku .env do gita
- Dodaj `.env` do `.gitignore`

### Limity kosztów
- Ustaw limity wydatków na OpenAI Platform
- Monitoruj użycie API
- Każdy raport kosztuje około $0.01-0.05

## Dostosowywanie

### Zmiana promptów
Edytuj prompts w `aiRoutes.js` żeby dostosować:
- Styl raportów
- Fokus na konkretnych aspektach
- Długość odpowiedzi (max_tokens)

### Dodanie nowych typów raportów
1. Dodaj nową opcję w `reportType` enum
2. Dodaj case w switch statements
3. Napisz dedykowany prompt
4. Dodaj opcję w select na frontendzie

### Zmiana modelu AI
W `aiRoutes.js` zmień:
```js
model: 'gpt-4o-mini', // lub 'gpt-4', 'gpt-3.5-turbo'
```

## Przykład użycia

1. Kliknij "🤖 Raporty AI"
2. Wybierz "Raport miesięczny dla pary"  
3. Wybierz miesiąc (lub pozostaw pusty)
4. Kliknij "Wygeneruj raport"
5. Przeczytaj raport w modalu
6. Kliknij "Pobierz jako TXT" żeby zapisać plik
7. Znajdź plik w folderze `Raporty/`

Raporty będą zawierały praktyczne porady dla Gabi i Norf dotyczące ich wspólnych finansów!