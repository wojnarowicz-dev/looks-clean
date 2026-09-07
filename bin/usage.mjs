// looks-clean — the help screen.
//
// WHY A SEPARATE FILE. Help is the only output a person reads BEFORE deciding
// whether to run the tool a second time, and in the project this one is built
// from the help text was the single string that bypassed the dictionary — so
// with English as the default, the first screen a visitor saw was in Polish.
// One file, one path through `t()`, and that cannot happen again.
import { t } from '../src/lang.mjs';

export function help(COMMANDS, code = 0) {
  const w = code === 0 ? console.log : console.error;

  w(t('helpTagline'));
  w('');
  w(t('helpPrinciple'));
  w('');
  w(t('helpUsage'));
  w('  looks-clean <command> [arguments]');
  w('');
  w(t('helpLangSec'));
  w(t('helpLangEn'));
  w(t('helpLangPl'));
  w('');
  w(t('helpCommands'));
  for (const [name, c] of Object.entries(COMMANDS)) {
    w('  ' + name.padEnd(6) + c.arg);
    w('         ' + t(c.descKey));
    if (c.options) w(t('helpOptions', c.options));
  }
  w('');

  // THE COMMAND IN THE EXAMPLES HAS TO BE ONE THAT WORKS. After a plain
  // `git clone && npm install` there is no `looks-clean` on the PATH —
  // package.json declares `bin`, but that becomes a command only after
  // `npm i -g` or `npm link`. Anyone following the help got "command not found"
  // and had to guess `npx` unaided.
  w(t('helpStart'));
  w(t('helpHowToRun'));
  w(t('helpStart1'));
  w('       npx looks-clean scan ./src --json .looks-clean/run.json');
  w(t('helpStart2'));
  w('       npx looks-clean rank .looks-clean/run.json');
  w(t('helpStart3'));
  w('');
  w(t('helpExamples'));
  w('  npx looks-clean scan  ./src --rule no-timeout');
  w('  npx looks-clean scan  ./web --layer dir --minpop 4 --verbose');
  w('  npx looks-clean diff  before.json after.json');
  w('  npx looks-clean rules');
  w('');
  w(t('helpReading'));
  w(t('helpReading1'));
  w(t('helpReading2'));
  w(t('helpReading3'));
  w(t('helpReading4'));

  process.exit(code);
}

/** The `rules` screen: what the four are, and which of them needs neighbours. */
export function rules(RULE_IDS, needsPopulation) {
  console.log(t('rulesTitle'));
  console.log('');
  RULE_IDS.forEach((id, i) => {
    console.log('  ' + (i + 1) + '. ' + id.padEnd(18) +
      (needsPopulation[id] ? t('rulesNeedsPop') : t('rulesNoPop')));
    console.log('     ' + t('ruleDesc.' + id));
    console.log('');
  });
  console.log(t('rulesFooter'));
  process.exit(0);
}
