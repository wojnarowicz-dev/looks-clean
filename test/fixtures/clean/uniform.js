// CLEAN — nothing here may be reported.
//
// Four file-system reads that all answer the empty list on failure. Every one
// of them is the shape rule 2 exists to find, and not one of them is reported,
// because there is no neighbour doing it the other way.
//
// THIS IS THE HARDEST CASE FOR THE TOOL TO GET RIGHT, and the one most worth a
// permanent test. A rule that fired here would be a rule with an opinion of its
// own, which is what every linter already has and what this one is trying not
// to be. The silence is not an oversight: the run prints it, counted, under
// "layers where every peer does it the same way".
const fs = require('fs');

function readTemplates(dir) {
  try {
    return fs.readdirSync(dir + '/templates');
  } catch (e) {
    console.warn('no templates', e.code);
    return [];
  }
}

function readPartials(dir) {
  try {
    return fs.readdirSync(dir + '/partials');
  } catch (e) {
    console.warn('no partials', e.code);
    return [];
  }
}

function readLayouts(dir) {
  try {
    return fs.readdirSync(dir + '/layouts');
  } catch (e) {
    console.warn('no layouts', e.code);
    return [];
  }
}

function readHelpers(dir) {
  try {
    return fs.readdirSync(dir + '/helpers');
  } catch (e) {
    console.warn('no helpers', e.code);
    return [];
  }
}

module.exports = { readTemplates, readPartials, readLayouts, readHelpers };
