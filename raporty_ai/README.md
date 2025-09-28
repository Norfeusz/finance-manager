# README - Raporty AI dla Manager Finansów Gabi & Norf

## 🤖 Przegląd funkcjonalności

Ten pakiet dodaje inteligentne raporty AI do aplikacji Manager Finansów, dostosowane specjalnie dla wspólnego budżetu pary Gabi i Norf. Raporty analizują finanse pary i dostarczają praktyczne porady dotyczące zarządzania wspólnym budżetem.

## 📁 Zawartość pakietu

### **Backend:**
- `aiRoutes.js` - API endpoints dla raportów AI (dostosowane do struktury bazy "Manager Finansow")

### **Frontend:**
- `AIReportModal.jsx` - komponent modala z interfejsem raportów (JSX, nie TSX)
- `AIReportModal.css` - style dostosowane do designu aplikacji

### **Dokumentacja:**
- `instrukcje_implementacji.md` - szczegółowy przewodnik wdrożenia
- `szablon_integracji.md` - przykłady integracji z App.jsx
- `troubleshooting.md` - rozwiązywanie problemów

## 🎯 Funkcjonalności

### **Typy raportów:**
1. **📊 Raport miesięczny dla pary** - analiza wspólnych finansów za wybrany miesiąc
2. **📈 Raport roczny wspólnych finansów** - podsumowanie całego roku dla pary
3. **💰 Plan inwestycyjny dla pary** - strategia inwestycyjna dostosowana do pary
4. **✍️ Niestandardowe zapytanie** - dowolne pytania o finanse pary

### **Funkcje:**
- ✅ Podgląd raportu w modaln (bez zapisywania)
- ✅ Generowanie i zapisywanie raportów TXT (bez PDF dla uproszczenia)
- ✅ Status połączenia z OpenAI
- ✅ Instrukcje konfiguracji API key
- ✅ Obsługa błędów i walidacja
- ✅ Responsive design

## 🔧 Wymagania techniczne

### **Backend:**
- Node.js >= 16
- Express.js
- PostgreSQL z tabelami: transactions, accounts, account_balances, categories, months
- OpenAI API key (płatny)

### **Frontend:**
- React z hooks (JSX)
- Port 3000 (domyślny)

### **API:**
- Backend na porcie 3002
- Endpoints: GET `/api/ai/status`, POST `/api/ai/generate-report`, POST `/api/ai/generate-txt`

## 🚀 Szybki start

### 1. Zainstaluj zależności backend
```bash
cd "Manager Finansow/backend"
npm install openai
```

### 2. Dodaj klucz OpenAI API
```env
# W pliku backend/.env
OPENAI_API_KEY=sk-twój_klucz_api_tutaj
```

### 3. Skopiuj pliki
- `aiRoutes.js` → `backend/routes/`
- `AIReportModal.jsx` + `AIReportModal.css` → `frontend/src/components/`

### 4. Zintegruj z aplikacją
```jsx
// W App.jsx
import AIReportModal from './components/AIReportModal'
const [showAIModal, setShowAIModal] = useState(false)

// Dodaj przycisk i modal
<button onClick={() => setShowAIModal(true)}>🤖 Raporty AI</button>
<AIReportModal isVisible={showAIModal} onClose={() => setShowAIModal(false)} />
```

### 5. Uruchom aplikację
```bash
# Backend
cd "Manager Finansow/backend" && npm start

# Frontend  
cd "Manager Finansow/frontend" && npm start
```

## 📊 Przykład użycia

1. Kliknij przycisk "🤖 Raporty AI dla pary"
2. Wybierz typ raportu (np. "Raport miesięczny dla pary")
3. Opcjonalnie wybierz konkretny miesiąc
4. Kliknij "Wygeneruj raport" - podgląd w modaln
5. Kliknij "Pobierz jako TXT" - zapisanie pliku
6. Znajdź raport w folderze `Manager Finansow/Raporty/`

## 💡 Przykład wygenerowanego raportu

```
RAPORT FINANSOWY - GABI & NORF
Miesiąc: 2025-09

Wygenerowano: 27.09.2025 14:30:00
System: Manager Finansów - Wspólny budżet Gabi & Norf

================================================================================

## PODSUMOWANIE MIESIĘCZNE

Wasze wspólne finanse za wrzesień 2025:
- Łączne przychody: 8,500 PLN
- Łączne wydatki: 6,200 PLN  
- Bilans miesięczny: +2,300 PLN

## ANALIZA WYDATKÓW PO KATEGORIACH

1. **Zakupy codzienne**: 2,100 PLN (34% budżetu)
   - W porównaniu do sierpnia: wzrost o 150 PLN
   - Rekomendacja: Spróbujcie planować menu na tydzień

2. **Dom**: 1,800 PLN (29% budżetu)
   - Główne wydatki: czynsz, media
   - W normie dla pary

[... dalsze analizy i rekomendacje specyficzne dla pary ...]

================================================================================
Koniec raportu - Manager Finansów
Wygenerowany automatycznie przez AI
```

## 🛡️ Bezpieczeństwo

- **Klucz OpenAI** trzymany tylko w `.env` (nie commituj!)
- **Dane finansowe** nie są wysyłane poza OpenAI API
- **Pliki raportów** zapisywane lokalnie
- **Koszty API** monitoruj na platform.openai.com

## 🔧 Dostosowywanie

### Zmiana promptów AI:
Edytuj prompts w `aiRoutes.js` żeby dostosować:
- Styl i ton raportów
- Fokus na konkretnych aspektach finansów
- Długość i szczegółowość analiz

### Zmiana kosztów:
- Model `gpt-4o-mini`: ~$0.01-0.03 za raport
- Model `gpt-4`: ~$0.05-0.15 za raport  
- Dostosuj `max_tokens` żeby kontrolować koszty

### Dodanie nowych typów raportów:
1. Dodaj nową opcję w `reportType`
2. Napisz dedykowany prompt
3. Dodaj case w switch statements
4. Dodaj opcję w frontend select

## 📋 Różnice vs główny projekt

Ten pakiet jest uproszczoną wersją raportów z głównego projektu:

### **Uproszczenia:**
- ❌ Brak generowania PDF (tylko TXT)
- ❌ Brak zaawansowanych funkcji finansowych
- ❌ Mniej rodzajów raportów

### **Dostosowania:**
- ✅ Prompts skupione na wspólnych finansach pary
- ✅ Język i terminologia dla młodej pary  
- ✅ Dostosowane do struktury bazy "Manager Finansow"
- ✅ JSX zamiast TSX
- ✅ Port 3002 zamiast 3001

## 🆘 Wsparcie

### Jeśli masz problemy:
1. Przeczytaj `troubleshooting.md`
2. Sprawdź konsole deweloperską (F12)
3. Sprawdź logi backend servera
4. Sprawdź czy OpenAI API key jest ważny

### Najczęstsze problemy:
- **"API key not configured"** → Dodaj klucz do `.env` i zrestartuj backend
- **"Modal się nie otwiera"** → Sprawdź console.log i importy
- **"Raport się nie generuje"** → Sprawdź połączenie z bazą danych
- **"Plik się nie zapisuje"** → Sprawdź uprawnienia folderu `Raporty`

## 📈 Roadmap

### Możliwe rozszerzenia:
- Export raportów do PDF
- Automatyczne generowanie raportów co miesiąc
- Integracja z kalendarzem (przypomnienia)
- Więcej typów analiz (np. analiza długów, oszczędności)
- Porównania rok do roku
- Prognozy finansowe dla pary

---

**Miłego korzystania z raportów AI! 🤖💰**