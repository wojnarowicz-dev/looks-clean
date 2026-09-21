# looks-clean

[![tests](https://github.com/wojnarowicz-dev/looks-clean/actions/workflows/ci.yml/badge.svg)](https://github.com/wojnarowicz-dev/looks-clean/actions/workflows/ci.yml)
[![znane odpowiedzi: 5 z 7 wymaga prywatnego materialu](https://img.shields.io/badge/znane%20odpowiedzi-5%20z%207%20wymaga%20prywatnego%20materialu-yellow)](test/known-answers.mjs)

> Zielona odznaka obejmuje dziesięć warstw testowych. **Nie** obejmuje pięciu
> z siedmiu znanych odpowiedzi: wymagają repozytoriów, które nie są publiczne,
> więc CI zgłasza je jako nieosiągalne, a nie jako zaliczone. Druga odznaka o tym
> mówi, a `test/readme.mjs` sprawdza, czy jej liczba to liczba, którą podaje zestaw.

*[English](README.md)*

**Dla kogoś, kto o drugiej w nocy musi odpowiedzieć, czy ekran jest pusty
dlatego, że nic tam nie ma, czy dlatego, że coś padło — i nie ma jak tego
poznać z kodu.**

`looks-clean` czyta projekt w JavaScripcie, TypeScripcie, Javie albo Darcie i szuka miejsc, w
których awaria jest nieodróżnialna od pustego wyniku: tam, gdzie program mówi
*nic nie znalazłem* zamiast *nie dałem rady sprawdzić*.

Nie ma poglądów. Ma sąsiadów.

## Uruchomienie bez instalowania

```
npx looks-clean scan .
```

Node 18 albo nowszy. Nie trzeba klonować, nie trzeba niczego ustawiać, nie ma
pliku konfiguracyjnego: narzędzie czyta ten projekt, który mu wskażesz, i nic
poza nim. Każde polecenie z tej strony działa tak samo z `npx looks-clean`
z przodu.

<!-- lc:claim name=rules value=4 -->
<!-- lc:claim name=rulesNeedingPopulation value=3 -->
<!-- lc:claim name=layers value=10 -->
<!-- lc:claim name=knownAnswers value=7 -->
<!-- lc:claim name=knownAnswersInScope value=6 -->
<!-- lc:claim name=families value=9 -->
<!-- lc:claim name=languages value=2 -->
<!-- lc:claim name=messages value=140 -->
<!-- lc:claim name=fixtureFindings value=7 -->
<!-- lc:claim name=fixturePlanted value=4 -->
<!-- lc:claim name=cleanFindings value=0 -->
<!-- lc:claim name=defaultExclusions value=19 -->
<!-- lc:claim name=precisionMeasurements value=2 -->
<!-- lc:claim name=precisionProjects value=3 -->
<!-- lc:claim name=precisionReported value=27 -->
<!-- lc:claim name=precisionChecked value=10 -->
<!-- lc:claim name=precisionReal value=2 -->
<!-- lc:claim name=precisionNoise value=8 -->
<!-- lc:claim name=precisionReportedBefore value=409 -->
<!-- lc:claim name=precisionCheckedBefore value=30 -->
<!-- lc:claim name=precisionRealBefore value=2 -->
<!-- lc:claim name=precisionNoiseBefore value=28 -->
<!-- lc:claim name=precisionTestCode value=12 -->
<!-- lc:claim name=javaSampleReported value=89 -->
<!-- lc:claim name=javaRandomChecked value=20 -->
<!-- lc:claim name=javaRandomReal value=14 -->
<!-- lc:claim name=javaRandomDeliberate value=3 -->
<!-- lc:claim name=javaRandomNoise value=3 -->
<!-- lc:claim name=javaFirstChecked value=20 -->
<!-- lc:claim name=javaFirstReal value=9 -->
<!-- lc:claim name=javaFirstDeliberate value=5 -->
<!-- lc:claim name=javaFirstNoise value=6 -->
<!-- lc:claim name=javaNoisyRules value=1 -->
<!-- lc:claim name=dartReported value=22 -->
<!-- lc:claim name=dartChecked value=22 -->
<!-- lc:claim name=dartReal value=15 -->
<!-- lc:claim name=dartDeliberate value=1 -->
<!-- lc:claim name=dartNoise value=6 -->

## Czym to się różni od twojego lintera

Nazwanie tego wprost to jedyny powód, żeby uwierzyć w cokolwiek dalej na tej
stronie.

Pusty `catch` zgłaszają już **eslint** (`no-empty`), **analizator Darta**
(`empty_catches`) i **analizator C#** (`AL0115`). Wszystkie trzy noszą swój
wyrok ze sobą: konstrukcja jest zła wszędzie, w każdym projekcie, w każdej
linii. Nie muszą czytać nic poza plikiem, który mają przed sobą, i to jest ich
siła.

To narzędzie nie umie powiedzieć nic z tych rzeczy i nie próbuje. Nie ma zdania
na temat tego, czy pusty catch jest zły. Ma za to resztę twojego repozytorium,
a zdanie, które z tego produkuje, ma taki kształt:

> **5 z 7 obsług błędu na supabase w tym pliku niesie wynik obok wartości.
> Ta jedna nie.**

Tego zdania nie ma w słowniku żadnego lintera, bo linter nie ma populacji. Jest
to też jedyne zdanie tutaj, na które warto zareagować: nie prosi cię o przyjęcie
jakiejś praktyki, tylko zauważa, że już ją masz i że to miejsce jest poza nią.

Konkretnie, na tym samym kodzie:

| | eslint `no-empty` i reszta | looks-clean |
|---|---|---|
| `catch { }` | zgłasza | zgłasza i mówi, ilu sąsiadów tak nie robi |
| `catch { return []; }` | milczy — blok nie jest pusty | zgłasza, jeśli sąsiedzi odpowiadają `{ ok, value }` |
| `catch { return []; }` tam, gdzie każdy sąsiad robi tak samo | milczy | **milczy i mówi o tym z liczbą** |
| `await fetch(url)` bez limitu czasu | milczy | zgłasza, jeśli odczyty obok mają limit |
| to samo tam, gdzie nikt w warstwie nie ma limitu | milczy | **milczy i mówi o tym z liczbą** |

Dwa pogrubione wiersze to te, które czynią z tego narzędzie użyteczne. Coś, co
zgłaszałoby każdy goły `catch { return [] }`, byłoby linterem z gorszymi
regułami.

## Jak często się myli

Cztery pomiary. Dwa na sześciu projektach w JavaScripcie, żaden nie jest mój;
jeden na Javie przed 0.2.0, jeden na Darcie przed 0.3.0. Żaden nie jest
uśredniony w inny.

Pierwsze dwa, obok siebie. Stoją obok siebie, a nie jako
jedna poprawiona liczba, bo między nimi zmieniło się narzędzie i zmienił się
materiał — a pojedyncza skorygowana liczba ukryłaby oba te fakty.

|  | pierwszy przebieg | drugi przebieg |
|---|---|---|
| **data** | 2026-09-07 | 2026-09-07 |
| **narzędzie** | przed wykluczeniem kodu testowego | po wykluczeniu kodu testowego |
| **prawdziwych defektów** | **2** | **2** |
| **fałszywych alarmów** | **28** | **8** |
| **sprawdzonych** | 30 | 10 |
| **zgłoszonych łącznie** | 409 | 27 |

Dziesięć sprawdzonych z 359 to dziesięć sprawdzonych. Żadna z tych liczb nie
jest trafnością narzędzia na całym przebiegu i nic tutaj tego nie twierdzi.

### Pierwszy przebieg — przed wykluczeniem kodu testowego

| projekt | charakter | zgłoszeń | sprawdzonych | trafnych | fałszywych |
|---|---|---:|---:|---:|---:|
| [got](https://github.com/sindresorhus/got) | biblioteka klienta HTTP, TypeScript | 359 | 10 | 0 | 10 |
| [uptime-kuma](https://github.com/louislam/uptime-kuma) | aplikacja monitorująca, JavaScript | 34 | 10 | 2 | 8 |
| [eslint](https://github.com/eslint/eslint) | narzędzie deweloperskie, JavaScript | 16 | 10 | 0 | 10 |

**Co łączyło fałszywe alarmy.** W 20 z 28 awaria *była* obsłużona — limitem
czasu na wywołaniu obejmującym, odpowiedzią HTTP 400, kompensującym `destroy()`,
udokumentowanym torem zapasowym albo testem, którego całym tematem był brak
limitu.

Największa pojedyncza dźwignia była prostsza: **12 z 30 to kod testowy**, a 350
z 359 zgłoszeń w `got` leżało pod `test/`. Plik testowy nie jest warstwą — jego
kształt dyktuje to, co dany test sprawdza — więc katalogi testowe trafiły do
wbudowanych wykluczeń. To jedyna zmiana między przebiegami.

### Drugi przebieg — po wykluczeniu kodu testowego

| projekt | charakter | zgłoszeń | sprawdzonych | trafnych | fałszywych |
|---|---|---:|---:|---:|---:|
| [verdaccio](https://github.com/verdaccio/verdaccio) | serwer prywatnego rejestru npm, TypeScript | 27 | 10 | 2 | 8 |
| [node-red](https://github.com/node-red/node-red) | środowisko programowania wizualnego, JavaScript | 0 | 0 | 0 | 0 |
| [fastify](https://github.com/fastify/fastify) | framework webowy, JavaScript | 0 | 0 | 0 | 0 |

**Dwa z trzech nie zgłosiły nic i żadne z tych zer nie dotyczy trafności.** To
najbardziej użyteczna część tego przebiegu.

*fastify* to zero uprawnione: 113 obsług błędu i 8 odczytów zewnętrznych.
Framework webowy **przyjmuje** wywołania, zamiast je robić, więc reguły 2 i 3 nie
miały czego grupować — a przebieg to powiedział, cztery miejsca pominięte i
cztery warstwy bez konwencji, zamiast wypisać gołe zero. Pokazuje też, że
kryterium doboru było tępe: te reguły potrzebują nie gęstości obsługi błędów,
tylko gęstości obsługi błędów **nad odczytami zewnętrznymi**.

*node-red* to zero nieuprawnione. Narzędzie przeczytało 11 plików z repozytorium
zawierającego 308 plików źródłowych JavaScript, bo node-red trzyma kod pod
`packages/node_modules/`, a wbudowane wykluczenie `**/node_modules/**` zjadło go
w całości — **i przebieg tego nie powiedział.** `findings: 0` tam, gdzie znaczyło
*nie zaglądałem*. To własny temat tego narzędzia, w tym narzędziu, znaleziony
przez wycelowanie go w bazę kodu o nietypowym układzie.

**Co łączy fałszywe alarmy teraz.** Pięć z ośmiu zapisuje awarię tam, gdzie
narzędzie nie czyta: `console.warn` cztery linie pod obsługą, sprawdzenie
`undefined`, zdarzenie `error` na strumieniu albo samo przejście dalej. To
zaostrzona wersja wspólnego mianownika z pierwszego przebiegu — narzędzie czyta
ciało obsługi i zwracaną wartość, a w prawdziwym kodzie zapis awarii bardzo
często leży tuż obok obu.

### Usterki, które pomiary znalazły w narzędziu

Pięć. **Cztery zostają niepoprawione celowo**, bo każda z nich zmienia to,
*które* zgłoszenia wychodzą, a poprawienie ich i ponowny pomiar na tych samych
projektach byłby strojeniem narzędzia pod własny test — a tak właśnie liczba
trafności staje się bezwartościowa:

* `{ timeout }` zapisany skrótowo nie jest rozpoznawany jako limit
* każde wywołanie `fs.*` jest traktowane jak odczyt, w tym zapisy, konstruktory
  strumieni i wywołania `*Sync`, które nigdy nie mogą mieć limitu
* łańcuch `fsp.stat(...).catch(...)` liczy się dwa razy i jest zgłaszany dwa razy
* awaria wykryta zwykłym predykatem trafia na ścieżkę pustki

**Piątą poprawiono od razu** i to o niej warto przeczytać. Na node-red narzędzie
wypisało `findings: 0` tam, gdzie znaczyło *nie zaglądałem* — najczystszy
przykład tego, co te cztery reguły mają łapać, znaleziony w nim samym. Tego nie
można było zostawić dla ochrony liczby, a poprawka nie zmienia żadnego
zgłoszenia: dokłada zdanie o tym, czego nie przeczytano.

Każdy przebieg, który cokolwiek wykluczył, mówi teraz, ile kodu źródłowego
zostało za wykluczeniami, nazywa największe wraz ze wzorcem, który je usunął, i
robi się głośniejszy, gdy wykluczono więcej, niż przeczytano:

```
read: 11 files, 76 functions, 14 error handlers, 19 external reads
not read: 741 file(s) behind 12 excluded director(ies) (counted up to a cap, so at least that many), and 9 excluded file(s)
   largest: packages/node_modules/@node-red/ (>=500, **/node_modules/**), test/unit/ (147, **/test/**)
   More was excluded than was read. If your sources live under a path that looks
   like a dependency or a test directory, they were skipped: read the list above
   before taking this result for a clean one.
```

`test/resilience.mjs` trzyma to na miejscu: po usunięciu poprawki scenariusz
*sources under an excluded directory* przechodzi w stan SILENT, co wywraca
warstwę.

Wykluczenie kodu testowego to jeszcze co innego — poprawka zakresu, prawdziwa
przed pomiarem, a nie z niego wyprowadzona.

### Java — trzeci pomiar, i pierwszy ekran jest tym gorszym

Java weszła w 0.2.0. Zanim wyszła, dwadzieścia zgłoszeń wylosowano **losowo**
z prawdziwego przebiegu na Javie i przeczytano w linii, którą każde cytuje — a
potem dwadzieścia kolejnych, **z góry wypisanej listy**, bo to jest ekran, który
człowiek naprawdę widzi. Te dwie liczby są różne i obie są tutaj właśnie dlatego.

| | losowa dwudziestka | pierwsza dwudziestka |
|---|---:|---:|
| **prawdziwe usterki** | **14** | **9** |
| **celowe i do obrony** | 3 | 5 |
| **fałszywe alarmy** | **3** | **6** |
| sprawdzonych | 20 | 20 |

Materiał: jeden 21-plikowy katalog aplikacji desktopowej w Javie, 89 zgłoszeń,
ustawienia domyślne. Próbka: ziarno `looks-clean-java-0.2.0`, zapisane w
`test/precision.json`, żeby ta sama dwudziestka wróciła beze mnie.

**To są miejsca w programie o zamkniętym źródle: lokalizacje są zatrzymane,
werdykty i przyczyny opublikowane.** Czternaście z dwudziestu to prawdziwe
usterki w czymś, co jest sprzedawane, i większość jest nienaprawiona — plik
i linia przy każdej byłyby publiczną listą błędów dla cudzych klientów. Każde
miejsce niesie zamiast tego stały identyfikator, a mapa z powrotem do kodu leży
przy produkcie, nie tutaj. Co oceniono, którą regułą i dlaczego fałszywy alarm
był fałszywy — to wszystko jest w `test/precision.json` i da się z tym spierać.

Trzy werdykty zamiast dwóch. Miejsce może być usterką, **celowym** wyborem,
który autor zapisał w komentarzu i nie podziękuje za zmianę, albo zgłoszeniem,
którego narzędzie nie powinno było zrobić. Tylko to ostatnie jest fałszywym
alarmem. Cztery obsługi połykające awarię przy zamykaniu aplikacji, każda za
komentarzem tłumaczącym, dlaczego awaria sprzątania nie może przewrócić
zamykania, są powodem, dla którego środkowa kolumna istnieje.

**Góra listy jest gorszą połową**: 6 fałszywych alarmów na 20 wobec 3 na 20
niżej. To odwrotność tego, o co zwykle oskarża się próbkę z góry listy, i ma
jedną przyczynę — reguła 4 punktuje najwyżej, a w regule 4 siedzi każdy fałszywy
alarm.

| reguła | losowa | pierwsza |
|---|---|---|
| `same-answer` | **3 z 7 fałszywe** | **6 z 10 fałszywych** |
| `swallowed` | 0 z 11 | 0 z 9 |
| `default-on-error` | 0 z 2 | 0 z 1 |
| `no-timeout` | nie zgłosiła nic | nie zgłosiła nic |

Dwie przyczyny, obie w regule 4:

* **Strażnik argumentu to nie jest ścieżka pustki.** `if (x == null) return null`
  odpowiada wołającemu, który zadał źle postawione pytanie; zderzenie tego z
  `catch`, który też odpowiada `null`, daje zgłoszenie o niczym. Pięć z sześciu
  fałszywych alarmów w pierwszej próbce to właśnie to.
* **Metoda `void` nie ma odpowiedzi**, więc jej dwie ścieżki nie mogą się różnić.
  Dwa zgłoszenia mówiły, że metoda zwraca `undefined` na obu ścieżkach — co robi
  każda metoda `void`.

**Obie są naprawione w 0.2.1**, i zmierzone na dwóch korpusach, nie na jednym. Na
dwudziestu jeden plikach, z których pochodziły fałszywe alarmy, reguła 4 zeszła
z 14 zgłoszeń na 8; na pozostałych dziewięćdziesięciu sześciu plikach tego samego
drzewa — z których nie czytano tu żadnego werdyktu — z 37 na 27. JavaScript nie
drgnął wcale.

Poprawkę zestawiono z już zapisanymi werdyktami, jeden po drugim: z sześciu
zgłoszeń reguły 4 ocenionych jako prawdziwe **nie usunięto żadnego**; z siedmiu
ocenionych jako fałszywe — sześć. Siódme zachowało zgłoszenie i przeczepiło się
na prawdziwą ścieżkę pustki niżej w tej samej metodzie, więc przestało być
fałszywym alarmem, zamiast zniknąć. Poprawka, która ucisza zamiast celować,
wyszłaby właśnie tam.

**Nic z tego nie jest twierdzeniem, że trafność wzrosła.** Sześć fałszywych
alarmów z czternastu opuściło korpus, a pozostałych ośmiu nikt nie przeczytał na
nowo. Liczby w tabeli wyżej zmierzono wobec narzędzia w stanie z 2026-09-21 i
zostają przy tej dacie, a nie są korygowane; liczba dla 0.2.1 wymaga świeżej
próbki, ocenionej tak samo, i takiej nie zrobiono.

**Ani jeden fałszywy alarm nie wyszedł z tablic.** Żadnej złej rodziny, żadnej
złej wartości dwuznacznej, żadnego odczytu, który odczytem nie jest. Tablica
odczytów dla Javy powstała z licznika na prawdziwym drzewie — `Files.*` 459 razy,
`.send` 16, każdy z nich to `HttpClient.send` — a trzy kształty, które tablica
pisana z pamięci by niosła, wypadły, bo nic w materiale do nich nie pasowało.

Dwadzieścia sprawdzonych losowo z osiemdziesięciu dziewięciu to dwadzieścia
sprawdzonych. Pozostałych 53 nikt nie przeczytał i nic tu nie twierdzi inaczej.

### Dart — wszystkie dwadzieścia dwa, nie próbka

Dart wszedł w 0.3.0. Zgłosił dwadzieścia dwa miejsca na 78-plikowej aplikacji
Flutter — na tyle mało, że dało się przeczytać każde. „Dwadzieścia dwa z
dwudziestu dwóch" to mocniejsze zdanie niż „dwadzieścia z dwudziestu dwóch",
a próg losowania próbki ustalono na trzydzieści, zanim liczba była znana.

| | wszystkie 22 |
|---|---:|
| **prawdziwe usterki** | **15** |
| celowe i do obrony | 1 |
| **fałszywe alarmy** | **6** |

**Dart nie powtarza wzorca Javy i to jest użyteczna połowa tego pomiaru.**
W Javie każdy fałszywy alarm pochodził z reguły 4. Tutaj reguła 4 nie zgłosiła
nic, a pięć z sześciu pochodzi z reguły 1.

| reguła | zgłoszeń | fałszywych |
|---|---:|---:|
| `swallowed` | 11 | **5** |
| `default-on-error` | 6 | 1 |
| `no-timeout` | 5 | **0** |
| `same-answer` | 0 | — |

Dwie przyczyny:

* **Ślad, którego słownik nie widzi.** Pięć z sześciu to jeden kształt obsługi:
  błąd trafia do logu przez interpolację w napisie, której ta gramatyka nadaje
  własny typ węzła zamiast nazwać identyfikatorem, i przez funkcję wypisującą,
  której nie ma we wspólnej liście wywołań zostawiających ślad. Każda z tych
  połówek osobno wyczyściłaby całą piątkę. Obie są lukami w słowniku, nie
  usterkami reguły — odwrotnie niż w Javie.
* **Komenda logiczna to nie jest dwuznaczna odpowiedź.** Jeden przypadek to
  zapis, którego `false` znaczy „nie wykonało się" — czyli to, co się stało.
  Reguła ma rację co do zapytania w tym samym pliku, które odpowiada `false`
  i na „nie ustawiono", i na „nie dało się sprawdzić"; nie ma racji co do komendy.

`same-answer` nie zgłaszająca nic to pomiar zgadzający się sam ze sobą: ze 105
klauzul `catch` w tym materiale tylko czternaście odpowiada w ogóle wartością,
więc reguła o dwóch ścieżkach dających tę samą odpowiedź nie ma z czym
pracować — i milczy, zamiast sięgać.

**To są miejsca w programie o zamkniętym źródle**: lokalizacje zatrzymane,
werdykty i przyczyny opublikowane, dokładnie jak przy Javie.

Niezmierzone: jak narzędzie zachowuje się na Darcie spoza tej aplikacji. Jeden
produkt, jeden styl, jeden backend — każdy odczyt zewnętrzny w nim jest tego
samego rodzaju.

Każdy werdykt we wszystkich czterech pomiarach zapadł po przeczytaniu kodu w
cytowanej linii. Pełny zapis leży w `test/precision.json`.

## Czego NIE robi

* **Nie zmienia plików.** Wypisuje poprawkę do wklejenia, a poprawka nazywa
  mechanizm, którego już używają sąsiedzi — nie mechanizm w ogóle.
* **Nie ocenia konwencji, tylko odstępstwo od niej.** Tam, gdzie żaden sąsiad
  nie robi inaczej, nie ma zgłoszenia. To milczenie jest policzone i nazwane w
  nagłówku przebiegu; nigdy nie jest pustym miejscem.
* **Nie wie, czy zgłoszenie to błąd.** Ta klasa narzędzi ma opublikowaną
  trafność 18,1% (PR-Miner). Czytaj, oceniaj, wyciszaj.
* **Nie czyta Pythona, Go, Rusta ani SQL-a.** Najpierw JavaScript i TypeScript,
  Java w 0.2.0, Dart w 0.3.0, każdy po pomiarze — patrz
  [Dlaczego najpierw JavaScript](#dlaczego-najpierw-javascript).
* **Nie zastępuje twojego lintera.** Uruchamiaj oba. Pokrywają się dokładnie na
  jednej z czterech reguł, a ta jedna jest tu celowo najsłabsza.

## Cztery reguły

| # | reguła | wymaga sąsiadów | co znajduje |
|---|--------|-----------------|-------------|
| 1 | `swallowed` | nie — najsłabsza | obsługa połykająca błąd bez logu i bez śladu w interfejsie |
| 2 | `default-on-error` | tak | obsługa odpowiadająca `[]`, `0`, `null` albo `false` tam, gdzie ta sama wartość znaczy już „brak danych" |
| 3 | `no-timeout` | tak | odczyt bez limitu czasu obok odczytów tego samego rodzaju, które limit mają |
| 4 | `same-answer` | tak | funkcja, której ścieżka awarii i ścieżka pustki kończą się tym samym wyrażeniem |

Reguła 1 stoi sama i właśnie dlatego jest najsłabsza. To jedyna z czterech,
którą twój linter już pokrywa, więc w rankingu ma wagę pół (`src/rank.mjs`) i
nigdy nie odbierze czoła listy odstępstwu zmierzonemu. Zostaje z dwóch powodów:
gdy *ma* sąsiadów, staje się porównaniem, którego linter nie zrobi, i dostarcza
połowę dowodu tam, gdzie jedno miejsce łamie kilka reguł naraz.

## Jak to wygląda

<!-- lc:example lang=pl -->
```
## [1] default-on-error   api.js:44

     sb.rpc przy awarii odpowiada [], a [] znaczy tez "brak danych"

W CZYM ODSTAJESZ OD WLASNEGO KODU
     3 z 4 obslug bledu na supabase w tym pliku api.js niesie wynik obok wartosci. Ta nie:
       api.js:13   sb.rpc — odpowiada z wynikiem w srodku
       api.js:22   sb.rpc — odpowiada z wynikiem w srodku
       api.js:31   sb.rpc — odpowiada z wynikiem w srodku

DLACZEGO TO WAZNE
     [] to dokladnie to, co zdrowy odczyt zwraca, gdy naprawde nic nie ma.
     Wolajacy dostaje jedno i to samo, wiec "nie dalem rady sprawdzic" przychodzi
     przebrane za "sprawdzone, nie ma".

POPRAWKA
     Powiedz, ktore z dwojga — tak, jak juz robia to sasiedzi wyzej.
     To nie usterka? Napisz `// looks-clean: ok — powod` w tej linii albo nad nia.
```

Odtwórz to u siebie z klonu — `test/fixtures/` jedzie z repozytorium, nie
z paczką:

    $ looks-clean scan test/fixtures/project --rule default-on-error --top 1

Wszystko powyżej to prawdziwy przebieg po `test/fixtures/project`, a
`test/readme.mjs` uruchamia go ponownie i porównuje ten blok z wyjściem linia
po linii. Trzy zacytowane linie to ta część, której nie wyprodukowałby żaden
zbiór reguł, a `test/evidence.mjs` osobno sprawdza, że każda z nich istnieje
i naprawdę robi to, co zgłoszenie o niej mówi.

## Od czego zacząć

Node 18 albo nowszy.

```
git clone https://github.com/wojnarowicz-dev/looks-clean.git
cd looks-clean
npm install
```

    $ looks-clean scan <dir> --json .looks-clean/run.json
    $ looks-clean rank .looks-clean/run.json
    $ looks-clean rules

Przeskanuj i zapisz przebieg; przeczytaj wg siły dowodu; uruchom później
ponownie, a pokaże tylko to, co NOWE. Po `npm i -g` polecenie to `looks-clean`;
w sklonowanym repo użyj `npx looks-clean` albo `node bin/looks-clean.mjs`.
Wszystko przyjmuje `--lang pl`.

| polecenie | |
|---|---|
| `scan <dir>` | cztery reguły na drzewie JavaScript, TypeScript, Java albo Dart |
| `rank <run.json> [...]` | jedna lista ponad zapisami — co czytać pierwsze |
| `diff <a.json> <b.json>` | co doszło, co zniknęło, co się zmieniło |
| `rules` | cztery reguły i to, która potrzebuje sąsiadów |

Flagi: `--rule`, `--layer`, `--minpop`, `--top`, `--verbose`, `--all`,
`--json`, `--config`, `--include-generated`, `--lang`, `--help`, `--version`.

Kody wyjścia: `0` nic nowego, `1` są nowe zgłoszenia, `2` problem jest po
stronie wejścia.

## Warstwa

Dwa miejsca są sąsiadami, gdy leżą **w tym samym miejscu** i należą do **tej
samej rodziny operacji** — supabase, net, db, proc, fs, parse, storage,
assets albo dynamiczny import. Obie połowy mają znaczenie: `saveDream`
i `saveProfile` w jednym pliku serwisu pisze ta sama ręka pod tymi samymi
ograniczeniami, a `fetch` nie jest porównywalny z `JSON.parse`.

Warstwa wspina się po drabinie, gdy grupa jest za mała, żeby cokolwiek
powiedzieć:

```
--layer file (domyślnie)   plik, potem katalog
--layer dir                katalog, potem całe przeskanowane drzewo
--layer root               całe przeskanowane drzewo
```

Szczebel, który faktycznie przemówił, jest wypisany przy każdym zgłoszeniu.
Porównania, którego zasięgu czytelnik nie widzi, nie da się sprawdzić.

Najwyższy szczebel nie zostaje osiągnięty przypadkiem: w skali projektu „9 z 400
odczytów ma limit" to fakt o bazie kodu, nie o tym wywołaniu. Istnieje, bo
drzewo funkcji brzegowych Deno — jeden plik na katalog — inaczej nie dawało
niczego.

## Wynik

```
wynik = konwencjonalność x populacja x rzadkość
```

Mnożenie, nie suma: zgłoszenie jest wysoko tylko wtedy, gdy **wszystkie trzy**
są wysokie. Mocna konwencja na trzech przykładach nie znaczy nic i tak samo duża
populacja, w której odstaje połowa. Skala jest porządkowa — 94 znaczy „czytaj to
przed tym z 32", a nie „94% szans na błąd".

Jedno miejsce łamiące kilka reguł jest scalane w jeden wpis, bo to jedna decyzja
dla człowieka; pozostałe reguły stoją obok jako `also breaks:`.

## Wyciszanie

Napisz `// looks-clean: ok — powód` w tej linii albo nad nią. Miejsce nadal jest
**czytane i nadal liczy się do populacji** — znika wyłącznie z raportu.
Wyciszenie zrobione jako wykluczenie osłabiałoby tę samą regułę, która je
złapała.

`.looks-clean.json` w skanowanym katalogu dokłada wykluczenia do listy
wbudowanej. Wykluczenia zmieniają to, co jest CZYTANE, a więc zmieniają
populację i zgłoszenie; wyciszenia zmieniają tylko to, co jest POKAZANE. Te dwie
rzeczy są celowo trzymane osobno.

## Dlaczego najpierw JavaScript

Z pomiaru, nie z gustu. Sześć znanych usterek prześledzono ręcznie przed
napisaniem pierwszej linii; **pięć z sześciu było JavaScriptem albo
TypeScriptem** i były osiągalne w prawdziwym materiale. Szósta to sprawdzarka
migracji SQL i została zapisana jako poza zakresem języka, nie jako
nieznaleziona — patrz `test/known-answers.mjs`. Siódma odpowiedź, w Javie,
doszła z 0.2.0.

Dwa dalsze powody, wagą:

* Reguła 3 potrzebuje populacji odczytów, w której limity są **wymieszane**. W
  asynchronicznym JavaScripcie taka populacja jest gęsta, a mechanizmy
  rozpoznawalne: `AbortSignal.timeout`, `AbortController` odpalony z
  `setTimeout`, `Promise.race`, opcja `timeout:`. W Javie to samo pytanie
  rozkłada się na kilkanaście niepowiązanych API.

  **To przewidywanie zostało zmierzone i się sprawdziło.** Na drzewie w Javie
  wyżej reguła 3 nie zgłosiła nic: 78 odczytów zewnętrznych i wszystkie 78
  pominiętych z tego samego, wypisanego powodu — nigdzie w tym drzewie nie ma
  limitu czasu, od którego dałoby się odstawać. Reguła zamilkła, powiedziała o
  tym w nagłówku i miała rację. Reguła, która by zgadywała, zgłosiłaby 78 razy.
* Tokenizer i warstwa parsowania przeszły z `odd-one-out` bez zmian. Jedna
  gramatyka `tree-sitter-typescript` czyta `.js .mjs .cjs .ts .mts`, a gramatyka
  `tsx` pokrywa JSX. Żeby zacząć mierzyć, nie trzeba było niczego wymyślać.

Reszta po pomiarze — to ta sama dyscyplina, której narzędzie wymaga od
czytelnika.

## Dziesięć warstw testowych

    $ npm test

Jeden runner, `test/all.mjs`. Każda warstwa łapie coś, czego nie widzi żadna
inna, i każda ma własny kod wyjścia: `0` przeszła, `1` padła, `2` nie dosięgła
materiału. **Warstwa pominięta nie jest warstwą, która przeszła**, więc czysty
przebieg całości w tym repozytorium kończy się kodem 2 — sprawdzarka migracji ze
znanej odpowiedzi 4 to narzędzie SQL-owe, a zestaw odmawia nazwania tego
sukcesem.

| | warstwa | co widzi tylko ona |
|---|---|---|
| 1 | `npm run vocabulary` | tabele, przez które reguły patrzą — wpis, który niczego nie dopasowuje, jest niewidoczny dla każdej innej warstwy |
| 2 | `npm run lang-check` | oba języki kompletne i żadne zdanie omijające słownik |
| 3 | `npm run negative` | kod, którego NIE wolno zgłosić, z kontrolami, które nadal muszą się odpalać |
| 4 | `npm run golden` | nagrane przebiegi, pole po polu, razem z odciskami |
| 5 | `npm run amplify` | że wyjście w ogóle zależy od wejścia |
| 6 | `npm run population` | że arytmetyka każdego zgłoszenia opisuje prawdziwą grupę |
| 7 | `npm run evidence` | że każdy zacytowany sąsiad istnieje i robi to, co zgłoszenie mówi |
| 8 | `npm run resilience` | pada głośno, nigdy po cichu |
| 9 | `npm run readme` | że ta strona zgadza się z narzędziem i co wysłałby `npm pack` |
| 10 | `npm run known-answers` | sześć prześledzonych ręcznie usterek, jako kontrakt |

Każda warstwa ma sprawdzenie negatywne: została celowo zepsuta, pokazano, że
pada, i cofnięto. Test, którego nie da się zmusić do porażki, nie jest testem.

### Trzy usterki, które te warstwy znalazły we własnym kodzie narzędzia

Najlepszym dowodem, że narzędzie działa, jest skierowanie go na własnego autora.

1. **Przebieg, który nic nie porównał, zgłosił `findings: 0`.** Złapane przez
   `test/resilience.mjs`. W projekcie, w którym żadna grupa sąsiadów nie
   osiągnęła progu, trzy z czterech reguł nie miały nic do powiedzenia, a
   przebieg wypisał zero i skończył — czytelnik nie odróżniłby tego od czystej
   bazy kodu. Reguły zapisują teraz, *dlaczego* zamilkły, a dwa rodzaje
   milczenia są liczone osobno w nagłówku. To dokładnie ta usterka, którą
   narzędzie zgłasza w cudzym kodzie, dostarczona w nim samym.

2. **Cała klasa odczytów z bazy była niewidoczna.** Złapane przez
   `test/vocabulary.mjs`. `sb.from('x').select('y')` w ogóle nie był
   rozpoznawany jako odczyt, bo dopasowanie rodziny szukało klienta o nazwie
   `supabase` — a prawdziwy kod pisze `const sb = createClient(...)`. Każdy
   odczyt tabeli wypadał z populacji, więc każde zgłoszenie w tej grupie stało
   na słabszym dowodzie, niż twierdziło, i żadna liczba nigdzie tego nie mówiła.
   Poprawka od razu zepsuła `sb.rpc`, co ta sama warstwa złapała w tym samym
   przebiegu.

3. **Narzędzie połykało błąd przy szukaniu własnej konfiguracji.** Złapane przez
   `npm run self-check` — narzędzie na własnych źródłach. Błąd uprawnień przy
   szukaniu `.looks-clean.json` był obsłużony jako „brak konfiguracji", co
   zmienia listę wykluczeń, co zmienia każdą populację w przebiegu. Jedynym
   śladem byłaby inna liczba zgłoszeń.

Self-check jest teraz czysty, a cztery miejsca, w których połknięta awaria jest
właściwą odpowiedzią, noszą wypisany `// looks-clean: ok — powód` z
uzasadnieniem.

## Wzięte z odd-one-out

Warstwa parsowania, tokenizer, zapis przebiegu i różnica między przebiegami,
ranking, warstwy konfiguracji i wyciszeń, warstwy wejścia i kodowania oraz
kształt zestawów golden i odporności przyszły z `odd-one-out`, zamiast być
pisane od nowa. Razem z nimi przyszły komentarze: kilka z nich zapisuje usterkę,
za którą raz już zapłacono — dlaczego odcisk zapisu nie zawiera numeru linii i
dlaczego zapis trafia najpierw do pliku obok, a dopiero potem jest przemianowany
na miejsce.

## Licencja

MIT — Aleksander Wojnarowicz. Patrz `LICENSE`.
