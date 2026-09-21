// looks-clean — commands, and why rule 2 has nothing to say about them.
//
// THIS TREE MUST REPORT NOTHING. Four handlers over the same backend, so the
// population and the convention both exist and the file cannot pass by being
// skipped — remove the correction and the command below is reported.
//
// Rule 2 asks whether a caller can tell the failure answer apart from the
// empty result. Under a command there is no empty result: a write either
// happened or it did not, and the flag says which. The operation's value never
// reaches the answer, so the answer is a constant, and a constant cannot
// collide with data that was never returned.
//
// Measured 2026-09-21 on a closed-source Flutter application, where the rule
// fired on exactly one of these and the query four hundred lines away — whose
// read DOES become the answer — was a real defect.

class Consent {
  // Three neighbours that carry their outcome, so a convention exists here.
  Future<bool> revoke(String userId) async {
    try {
      await supabase.from('profiles').update({'consent': null}).eq('id', userId);
      return true;
    } catch (e) {
      debugPrint('revoke failed: $e');
      rethrow;
    }
  }

  Future<bool> touch(String userId) async {
    try {
      await supabase.from('profiles').update({'seen_at': 'now'}).eq('id', userId);
      return true;
    } catch (e) {
      debugPrint('touch failed: $e');
      rethrow;
    }
  }

  Future<bool> forget(String userId) async {
    try {
      await supabase.from('profiles').delete().eq('id', userId);
      return true;
    } catch (e) {
      debugPrint('forget failed: $e');
      rethrow;
    }
  }

  // THE ONE UNDER TEST. Its answer is a constant on every path, so `false`
  // reports the failure rather than disguising it.
  Future<bool> give(String userId) async {
    try {
      await supabase.from('profiles').update({'consent': true}).eq('id', userId);
      return true;
    } catch (e) {
      debugPrint('give failed: $e');
      return false;
    }
  }
}
