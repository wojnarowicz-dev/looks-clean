// looks-clean — a command whose `false` already means failure, beside the
// query whose `false` does not.
//
// This file is not scanned. It is parsed directly by test/vocabulary.mjs.
//
// MEASURED 2026-09-21 ON A CLOSED-SOURCE FLUTTER APPLICATION. Rule 2 asks
// whether a caller can tell the failure answer apart from the empty result.
// Under a command there is no empty result to be told apart from: a write
// either happened or it did not, and `false` says which. The rule fired on one
// anyway, because the two shapes are indistinguishable from the handler alone —
// the difference is whether the guarded operation's own value reaches the
// answer.
//
// The two functions below are deliberately near-identical. Everything a
// handler can see is the same in both. Only the success return differs.

class Commands {
  // A COMMAND. The write's result is discarded and the success answer is a
  // constant, so `false` can only have come from a failure. Nothing here is
  // ambiguous and rule 2 must stay quiet.
  Future<bool> giveConsent(String userId) async {
    try {
      await supabase.from('profiles').update({'consent': true}).eq('id', userId);
      return true;
    } catch (_) {
      return false;
    }
  }

  // A QUERY, four hundred lines from the command in the material this came
  // from. The read's value IS the answer, and it can legitimately be `false`,
  // so the handler's `false` collapses two different states into one. This is
  // the defect the rule exists for and it must still be reported.
  Future<bool> hasConsent(String userId) async {
    try {
      final row = await supabase.from('profiles').select('consent').eq('id', userId).maybeSingle();
      return row != null && row['consent'] != null;
    } catch (_) {
      return false;
    }
  }

  // THE BOUNDARY, AND IT IS NOT COVERED. A command answering a list looks
  // exactly like a query answering an empty one: an empty list is data-shaped,
  // and nothing in the source says whether it means "nothing was purged" or "this
  // is the data, and there is none". The correction deliberately does not
  // reach here — constantAnswers is false for this function. Rule 4 is the one
  // that can speak about it, because both paths answer the same thing.
  Future<List<String>> purge(String userId) async {
    try {
      await supabase.from('profiles').delete().eq('id', userId);
      return const [];
    } catch (_) {
      return const [];
    }
  }
}
