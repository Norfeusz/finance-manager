# Spec: tabela `statistics` i logika aktualizacji (notatka do wdrożenia później)

Data: 2025-08-26

Treść wymagań do zapamiętania (cytat użytkownika):

"tak, życzę sobie, żeby średnia była wyliczona prawidłowo. Zmieńmy podejście do zapisu danych w bazie danych.
Dodajmy nową tabelę - statistics
W momencie otwarcia miesiąca pojawią się w nich sumy wydatków dla danego miesiąca
np. zakupy_codzienne_2025-08 i analogicznie do każdej kategorii i podkategorii
mają mieć następujące dane: id, year, month. amount, last_edited (data ostatniej edycji), is_open
w momencie dodawania wydatku w danej kategorii i podkategorii dane mają być nadpisywane (rubryki amount i last_edited)
w momencie gdy zameykamy/otwieramy miesiąc rubryka is_open ma się nadpisać dla wszystkich pozycji danego miesiąca

Jeśli masz jakieś pytania, to zadawaj. Jeśli masz sugestie co do kolumn w bazie danych, które mogą ułatwić różne funkcjonalności - głównie związane ze statystykami, to dawaj znać"

Uwagi i drobne sugestie (do rozważenia przy implementacji):
- month_id (YYYY-MM) jako kolumna pomocnicza (szybkie filtrowanie i JOINy z months.id).
- category_key, subcategory_key w formie znormalizowanej (lowercase, bez polskich znaków) + opcjonalnie category_id, subcategory_id (FK) dla spójności.
- count_transactions (liczba transakcji w danej kategorii w miesiącu) – przyda się przy średnich ważonych/liczeniu median.
- created_at, updated_at (obok last_edited) – standardowa audytowalność.
- unique constraint (category_key, subcategory_key NULLS FIRST, month_id) – jedna pozycja na kategorię/podkategorię i miesiąc.
- indeks na (month_id, category_key) oraz (category_key) – szybkie agregacje i przegląd per kategoria.

Zakres implementacji (później):
- Utworzenie tabeli `statistics` zgodnie z powyższym.
- Seed rekordów przy otwarciu miesiąca; aktualizacja amount/last_edited przy dodawaniu/edycji/usuwaniu wydatków.
- Masowa aktualizacja is_open przy zamykaniu/otwieraniu miesiąca.
- Mechanizm przeliczenia wstecz (backfill) dla istniejących danych.
