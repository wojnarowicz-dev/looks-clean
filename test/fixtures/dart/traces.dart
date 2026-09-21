// looks-clean — the traces a Dart handler leaves that the vocabulary could not
// see, and the one it must still call silent.
//
// This file is not scanned. It is parsed directly by test/vocabulary.mjs,
// which asserts what the IR makes of each handler's body.
//
// TWO BLIND SPOTS, MEASURED 2026-09-21 ON A CLOSED-SOURCE FLUTTER APPLICATION:
//
//   * `$e` inside a string is not an `identifier`. The grammar calls it
//     `identifier_dollar_escaped`, so a handler that prints the error it
//     caught read as one that never touched it.
//   * `debugPrint` is the Flutter console, and `print` is the Dart one.
//     Neither is in the shared trace vocabulary, which was written for
//     `console.*` and the JavaScript logging packages.
//
// Either blind spot alone turns a handler that reports its failure into a
// reported swallower. Five of the six false alarms in that measurement were
// this, in one or both halves.

class Traces {
  // Both blind spots at once: an unknown logging call, and a binding used only
  // through interpolation. This is the shape that was miscounted.
  Future<String?> interpolated(String path) async {
    try {
      return await read(path);
    } catch (e) {
      debugPrint('read failed: $e');
      return null;
    }
  }

  // The braced form. `${e.message}` holds a plain `identifier`, so the binding
  // was already visible here — this one is the control that must not move.
  Future<String?> braced(String path) async {
    try {
      return await read(path);
    } catch (e) {
      debugPrint('read failed: ${e.message}');
      return null;
    }
  }

  // `print` is Dart's own, and appears in code that does not import Flutter.
  Future<String?> plainPrint(String path) async {
    try {
      return await read(path);
    } catch (e) {
      print('read failed: $e');
      return null;
    }
  }

  // Logs, but never names the failure. Still a trace: a reader of the output
  // can tell that this path ran.
  Future<String?> noDetail(String path) async {
    try {
      return await read(path);
    } catch (e) {
      debugPrint('read failed');
      return null;
    }
  }

  // THE CONTROL. Neither blind spot applies, and after the correction this
  // must still read as a handler that leaves nothing behind. A widened
  // vocabulary that also swallows this one has stopped measuring anything.
  Future<String?> silent(String path) async {
    try {
      return await read(path);
    } catch (e) {
      return null;
    }
  }
}
