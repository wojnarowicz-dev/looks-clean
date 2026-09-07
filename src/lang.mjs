// looks-clean — every sentence a person reads, in two languages.
//
// EVERY string a person sees lives HERE, not in the rules. A rule calls
// `t('key', args)` and does not know which language it is writing in.
// Translations spread across files end with half the output stuck in one
// language, and that is only visible to somebody who does not speak it.
//
// English is the default. `--lang pl` switches to Polish.
//
// NOT TRANSLATED: file paths, identifier names, rule ids, flag names, snippets
// of the analysed code. Those are data, not prose.
import { valueOf } from './args.mjs';

const argv = process.argv.slice(2);
const LANG = String(valueOf(argv, 'lang', 'en')).toLowerCase() === 'pl' ? 'pl' : 'en';
export const language = LANG;

const S = {
  // ---------------------------------------------------------------- common
  'root': { en: 'root=', pl: 'katalog=' },
  'settings': { en: 'settings: ', pl: 'ustawienia: ' },
  'savedRun': { en: 'run snapshot saved: {0}  (findings: {1})', pl: 'zapis przebiegu: {0}  (zgloszen: {1})' },
  'snapshotNeedsPath': {
    en: '!! --json needs the path of a file to write.',
    pl: '!! --json wymaga sciezki pliku do zapisania.' },
  'snapshotUnreadable': {
    en: '!! The previous run at {0} could not be read ({1}).',
    pl: '!! Poprzedniego przebiegu z {0} nie da sie odczytac ({1}).' },
  'snapshotUnreadableHint': {
    en: '   Everything below is reported as new, because there is nothing to compare with.',
    pl: '   Wszystko ponizej jest zgloszone jako nowe, bo nie ma z czym porownac.' },
  'snapshotBadVersion': { en: 'snapshot version {0}, expected {1}', pl: 'zapis w wersji {0}, oczekiwano {1}' },
  'snapshotWriteFailed': { en: '!! Could not write the run to {0}: {1}', pl: '!! Nie udalo sie zapisac przebiegu do {0}: {1}' },
  'snapshotWriteHintDir': {
    en: '   --json takes the path of a FILE to write, and that is a directory.',
    pl: '   --json przyjmuje sciezke PLIKU do zapisania, a to jest katalog.' },
  'nonUtf8Files': {
    en: 'Note: {0} file(s) held bytes outside UTF-8 and were read with those bytes replaced, so the result may be incomplete: {1}',
    pl: 'Uwaga: {0} plik(ow) zawieral bajty spoza UTF-8 i zostal wczytany z ich podmiana, wiec wynik moze byc niepelny: {1}' },
  'parseErrors': {
    en: 'Note: {0} file(s) did not parse cleanly, so they contributed fewer sites than they contain and every population below is smaller than the file count suggests: {1}',
    pl: 'Uwaga: {0} plik(ow) nie sparsowalo sie czysto, wiec wnioslo mniej miejsc, niz zawiera, a kazda populacja nizej jest mniejsza, niz sugeruje liczba plikow: {1}' },
  'generatedSkipped': {
    en: 'Skipped {0} generated or bundled file(s): a minifier\'s output is nobody\'s convention, and it would be quoted back as a neighbour. {1}   (--include-generated reads them anyway)',
    pl: 'Pominalem {0} plikow generowanych lub zbundlowanych — wyjscie minifikatora nie jest niczyja konwencja, a zostaloby zacytowane jako sasiad: {1}   (--include-generated czyta je mimo to)' },
  'notRead': {
    en: 'not read: {0} file(s) behind {1} excluded director(ies){2}, and {3} excluded file(s)',
    pl: 'nieprzeczytane: {0} plikow za {1} wykluczonymi katalogami{2} i {3} wykluczonych plikow' },
  'notReadWorst': { en: '   largest: {0}', pl: '   najwieksze: {0}' },
  'notReadAtLeast': { en: ' (counted up to a cap, so at least that many)', pl: ' (liczone do limitu, wiec co najmniej tyle)' },
  'notReadLouder': {
    en: '   More was excluded than was read. If your sources live under a path that looks\n   like a dependency or a test directory, they were skipped: read the list above\n   before taking this result for a clean one.',
    pl: '   Wykluczono wiecej, niz przeczytano. Jesli twoje zrodla leza pod sciezka\n   wygladajaca jak zaleznosc albo katalog testowy, zostaly pominiete: przeczytaj\n   liste wyzej, zanim uznasz ten wynik za czysty.' },
  'mutedByComment': { en: 'muted by comment: {0}', pl: 'wyciszone komentarzem: {0}' },
  'mutedByConfig': { en: 'muted by config file: {0}', pl: 'wyciszone plikiem konfiguracyjnym: {0}' },
  'diffVsPrevious': {
    en: 'diff vs previous run: NEW={0}  GONE={1}  CHANGED={2}  unchanged={3}   (--all shows the full list)',
    pl: 'diff wobec poprzedniego przebiegu: NOWE={0}  ZNIKNELO={1}  ZMIENIONE={2}  bez zmian={3}   (--all pokazuje cala liste)' },
  'onlyNewShown': { en: '  (shown below: new and changed only)', pl: '  (pokazane ponizej: tylko nowe i zmienione)' },
  'exclusions': { en: 'exclusions={0}', pl: 'wykluczen={0}' },
  'defaults': { en: ' (defaults)', pl: ' (domyslne)' },
  'mutes': { en: '  mutes={0}', pl: '  wyciszen={0}' },
  'noReason': { en: '(no reason given)', pl: '(bez powodu)' },
  'unknownCommand': { en: 'Unknown command: {0}', pl: 'Nieznane polecenie: {0}' },
  'unknownRule': { en: 'Unknown rule: {0}. Known rules: {1}', pl: 'Nieznana regula: {0}. Znane reguly: {1}' },
  'unknownLayer': { en: 'Unknown layer: {0}. Allowed: file, dir, root.', pl: 'Nieznana warstwa: {0}. Dozwolone: file, dir, root.' },
  'diffNeedsTwo': { en: 'diff needs two files: <previous.json> <current.json>', pl: 'diff wymaga dwoch plikow: <poprzedni.json> <biezacy.json>' },
  'rankNeedsOne': { en: 'rank needs at least one snapshot file', pl: 'rank wymaga co najmniej jednego pliku zapisu' },
  'configUnreadable': { en: '!! Could not read {0}: {1}', pl: '!! Nie udalo sie wczytac {0}: {1}' },
  'configLookupFailed': {
    en: '!! Could not look for .looks-clean.json in: {0}',
    pl: '!! Nie dalo sie poszukac .looks-clean.json w: {0}' },
  'configFallback': { en: '   Carrying on with the default settings.', pl: '   Ide dalej z ustawieniami domyslnymi.' },

  // ---------------------------------------------------------------- input
  'inputNoSuchPath': { en: 'Path does not exist: {0}', pl: 'Sciezka nie istnieje: {0}' },
  'inputUnreadable': { en: 'Path cannot be read: {0} ({1})', pl: 'Sciezki nie da sie odczytac: {0} ({1})' },
  'inputNotDir': { en: 'That is not a directory: {0}', pl: 'To nie jest katalog: {0}' },
  'inputNotFile': { en: 'That is not a file: {0}', pl: 'To nie jest plik: {0}' },
  'inputMissingArg': { en: 'Missing argument: {0}', pl: 'Brakuje argumentu: {0}' },
  'inputHintPath': { en: '   Check the path, or the permissions on it.', pl: '   Sprawdz sciezke albo uprawnienia do niej.' },
  'inputHintDir': { en: '   This command scans a directory tree.', pl: '   To polecenie skanuje drzewo katalogow.' },
  'inputHintFile': { en: '   This command reads a single file.', pl: '   To polecenie czyta pojedynczy plik.' },

  // ---------------------------------------------------------------- population
  'noSourcesFound': {
    en: 'No {0} files under {1}.',
    pl: 'Nie znalazlem plikow {0} w {1}.' },
  'noSourcesHint': {
    en: '   This is NOT the same as "nothing found": there was nothing to read.\n   looks-clean reads .js .mjs .cjs .jsx .ts .mts .tsx and inline <script> in .html.',
    pl: '   To NIE to samo, co "nic nie znalazlem": nie bylo czego czytac.\n   looks-clean czyta .js .mjs .cjs .jsx .ts .mts .tsx oraz <script> w .html.' },
  'noPopulation': {
    en: '{0} site(s) read, and not one peer group reached {1} members.',
    pl: 'Wczytalem {0} miejsc i zadna grupa sasiadow nie osiagnela {1} czlonkow.' },
  'noPopulationHint': {
    en: '   Three of the four rules are comparisons against neighbours; with no\n   neighbours there is nothing to compare. This is NOT a clean bill of health.\n   Try --layer dir, or a lower --minpop.',
    pl: '   Trzy z czterech regul to porownanie z sasiadami; bez sasiadow nie ma z czym\n   porownywac. To NIE jest zaswiadczenie o czystosci.\n   Sprobuj --layer dir albo nizszego --minpop.' },
  'noConvention': {
    en: 'the whole peer group does it this way — nothing to deviate from',
    pl: 'cala grupa sasiadow robi tak samo — nie ma od czego odstawac' },
  'tooFewPeers': { en: 'only {0} peer(s), {1} needed', pl: 'tylko {0} sasiadow, potrzeba {1}' },

  // ---------------------------------------------------------------- scan report
  'scanTitle': { en: 'looks-clean — failure that is indistinguishable from an empty result', pl: 'looks-clean — awaria nieodrozninalna od pustego wyniku' },
  'scanStats': {
    en: 'read: {0} files, {1} functions, {2} error handlers, {3} external reads',
    pl: 'wczytane: {0} plikow, {1} funkcji, {2} obslug bledu, {3} odczytow zewnetrznych' },
  'scanRules': { en: 'rules: {0}   layer: {1}   minpop: {2}', pl: 'reguly: {0}   warstwa: {1}   minpop: {2}' },
  'scanFindings': { en: 'findings: {0}{1}', pl: 'zgloszen: {0}{1}' },
  'scanPerRule': { en: 'per rule: {0}', pl: 'wg reguly: {0}' },
  'scanSkipped': {
    en: 'passed over for want of neighbours: {0}   (--verbose lists them)',
    pl: 'pominietych z braku sasiadow: {0}   (--verbose je wypisze)' },
  'scanNoConvention': {
    en: 'layers where every peer does it the same way, so nothing was reported: {0}   (--verbose lists them)',
    pl: 'warstw, w ktorych kazdy sasiad robi tak samo, wiec nic nie zgloszono: {0}   (--verbose je wypisze)' },
  'scanSkippedList': { en: 'PASSED OVER — the peer group was too small to say anything', pl: 'POMINIETE — grupa sasiadow za mala, zeby cokolwiek powiedziec' },

  // Neighbour notes. THESE LIVE HERE AND NOT IN THE RULES, and it took a run in
  // Polish to notice: the four sentences describing what a neighbour does were
  // written inline in the rule files, so a --lang pl report printed its
  // headings in Polish and its evidence in English. That is the one bug the
  // header of this file warns about, committed inside the file's own project.
  'nbRethrows': { en: 'rethrows', pl: 'przekazuje dalej' },
  'nbLogs': { en: 'logs it', pl: 'loguje' },
  'nbUsesError': { en: 'uses the error', pl: 'uzywa bledu' },
  'nbTagged': { en: 'answers with the outcome attached', pl: 'odpowiada z wynikiem w srodku' },
  'nbRethrowsInstead': { en: 'rethrows instead of answering', pl: 'przekazuje dalej, zamiast odpowiadac' },
  'nbDistinctValue': { en: 'answers {0}, which is not the ambiguous value', pl: 'odpowiada {0}, a to nie jest ta dwuznaczna wartosc' },
  'nbDistinct': { en: 'the two paths answer differently', pl: 'obie sciezki odpowiadaja inaczej' },
  'secDeviation': { en: 'WHERE YOU DIFFER FROM YOUR OWN CODE', pl: 'W CZYM ODSTAJESZ OD WLASNEGO KODU' },
  'secWhy': { en: 'WHY IT MATTERS', pl: 'DLACZEGO TO WAZNE' },
  'secFix': { en: 'FIX', pl: 'POPRAWKA' },
  'muteHint': {
    en: '     Not a defect? Write `// looks-clean: ok — reason` on that line, or above it.',
    pl: '     To nie usterka? Napisz `// looks-clean: ok — powod` w tej linii albo nad nia.' },
  'andMore': { en: '       ... and {0} more', pl: '       ... i jeszcze {0}' },
  'moreFindings': { en: '... and {0} more findings (--top raises the limit)', pl: '... i jeszcze {0} zgloszen (--top podnosi limit)' },
  'layerFile': { en: 'this file', pl: 'tym pliku' },
  'layerDir': { en: 'this directory', pl: 'tym katalogu' },
  'layerRoot': { en: 'the whole scanned tree', pl: 'calym przeskanowanym drzewie' },

  // ---------------------------------------------------------------- rule 1
  'r1Label': { en: '{0} swallows the failure and leaves no trace', pl: '{0} polyka awarie i nie zostawia sladu' },
  'r1Why': {
    en: '     Nothing is logged, nothing is rethrown, nothing on screen changes. After this\n     handler has run, no reader of this program — human or machine — can tell that\n     anything went wrong.',
    pl: '     Nic nie trafia do logu, nic nie leci dalej, nic nie zmienia sie na ekranie.\n     Po tej obsludze nikt — czlowiek ani maszyna — nie odrozni, ze cokolwiek padlo.' },
  'r1Fix': {
    en: '     Leave one trace: log it, rethrow it, or record it where the caller can see it.',
    pl: '     Zostaw jeden slad: zaloguj, przekaz dalej albo zapisz tam, gdzie wolajacy to zobaczy.' },
  'r1Neighbours': {
    en: '     {0} of {1} handlers in {2} leave a trace. This one does not:',
    pl: '     {0} z {1} obslug w {2} zostawia slad. Ta nie:' },
  'r1Alone': {
    en: '     No neighbour was compared, so this is a plain observation rather than a\n     deviation — the weakest of the four rules. eslint (no-empty), Dart\n     (empty_catches) and C# (AL0115) already find the empty case.',
    pl: '     Nie porownano zadnego sasiada, wiec to zwykla obserwacja, a nie odstepstwo —\n     najslabsza z czterech regul. Pusty przypadek znajduja juz eslint (no-empty),\n     Dart (empty_catches) i C# (AL0115).' },

  // ---------------------------------------------------------------- rule 2
  'r2Label': { en: '{0} answers {1} on failure, and {1} also means "no data"', pl: '{0} przy awarii odpowiada {1}, a {1} znaczy tez "brak danych"' },
  'r2Why': {
    en: '     {0} is exactly what a healthy read returns when there is genuinely nothing\n     there. The caller receives the same value either way, so "could not check"\n     arrives dressed as "checked, and there is none".',
    pl: '     {0} to dokladnie to, co zdrowy odczyt zwraca, gdy naprawde nic nie ma.\n     Wolajacy dostaje jedno i to samo, wiec "nie dalem rady sprawdzic" przychodzi\n     przebrane za "sprawdzone, nie ma".' },
  'r2Neighbours': {
    en: '     {0} of {1} error handlers on {2} in {3} carry the outcome alongside the\n     value. This one does not:',
    pl: '     {0} z {1} obslug bledu na {2} w {3} niesie wynik obok wartosci. Ta nie:' },
  'r2Fix': {
    en: '     Say which of the two it is, the way the neighbours above already do.',
    pl: '     Powiedz, ktore z dwojga — tak, jak juz robia to sasiedzi wyzej.' },

  // ---------------------------------------------------------------- rule 3
  'r3Label': { en: '{0} reads {1} with no time limit', pl: '{0} czyta {1} bez limitu czasu' },
  'r3Why': {
    en: '     A read that never returns is not an error anywhere: no catch runs, no branch\n     is taken, nothing is logged. The screen keeps whatever it already had — most\n     often an empty list under a spinner nobody watches to the end.',
    pl: '     Odczyt, ktory nigdy nie wraca, nigdzie nie jest bledem: zaden catch sie nie\n     odpali, zadna galaz nie zostanie wybrana, nic nie trafi do logu. Ekran zostaje\n     z tym, co mial — najczesciej z pusta lista pod kolem, na ktore nikt juz nie patrzy.' },
  'r3Neighbours': {
    en: '     {0} of {1} reads of {2} in {3} have a limit. This one does not:',
    pl: '     {0} z {1} odczytow {2} w {3} ma limit. Ten nie:' },
  'r3Fix': {
    en: '     Give it the limit the neighbours already use: {0}',
    pl: '     Daj mu limit, ktorego uzywaja juz sasiedzi: {0}' },

  // ---------------------------------------------------------------- rule 4
  'r4Label': { en: '{0} returns {1} both when it fails and when it finds nothing', pl: '{0} zwraca {1} i przy awarii, i gdy nic nie znajdzie' },
  'r4Why': {
    en: '     Both paths end in the same expression, so for any caller the two states are\n     one state. It is not that the caller ignores the difference — there is no\n     difference left to ignore.',
    pl: '     Obie sciezki koncza sie tym samym wyrazeniem, wiec dla wolajacego to jeden\n     i ten sam stan. Nie chodzi o to, ze wolajacy ignoruje roznice — po prostu\n     nie ma juz zadnej roznicy do zignorowania.' },
  'r4Where': { en: '     on failure: line {0}      on no result: line {1}', pl: '     przy awarii: linia {0}      przy braku wyniku: linia {1}' },
  'r4Neighbours': {
    en: '     {0} of {1} functions in {2} answer differently on the two paths. This one\n     does not:',
    pl: '     {0} z {1} funkcji w {2} odpowiada inaczej na kazdej ze sciezek. Ta nie:' },
  'r4Fix': {
    en: '     Make the two answers different — a thrown error, a tagged result, or a\n     distinct value the caller is forced to read.',
    pl: '     Rozroznij te dwie odpowiedzi — wyjatkiem, wynikiem z etykieta albo osobna\n     wartoscia, ktora wolajacy musi przeczytac.' },

  // ---------------------------------------------------------------- diff
  'diffTitle': { en: 'looks-clean — difference between two runs', pl: 'looks-clean — roznica miedzy dwoma przebiegami' },
  'diffDetector': { en: 'detector={0}  root={1}', pl: 'detektor={0}  katalog={1}' },
  'diffWhen': { en: 'previous: {0}    current: {1}', pl: 'poprzedni: {0}    biezacy: {1}' },
  'diffWarnDetectors': { en: '!! different detectors: {0} vs {1} — the comparison means little', pl: '!! rozne detektory: {0} vs {1} — porownanie niewiele znaczy' },
  'diffWarnThresholds': { en: '!! different settings: [{0}] vs [{1}] — some of the change comes from the flags, not the code', pl: '!! rozne ustawienia: [{0}] vs [{1}] — czesc zmiany bierze sie z flag, nie z kodu' },
  'diffCounts': { en: 'NEW={0}  GONE={1}  CHANGED={2}  unchanged={3}', pl: 'NOWE={0}  ZNIKNELO={1}  ZMIENIONE={2}  bez zmian={3}' },
  'diffSecNew': { en: 'NEW', pl: 'NOWE' },
  'diffSecGone': { en: 'GONE', pl: 'ZNIKNELO' },
  'diffSecGoneHint': { en: '   (fixed, muted, moved, or no longer read at all)', pl: '   (poprawione, wyciszone, przeniesione albo juz w ogole nieczytane)' },
  'diffSecChanged': { en: 'CHANGED', pl: 'ZMIENIONE' },
  'diffSecUnchanged': { en: 'UNCHANGED', pl: 'BEZ ZMIAN' },
  'diffNoChange': { en: 'Nothing changed since the previous run.', pl: 'Nic sie nie zmienilo od poprzedniego przebiegu.' },

  // ---------------------------------------------------------------- rank
  'rankTitle': { en: 'looks-clean — one ranked list: what to read first', pl: 'looks-clean — jedna lista wg sily dowodu: co czytac pierwsze' },
  'rankSnapshots': { en: 'snapshots: {0} ({1})', pl: 'zapisow: {0} ({1})' },
  'rankFindings': { en: 'findings: {0}', pl: 'zgloszen: {0}' },
  'rankSkipped': { en: '   (states that are not findings, skipped: {0})', pl: '   (stanow, ktore nie sa zgloszeniami, pominieto: {0})' },
  'rankFormula': {
    en: 'score = conventionality x population x rarity. High only when all three are high.\nOrdinal, not a probability: 94 means "read this before the one scored 32".',
    pl: 'wynik = konwencjonalnosc x populacja x rzadkosc. Wysoki tylko, gdy wszystkie trzy sa wysokie.\nSkala porzadkowa, nie prawdopodobienstwo: 94 znaczy "czytaj to przed tym z 32".' },
  'rankComponents': { en: '       conventionality={0}%  population={1}  deviants={2}', pl: '       konwencjonalnosc={0}%  populacja={1}  odstajacych={2}' },
  'rankAlsoBreaks': { en: '       also breaks: {0}', pl: '       lamie takze: {0}' },
  'rankMore': { en: '... and {0} more (--top raises the limit)', pl: '... i jeszcze {0} (--top podnosi limit)' },

  // ---------------------------------------------------------------- help
  'helpTagline': {
    en: 'looks-clean — finds places where a failure is indistinguishable from an empty result.',
    pl: 'looks-clean — szuka miejsc, w ktorych awaria jest nieodrozninalna od pustego wyniku.' },
  'helpPrinciple': {
    en: '  Where the program says "I found nothing" instead of "I could not check".\n  A linter says an empty catch is bad. This says: HERE YOU DIFFER FROM YOUR OWN CODE.',
    pl: '  Tam, gdzie program mowi "nic nie znalazlem" zamiast "nie dalem rady sprawdzic".\n  Linter mowi, ze pusty catch to zle. To mowi: TU ODSTAJESZ OD RESZTY WLASNEGO KODU.' },
  'helpUsage': { en: 'USAGE', pl: 'UZYCIE' },
  'helpLangSec': { en: 'LANGUAGE', pl: 'JEZYK' },
  'helpLangEn': { en: '  --lang en   English (default)', pl: '  --lang en   angielski (domyslnie)' },
  'helpLangPl': { en: '  --lang pl   Polish', pl: '  --lang pl   polski' },
  'helpCommands': { en: 'COMMANDS', pl: 'POLECENIA' },
  'helpOptions': { en: '         options: {0}', pl: '         opcje: {0}' },
  'cmdScan': { en: 'Scan a JavaScript/TypeScript tree with all four rules.', pl: 'Przeskanuj drzewo JavaScript/TypeScript wszystkimi czterema regulami.' },
  'cmdDiff': { en: 'Difference between two saved runs: what appeared, what is gone, what changed.', pl: 'Roznica miedzy dwoma zapisami: co doszlo, co zniknelo, co sie zmienilo.' },
  'cmdRank': { en: 'One ranked list across saved runs — what to read first.', pl: 'Jedna lista ponad zapisami — co czytac pierwsze.' },
  'cmdRules': { en: 'What the four rules are, and which of them needs neighbours.', pl: 'Czym sa cztery reguly i ktora z nich potrzebuje sasiadow.' },
  'helpStart': { en: 'START HERE', pl: 'OD CZEGO ZACZAC' },
  'helpHowToRun': {
    en: '  Inside a clone: npx looks-clean ... (or node bin/looks-clean.mjs ...). After npm i -g: looks-clean ...',
    pl: '  W sklonowanym repo: npx looks-clean ... (albo node bin/looks-clean.mjs ...). Po npm i -g: looks-clean ...' },
  'helpStart1': { en: '  1. Scan and save the run:', pl: '  1. Przeskanuj i zapisz przebieg:' },
  'helpStart2': { en: '  2. Read it in order of strength of evidence:', pl: '  2. Przeczytaj wg sily dowodu:' },
  'helpStart3': { en: '  3. Run it again later — it shows only what is NEW since last time.', pl: '  3. Uruchom pozniej ponownie — pokaze tylko to, co NOWE od ostatniego razu.' },
  'helpExamples': { en: 'MORE EXAMPLES', pl: 'DALSZE PRZYKLADY' },
  'helpReading': { en: 'HOW TO READ THE OUTPUT', pl: 'JAK CZYTAC WYNIK' },
  'helpReading1': {
    en: '  peers=9/11 — 11 comparable sites in the layer; 9 of them do the safe thing.',
    pl: '  peers=9/11 — 11 porownywalnych miejsc w warstwie; 9 z nich robi rzecz bezpieczna.' },
  'helpReading2': {
    en: '  deviants=2 — how many stand out. deviants=1 over a large population is strongest.',
    pl: '  deviants=2 — ilu odstaje. deviants=1 przy duzej populacji to najmocniejszy sygnal.' },
  'helpReading3': {
    en: '  Rules 2, 3 and 4 need a population. Rule 1 does not, and is therefore the weakest.',
    pl: '  Reguly 2, 3 i 4 potrzebuja populacji. Regula 1 nie potrzebuje i dlatego jest najslabsza.' },
  'helpReading4': {
    en: '  This class of tool is noisy by nature (PR-Miner reports 18.1% precision). Read, judge, mute.',
    pl: '  Ta klasa narzedzi jest z natury halasliwa (PR-Miner podaje 18,1% trafnosci). Czytaj, ocen, wycisz.' },

  // ---------------------------------------------------------------- rules screen
  'rulesTitle': { en: 'looks-clean — the four rules', pl: 'looks-clean — cztery reguly' },
  'rulesNeedsPop': { en: 'needs neighbours', pl: 'potrzebuje sasiadow' },
  'rulesNoPop': { en: 'stands alone — the weakest', pl: 'sama z siebie — najslabsza' },
  'rulesFooter': {
    en: 'The comparison, not the rule, is the point. A linter says "an empty catch is bad".\nThis says "saveDream has a time limit, saveProfile does not, and they are the same layer".',
    pl: 'Chodzi o porownanie, nie o regule. Linter mowi "pusty catch to zle".\nTo mowi "saveDream ma limit czasu, saveProfile nie ma, a to ta sama warstwa".' },
  'ruleDesc.swallowed': {
    en: 'A handler that swallows the failure with no log and no trace in the interface.',
    pl: 'Obsluga, ktora polyka blad bez logu i bez sladu w interfejsie.' },
  'ruleDesc.default-on-error': {
    en: 'A handler that answers with a default ([], 0, null, false) where that same value already means "no data".',
    pl: 'Obsluga, ktora odpowiada wartoscia domyslna ([], 0, null, false) tam, gdzie ta sama wartosc znaczy juz "brak danych".' },
  'ruleDesc.no-timeout': {
    en: 'A read with no time limit, standing beside reads of the same kind that have one.',
    pl: 'Odczyt bez limitu czasu obok odczytow tego samego rodzaju, ktore limit maja.' },
  'ruleDesc.same-answer': {
    en: 'A function whose failure path and empty path end in the same expression.',
    pl: 'Funkcja, ktorej sciezka awarii i sciezka pustki koncza sie tym samym wyrazeniem.' },
};

function fmt(s, args) {
  return String(s).replace(/\{(\d+)\}/g, (m, i) => (args[+i] === undefined ? m : String(args[+i])));
}

export function t(key, ...args) {
  const e = S[key];
  // A MISSING KEY IS SHOUTED, NOT SWALLOWED. Returning the key quietly would
  // drop a bare identifier into the middle of a sentence with nothing to say
  // why — the same shape of defect this tool reports in other people's code.
  if (!e) return '!!missing-message:' + key + '!!' + (args.length ? ' ' + args.join(' ') : '');
  return fmt(e[LANG] ?? e.en, args);
}

/** Every key, for the test that checks the two languages have not drifted apart. */
export const KEYS = Object.keys(S);
export const TABLE = S;
