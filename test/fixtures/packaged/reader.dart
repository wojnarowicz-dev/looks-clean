// looks-clean — material for the packaged layer, Dart half.
//
// THIS FILE IS THE POINT OF THE LAYER. It can only be read if the vendored
// grammar travelled inside the package, so a `files` list that forgets
// vendor/ turns this half into a parse that never happens — and the tool
// would report a clean tree rather than an error.
import 'dart:io';

class Reader {
  Future<String?> loadConfig(String path) async {
    try {
      return await File(path).readAsString();
    } catch (e) {
      print('config unreadable: $e');
      return null;
    }
  }

  Future<String?> loadTheme(String path) async {
    try {
      return await File(path).readAsString();
    } catch (e) {
      print('theme unreadable: $e');
      return null;
    }
  }

  Future<String?> loadLocale(String path) async {
    try {
      return await File(path).readAsString();
    } catch (e) {
      print('locale unreadable: $e');
      return null;
    }
  }

  // The odd one out, as above.
  Future<String?> loadKeymap(String path) async {
    try {
      return await File(path).readAsString();
    } catch (_) {
      return null;
    }
  }
}
