// FIXTURE — rule 2 (default-on-error).
//
// Four reads of the same backend, in one file, written by the same hand.
// Three of them carry the outcome alongside the value. loadReviews does not:
// it answers [], which is also what a healthy read returns for an account with
// no reviews. That is the planted deviation, and the other three are the
// evidence that it IS one.
//
// Nothing here is a lint violation. Every catch is non-empty, every promise is
// handled, and eslint has nothing to say about the file.

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
  return sb.rpc('my_badges')
    .then(function (r) {
      if (!r || r.error) return { known: false, value: [] };
      return { known: true, value: r.data || [] };
    })
    .catch(function () { return { known: false, value: [] }; });
}

// THE PLANTED DEVIATION. A failed read and an account with no reviews leave the
// caller holding exactly the same value.
function loadReviews(sb) {
  return sb.rpc('my_reviews')
    .then(function (r) { return r.data || []; })
    .catch(function () { return []; });
}

module.exports = { loadProfile, loadSettings, loadBadges, loadReviews };
