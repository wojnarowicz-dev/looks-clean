# looks-clean

*[English](README.md)*

**Dla kogoś, kto o drugiej w nocy musi odpowiedzieć, czy ekran jest pusty
dlatego, że nic tam nie ma, czy dlatego, że coś padło — i nie ma jak tego
poznać z kodu.**

`looks-clean` czyta projekt w JavaScripcie albo TypeScripcie i szuka miejsc, w
których awaria jest nieodróżnialna od pustego wyniku: tam, gdzie program mówi
*nic nie znalazłem* zamiast *nie dałem rady sprawdzić*.

Nie ma poglądów. Ma sąsiadów.

<!-- lc:claim name=rules value=4 -->
<!-- lc:claim name=rulesNeedingPopulation value=3 -->
<!-- lc:claim name=layers value=10 -->
<!-- lc:claim name=knownAnswers value=6 -->
<!-- lc:claim name=knownAnswersInScope value=5 -->
<!-- lc:claim name=families value=8 -->
<!-- lc:claim name=languages value=2 -->
<!-- lc:claim name=messages value=135 -->
<!-- lc:claim name=fixtureFindings value=7 -->
<!-- lc:claim name=fixturePlanted value=4 -->
<!-- lc:claim name=cleanFindings value=0 -->
<!-- lc:claim name=defaultExclusions value=13 -->
<!-- lc:claim name=precisionProjects value=3 -->
<!-- lc:claim name=precisionReported value=409 -->
<!-- lc:claim name=precisionChecked value=30 -->
<!-- lc:claim name=precisionReal value=2 -->
<!-- lc:claim name=precisionNoise value=28 -->
<!-- lc:claim name=precisionTestCode value=12 -->

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

**2 prawdziwe defekty i 28 fałszywych alarmów na 30 sprawdzonych zgłoszeń.**
Te 30 to pierwsza dziesiątka z każdego z trzech projektów, których wcześniej nie
czytałem, a które łącznie zgłosiły 409. Dziesięć sprawdzonych z 359 to dziesięć
sprawdzonych — to nie jest trafność narzędzia na całym przebiegu i nic tutaj
tego nie twierdzi.

| projekt | charakter | zgłoszeń | sprawdzonych | trafnych | fałszywych |
|---|---|---:|---:|---:|---:|
| [got](https://github.com/sindresorhus/got) | biblioteka klienta HTTP, TypeScript | 359 | 10 | 0 | 10 |
| [uptime-kuma](https://github.com/louislam/uptime-kuma) | aplikacja monitorująca, JavaScript | 34 | 10 | 2 | 8 |
| [eslint](https://github.com/eslint/eslint) | narzędzie deweloperskie, JavaScript | 16 | 10 | 0 | 10 |

Trójkę wybrano przed uruchomieniem narzędzia, według jednego ogłoszonego
kryterium — gęstości obsługi błędów, bo trzy z czterech reguł potrzebują
populacji — i żaden z nich nie jest mój. Każdy werdykt zapadł po przeczytaniu
kodu w cytowanej linii. Pełny zapis, z powodem przy każdym z trzydziestu, leży
w `test/precision.json`.

**Co łączy fałszywe alarmy.** W 20 z 28 awaria *jest* obsłużona — limitem czasu
na wywołaniu obejmującym, odpowiedzią HTTP 400, kompensującym `destroy()`,
udokumentowanym zapasowym torem albo testem, którego całym tematem jest brak
limitu. Narzędzie ocenia obsługę po kształcie jej własnego ciała i po wartości,
którą zwraca, a żadna z tych dwóch rzeczy nie pokazuje, dokąd awaria naprawdę
poszła.

Największa pojedyncza dźwignia jest prostsza: **12 z 30 to kod testowy**, a 350
z 359 zgłoszeń w `got` leży pod `test/`. Plik testowy nie jest warstwą — jego
kształt dyktuje to, co dany test sprawdza, a nie wspólna decyzja inżynierska — a
katalogów testowych nie ma dziś we wbudowanych wykluczeniach.

Pomiar znalazł też cztery usterki w samym narzędziu, żadna jeszcze
niepoprawiona: `{ timeout }` zapisany skrótowo nie jest rozpoznawany jako limit;
`fsp.stat(...).catch(...)` liczy się jako dwa odczyty i jest zgłaszany dwa razy;
wywołanie `*Sync` nigdy nie może mieć limitu, więc zawsze wypada jako odstające;
a awaria wykryta zwykłym predykatem trafia na ścieżkę pustki. Zostają
niepoprawione celowo — poprawienie ich i ponowny pomiar na tych samych trzech
projektach byłby strojeniem narzędzia pod własny test, a tak właśnie liczba
trafności staje się bezwartościowa.

## Czego NIE robi

* **Nie zmienia plików.** Wypisuje poprawkę do wklejenia, a poprawka nazywa
  mechanizm, którego już używają sąsiedzi — nie mechanizm w ogóle.
* **Nie ocenia konwencji, tylko odstępstwo od niej.** Tam, gdzie żaden sąsiad
  nie robi inaczej, nie ma zgłoszenia. To milczenie jest policzone i nazwane w
  nagłówku przebiegu; nigdy nie jest pustym miejscem.
* **Nie wie, czy zgłoszenie to błąd.** Ta klasa narzędzi ma opublikowaną
  trafność 18,1% (PR-Miner). Czytaj, oceniaj, wyciszaj.
* **Nie czyta Javy, Pythona, Darta, Go ani SQL-a.** Najpierw jeden język,
  wybrany pomiarem — patrz [Dlaczego najpierw JavaScript](#dlaczego-najpierw-javascript).
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

Odtwórz to u siebie:

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
| `scan <dir>` | cztery reguły na drzewie JavaScript/TypeScript |
| `rank <run.json> [...]` | jedna lista ponad zapisami — co czytać pierwsze |
| `diff <a.json> <b.json>` | co doszło, co zniknęło, co się zmieniło |
| `rules` | cztery reguły i to, która potrzebuje sąsiadów |

Flagi: `--rule`, `--layer`, `--minpop`, `--top`, `--verbose`, `--all`,
`--json`, `--config`, `--include-generated`, `--lang`, `--help`, `--version`.

Kody wyjścia: `0` nic nowego, `1` są nowe zgłoszenia, `2` problem jest po
stronie wejścia.

## Warstwa

Dwa miejsca są sąsiadami, gdy leżą **w tym samym miejscu** i należą do **tej
samej rodziny operacji** — supabase, net, db, proc, fs, parse, storage albo
dynamiczny import. Obie połowy mają znaczenie: `saveDream` i `saveProfile` w
jednym pliku serwisu pisze ta sama ręka pod tymi samymi ograniczeniami, a
`fetch` nie jest porównywalny z `JSON.parse`.

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
napisaniem pierwszej linii; **pięć z sześciu to JavaScript albo TypeScript** i są
osiągalne w prawdziwym materiale. Szósta to sprawdzarka migracji SQL i została
zapisana jako poza zakresem języka, nie jako nieznaleziona — patrz
`test/known-answers.mjs`.

Dwa dalsze powody, wagą:

* Reguła 3 potrzebuje populacji odczytów, w której limity są **wymieszane**. W
  asynchronicznym JavaScripcie taka populacja jest gęsta, a mechanizmy
  rozpoznawalne: `AbortSignal.timeout`, `AbortController` odpalony z
  `setTimeout`, `Promise.race`, opcja `timeout:`. W Javie to samo pytanie
  rozkłada się na kilkanaście niepowiązanych API.
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
znanej odpowiedzi 4 nie jest JavaScriptem, a zestaw odmawia nazwania tego
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
