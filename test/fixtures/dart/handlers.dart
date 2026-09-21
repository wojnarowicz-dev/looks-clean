// looks-clean — the three shapes a Dart handler comes in, and the one that is
// invisible to anything keying on a node type.
//
// This file is not scanned. It is parsed directly by test/vocabulary.mjs, which
// asserts what the IR makes of it: three handlers, one of them without a
// binding, and a body found as a sibling rather than as a child.
//
// 31 handlers of the third shape stand in the material this vocabulary was
// measured against. A tool that cannot see them reports a clean file.

class Handlers {
  // 1. The ordinary clause. Its body is the NEXT sibling of the clause, not a
  //    child of it.
  Future<String?> plain(String path) async {
    try {
      return await read(path);
    } catch (e) {
      log(e);
      return null;
    }
  }

  // 2. A typed clause. The type sits in FRONT of the clause, so the clause is
  //    not the first child of the try either.
  Future<String?> typed(String path) async {
    try {
      return await read(path);
    } on FormatException catch (e) {
      log(e);
      return null;
    }
  }

  // 3. NO CLAUSE AT ALL. `on X { }` is a handler with no `catch_clause` node
  //    and no binding: it cannot use the error it caught, because it never
  //    named one. This is the shape that must not be missed.
  Future<String?> untyped(String path) async {
    try {
      return await read(path);
    } on FormatException {
      return null;
    }
  }

  // A rethrow, which Dart writes as an expression rather than a statement.
  Future<String?> handsOn(String path) async {
    try {
      return await read(path);
    } catch (e) {
      rethrow;
    }
  }

  // A guard on an argument, above the try. Not the empty path — see ir.mjs.
  Future<String?> guarded(String? path) async {
    if (path == null || path.isEmpty) {
      return null;
    }
    try {
      return await read(path);
    } catch (e) {
      log(e);
      return null;
    }
  }
}
