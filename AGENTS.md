# Instrukcje dla agenta

## Cel projektu

Generator API to aplikacja TypeScript + Express generująca PDF z webappu oraz
edytowalne prezentacje PowerPoint. Wymaga Node.js 22+. Korzysta z Playwright,
PptxGenJS, JSZip i Zod. Testy uruchamia `node:test` przez `tsx`; Supertest służy
do testowania kontraktów HTTP.

## Gdzie szukać

Najpierw sprawdź `package.json` i sekcję „Where to look” w `README.md`.
Poniższa mapa wskazuje główne granice odpowiedzialności:

| Obszar                                                | Pliki                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| Uruchomienie, zależności i shutdown                   | `src/index.ts`                                                    |
| Express, middleware i request ID                      | `src/app.ts`                                                      |
| Konfiguracja i limity                                 | `src/config.ts`                                                   |
| Walidacja wejścia i trasy dokumentów                  | `src/schemas.ts`, `src/pdf-route.ts`                              |
| Endpointy                                             | `src/routes/` (osobny plik dla każdej ścieżki)                    |
| Kontrakty usług, dekodowanie GET, pobieranie i błędy  | `src/http/`, `src/errors.ts`                                      |
| Kolejki, timeouty i anulowanie oczekujących zadań     | `src/queue/generation-queue.ts`                                   |
| Chromium i renderowanie PDF                           | `src/services/web-page-pdf.ts`                                    |
| Generowanie i wypełnianie prezentacji                 | `src/pptx/pptxgenjs/`, `src/pptx/jszip/`                          |
| XML, relacje, tabele, wykresy i osadzone arkusze PPTX | `src/pptx/jszip/`                                                 |
| Konfiguracja endpointów API danych i typy odpowiedzi  | `src/data-api/endpoints.ts`, `src/data-api/report-data-schema.ts` |
| Źródłowe prezentacje                                  | `templates/`                                                      |
| Testy i przykłady                                     | `test/`, `examples/`                                              |
| Dokumentacja API i wdrożenia                          | `README-ENDPOINTS.md`, `AZURE.md`, `scripts/`                     |

## Jak badać kod

- Szukaj nazw plików przez `rg --files`, treści przez `rg -n`, a samych nazw
  pasujących plików przez `rg -l`. Zaczynaj od odpowiedniego katalogu i rozszerzaj
  zakres, gdy wyniki nie wystarczą.
- Respektuj `.gitignore`. Pomijaj `node_modules`, `dist`, `output` i binarne
  artefakty przy zwykłym wyszukiwaniu. Czytaj szablony i wygenerowane dokumenty
  wtedy, gdy są potrzebne do zadania.
- Czytaj konkretne funkcje i sąsiedni kontekst zamiast całego repozytorium.
  Niezależne odczyty można grupować; kolejne kroki analizy dobieraj do wyników.
- Dla HTTP prześledź: endpoint → dekodowanie wejścia → schemat Zod → kolejka
  i usługa → odpowiedź lub błąd → testy.
- Przed zmianą wspólnej funkcji lub typu znajdź wywołania, implementacje
  i powiązane testy. Sprawdź zarówno GET, jak i POST, gdy dzielą logikę.
- Oddziel potwierdzone problemy od hipotez. W analizie wskazuj konkretne pliki
  i linie oraz wyjaśniaj wpływ na zachowanie aplikacji.
- Kod jest źródłem prawdy. Jeśli dokumentacja jest nieaktualna, popraw ją
  w zakresie wykonywanego zadania.

## Zasady zmian

- Zachowuj istniejący styl TypeScript ESM, w tym rozszerzenia `.ts` w lokalnych
  importach źródeł TypeScript. Kompilator przepisuje je na `.js` w `dist`. Formatowanie pozostaw Prettierowi.
- Utrzymuj rozdział między routingiem, walidacją i generowaniem dokumentów.
  Korzystaj z wstrzykiwania usług przez `createApp` i kontraktów w
  `src/http/types.ts`, aby testy HTTP nie wymagały prawdziwego Chromium.
- Zachowuj istniejące kontrakty GET/POST, nagłówki pobierania, request ID
  i strukturę błędów, chyba że zadanie wymaga ich zmiany.
- Nie obchodź walidacji tras PDF, ograniczeń nawigacji, rejestru szablonów
  ani limitów kolejek. Aktywne zadanie zajmuje slot do faktycznego zakończenia;
  anulowanie oczekiwania nie oznacza zakończenia aktywnego renderowania.
- Przy zmianach PPTX zachowuj edytowalność i formatowanie. Aktualizuj dane
  wykresu wraz z osadzonym arkuszem i odpowiednimi relacjami. Generowanie
  nie może modyfikować źródłowej prezentacji.
- Nie odczytuj ani nie wypisuj sekretów z `.env` lub plików poświadczeń.
  Do dokumentacji konfiguracji używaj `.env.example` i nazw zmiennych.
- Ogranicz zmiany do zadania. Nowe zależności dodawaj, gdy istniejące narzędzia
  nie rozwiązują problemu rozsądnie; unikaj przypadkowego formatowania innych plików.
- Przy zmianie parametrów lub zachowania endpointu aktualizuj
  `README-ENDPOINTS.md`, a w razie potrzeby także przykłady i `README.md`.

## Weryfikacja

Po zmianach kodu, eksportów, zależności lub punktów wejścia uruchom `npm run knip`.
Knip sprawdza nieużywane pliki, eksporty i zależności. Nowe samodzielne punkty
wejścia, których nie rozpoznaje ze skryptów npm, dodawaj do `entry` w `knip.json`.
Nie wyciszaj zgłoszeń bez sprawdzenia, czy wskazany kod jest rzeczywiście używany.

Dobieraj sprawdzenia do zmiany. Dostępne polecenia sprawdzaj w `package.json`.

| Zmiana                                | Weryfikacja                                                               |
| ------------------------------------- | ------------------------------------------------------------------------- |
| TypeScript                            | `npm run typecheck` oraz odpowiednie testy                                |
| Jeden moduł                           | `npx --no-install tsx --test test/api.test.ts` (podmień plik na właściwy) |
| Wspólna logika, routing lub kontrakty | `npm test`                                                                |
| Formatowanie zmienionego pliku        | `npx --no-install prettier --check AGENTS.md` (podmień ścieżkę)           |
| Formatowanie całego projektu          | `npm run format:check`                                                    |
| Kompilacja i uruchamianie z `dist`    | `npm run build`                                                           |
| Pakowanie Azure                       | `npm run test:azure`; szczegóły w `AZURE.md`                              |
| Wygląd dokumentów                     | `npm run test:outputs` i inspekcja odpowiednich artefaktów                |

- Dla zmiany zachowania lub naprawy błędu dodaj test sprawdzający obserwowalny
  rezultat. Nie dodawaj testów odtwarzających wyłącznie implementację.
- Testy renderowania PDF wymagają Chromium i jego bibliotek systemowych.
  Instalację przeglądarki zapewnia `npm run browser:install`.
- Testy HTTP powinny sprawdzać istotne statusy, nagłówki, walidację i błędy.
  Testy PPTX powinny sprawdzać odpowiednie części ZIP/XML i dane dokumentu.
- Po zmianie samej dokumentacji wystarczy sprawdzić jej poprawność i format.
- W podsumowaniu podaj rezultat, wykonane sprawdzenia oraz ewentualne blokady.
  Nie deklaruj zaliczenia testów, których nie uruchomiono.
