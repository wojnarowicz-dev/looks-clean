# looks-clean

**Pusty `catch` znajdują już eslint (`no-empty`), analizator Darta
(`empty_catches`) i analizator C# (`AL0115`); żaden z nich nie powie natomiast
„`saveDream` ma limit czasu, `saveProfile` nie ma, a to ta sama warstwa” —
i to porównanie z sąsiednim kodem jest całym tym narzędziem.**

Szuka miejsc, w których awaria jest nieodróżnialna od pustego wyniku: tam, gdzie
program mówi *nic nie znalazłem* zamiast *nie dałem rady sprawdzić*.

Linter nosi swój wyrok ze sobą — pusty catch jest zły wszędzie, gdzie go
znajdzie. Tutaj nic nie jest złe samo z siebie. Miejsce trafia do raportu
dlatego, że miejsca **obok niego**, robiące tę samą robotę na tym samym
poziomie, robią to inaczej.

---

## Cztery reguły

| # | reguła | wymaga sąsiadów | co znajduje |
|---|--------|-----------------|-------------|
| 1 | `swallowed` | nie — najsłabsza | obsługa połykająca błąd bez logu i bez śladu w interfejsie |
| 2 | `default-on-error` | tak | obsługa odpowiadająca `[]`, `0`, `null` albo `false` tam, gdzie ta sama wartość znaczy już „brak danych” |
| 3 | `no-timeout` | tak | odczyt bez limitu czasu obok odczytów tego samego rodzaju, które limit mają |
| 4 | `same-answer` | tak | funkcja, której ścieżka awarii i ścieżka pustki kończą się tym samym wyrażeniem |

Reguły 2, 3 i 4 potrzebują populacji: porównują miejsce z sąsiadami i zgłaszają
wyłącznie odstępstwo. **Gdzie nie ma konwencji do złamania, nie ma zgłoszenia —
a przebieg mówi o tym wprost**, z liczbą, zamiast wypisać `findings: 0`.

Reguła 1 stoi sama i właśnie dlatego jest najsłabsza z czterech. W rankingu ma
wagę pół (patrz `src/rank.mjs`), więc nigdy nie odbierze czoła listy odstępstwu
zmierzonemu. Zostaje z dwóch powodów: gdy *ma* sąsiadów, staje się porównaniem,
którego linter nie zrobi, i dostarcza połowę dowodu pozostałym regułom tam,
gdzie jedno miejsce łamie kilka naraz.

## Jak to wygląda

```
## [1] default-on-error   vap-account-panel.js:248

     sb.rpc przy awarii odpowiada [], a [] znaczy tez "brak danych"

W CZYM ODSTAJESZ OD WLASNEGO KODU
     4 z 6 obslug bledu na supabase w tym pliku vap-account-panel.js niesie
     wynik obok wartosci. Ta nie:
       vap-account-panel.js:185   sb.rpc — odpowiada z wynikiem w srodku
       vap-account-panel.js:225   sb.rpc — odpowiada z wynikiem w srodku
       vap-account-panel.js:235   sb.rpc — odpowiada z wynikiem w srodku
       vap-account-panel.js:1293  sb.rpc — odpowiada z wynikiem w srodku

DLACZEGO TO WAZNE
     [] to dokladnie to, co zdrowy odczyt zwraca, gdy naprawde nic nie ma.
     Wolajacy dostaje jedno i to samo, wiec "nie dalem rady sprawdzic"
     przychodzi przebrane za "sprawdzone, nie ma".

POPRAWKA
     Powiedz, ktore z dwojga — tak, jak juz robia to sasiedzi wyzej.
```

To prawdziwe zgłoszenie w prawdziwym kodzie, a cztery linie pod nagłówkiem to
ta część, której nie wyprodukowałby żaden zbiór reguł.

## Od czego zacząć

Node 18 albo nowszy.

```
git clone <to repo> && cd looks-clean && npm install

npx looks-clean scan ./src --json .looks-clean/run.json --lang pl
npx looks-clean rank .looks-clean/run.json --lang pl
npx looks-clean scan ./src --json .looks-clean/run.json --lang pl   # później: tylko NOWE
```

Po `npm i -g` polecenie to po prostu `looks-clean`.

| polecenie | |
|---|---|
| `scan <katalog>` | cztery reguły na drzewie JavaScript/TypeScript |
| `rank <run.json> [...]` | jedna lista wg siły dowodu — co czytać pierwsze |
| `diff <a.json> <b.json>` | co doszło, co zniknęło, co się zmieniło |
| `rules` | cztery reguły i to, która potrzebuje sąsiadów |

Flagi: `--rule <id>`, `--layer file|dir|root`, `--minpop 3`, `--top 15`,
`--verbose`, `--all`, `--include-generated`, `--config <plik>`.

Kody wyjścia: `0` nic nowego, `1` są nowe zgłoszenia, `2` problem jest po
stronie wejścia.

## Warstwa

Dwa miejsca są sąsiadami, gdy leżą **w tym samym miejscu** i należą do **tej
samej rodziny operacji** — sieć, supabase, baza, system plików, podproces,
parsowanie, storage. Obie połowy mają znaczenie: `saveDream` i `saveProfile` w
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

Najwyższy szczebel nie zostaje osiągnięty przypadkiem, a powód stoi w
`src/layer.mjs`: w skali projektu „9 z 400 odczytów ma limit” to fakt o bazie
kodu, nie o tym wywołaniu. Istnieje, bo drzewo funkcji brzegowych Deno — jeden
plik na katalog — inaczej nie dawało niczego.

## Wynik

```
wynik = konwencjonalność x populacja x rzadkość
```

