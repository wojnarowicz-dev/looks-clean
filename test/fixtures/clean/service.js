// CLEAN — nothing here may be reported.
//
// Four supabase reads whose handlers all carry the outcome. This is the shape
// rule 2 quotes back to a reader as the convention, so reporting it would mean
// the tool contradicting its own advice.
//
// It is also the trap for rule 1. None of these handlers logs, and none touches
// its error binding — by the first draft's definition of "leaves a trace", all
// four were swallowers. Handing the outcome to the caller IS the trace, and it
// is the better one.

function loadProfile(sb) {
  return sb.rpc('my_profile')
    .then(function (r) {
      if (!r || r.error) return { known: false, value: null };
      return { known: true, value: r.data };
    })
    .catch(function () { return { known: false, value: null }; });
}

function loadSettings(sb) {
  return sb.rpc('my_settings')
    .then(function (r) {
      if (!r || r.error) return { known: false, value: null };
      return { known: true, value: r.data };
    })
    .catch(function () { return { known: false, value: null }; });
}

function loadBadges(sb) {
  return sb.from('badges').select('id')
    .then(function (r) {
      if (!r || r.error) return { known: false, value: [] };
      return { known: true, value: r.data || [] };
    })
    .catch(function () { return { known: false, value: [] }; });
}

function loadReviews(sb) {
  return sb.rpc('my_reviews')
    .then(function (r) {
      if (!r || r.error) return { known: false, value: [] };
      return { known: true, value: r.data || [] };
    })
    .catch(function () { return { known: false, value: [] }; });
}

module.exports = { loadProfile, loadSettings, loadBadges, loadReviews };