Mnożenie, nie suma: zgłoszenie jest wysoko tylko wtedy, gdy **wszystkie trzy**
są wysokie. Mocna konwencja na trzech przykładach nie znaczy nic i tak samo
duża populacja, w której odstaje połowa. Skala jest porządkowa — 94 znaczy
„czytaj to przed tym z 32”, a nie „94% szans na błąd”.

Jedno miejsce łamiące kilka reguł jest scalane w jeden wpis, bo to jedna
decyzja dla człowieka; pozostałe reguły stoją obok jako `also breaks:`.

## Dlaczego najpierw JavaScript

Z pomiaru, nie z gustu. Sześć znanych usterek prześledzono ręcznie przed
napisaniem pierwszej linii; **pięć z sześciu to JavaScript albo TypeScript** i są
osiągalne w materiale na tej maszynie — szósta to sprawdzarka migracji SQL i
została zapisana jako poza zakresem języka, nie jako nieznaleziona
(`test/known-answers.mjs`).

Dwa dalsze powody, wagą:

* Reguła 3 potrzebuje populacji odczytów, w której limity są **wymieszane**. W
  asynchronicznym JavaScripcie taka populacja jest gęsta, a mechanizmy
  rozpoznawalne — `AbortSignal.timeout`, `AbortController` odpalony z
  `setTimeout`, `Promise.race`, opcja `timeout:`. W Javie to samo pytanie
  rozkłada się na kilkanaście niepowiązanych API.
* Tokenizer i warstwa parsowania przeszły z `odd-one-out` bez zmian: jedna
  gramatyka `tree-sitter-typescript` czyta `.js .mjs .cjs .ts .mts`, a gramatyka
  `tsx` pokrywa JSX. Żeby zacząć mierzyć, nie trzeba było niczego wymyślać.

Reszta po pomiarze — to ta sama dyscyplina, której narzędzie wymaga od
czytelnika.

## Czego nie zrobi

* Nigdy nie zmienia pliku. Wypisuje poprawkę do wklejenia, a poprawka nazywa to,
  czego już używają sąsiedzi.
* Z natury szumi. Ta klasa narzędzi ma opublikowaną trafność 18,1% (PR-Miner).
  Czytaj, oceniaj, wyciszaj.
* Wyciszanie odbywa się na miejscu: `// looks-clean: ok — powód` w linii albo nad
  nią. Miejsce nadal jest **czytane i nadal liczy się do populacji** — znika
  wyłącznie z raportu. Wyciszenie zrobione jako wykluczenie osłabiałoby tę samą
  regułę, która je złapała.
* Pliki generowane i zbundlowane są pomijane, a przebieg podaje ile. Wyjście
  minifikatora nie jest niczyją konwencją — zanim to doszło, raport trzy razy
  cytował czytelnikowi `supabase-js-2.112.4.js:7` jako dowód o jego własnym
  kodzie. `--include-generated` czyta je mimo to.

## Testy

```
npm test               golden + odporność + kontrola języka
npm run known-answers  sześć prawdziwych usterek (wymaga sąsiednich repozytoriów)
```

**`test/golden.mjs`** — pełny przebieg po `test/fixtures/`, porównany pole po
polu z nagraniem, razem z odciskami. Zaplanowane są cztery odstępstwa, po jednym
na regułę, i każde jest dodatkowo sprawdzane z nazwy, żeby nagrania nie dało się
zaktualizować do bezużyteczności. `test/fixtures/README.md` opisuje każde z nich
— w tym to, dlaczego żadne nie wywróciłoby lintera.

**`test/resilience.mjs`** — trzynaście scenariuszy, które celowo coś psują, każdy
klasyfikowany jako `LOUD` / `SPOKE` / `SILENT` / `CRASH`. Każdy scenariusz biegnie
dwa razy, uszkodzony i zdrowy, a fraza liczy się tylko wtedy, gdy zdrowy przebieg
jej **nie** wypisuje — inaczej scenariusz przechodzi na słowie „snapshot” ze
zwykłej linii `run snapshot saved`. `SILENT` to porażka: skaner, który trafia na
zepsuty plik, nic nie czyta i wypisuje `findings: 0`, popełnił dokładnie tę
usterkę, którą zgłasza.

Ten zestaw już się opłacił. Złapał narzędzie mówiące projektowi, w którym nie
było z czym porównywać, że ma `findings: 0` — patrz komentarz w `src/scan.mjs`.

**`test/lang-check.mjs`** — każdy komunikat istnieje w obu językach z tymi samymi
slotami argumentów i żaden plik źródłowy nie wypisuje zdania, które ominęło
słownik. Ta trzecia kontrola znalazła cztery notki o sąsiadach zaszyte po
angielsku, przez co `--lang pl` wypisywał nagłówki po polsku, a dowody po
angielsku.

**`test/known-answers.mjs`** — te sześć. Stany to `LIVE`, `RECONSTRUCTED` i
`SKIP`; `SKIP` kończy się kodem 2 i nazywa, czego brakuje, bo „nie dałem rady
sprawdzić” i „sprawdzone, jest dobrze” nie mogą wyglądać tak samo — a już
najmniej tutaj.

## Wzięte z odd-one-out

Warstwa parsowania, tokenizer, zapis przebiegu i różnica między przebiegami,
ranking, warstwy konfiguracji i wyciszeń, warstwy wejścia i kodowania oraz
kształt zestawów golden i odporności przyszły z
[`odd-one-out`](../odd-one-out), zamiast być pisane od nowa. Razem z nimi
przyszły komentarze: kilka z nich zapisuje usterkę, za którą raz już zapłacono —
na przykład dlaczego odcisk zapisu nie zawiera numeru linii i dlaczego zapis
trafia najpierw do pliku obok, a dopiero potem jest przemianowany na miejsce.

## Licencja

MIT.
