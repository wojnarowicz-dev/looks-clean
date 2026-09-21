// looks-clean — the shape that broke the first version of the command test.
//
// This file is not scanned. It is parsed directly by test/vocabulary.mjs.
//
// MEASURED 2026-09-21. The first attempt called a function a command when
// every one of its returns was a literal constant. That is true of the query
// below, and removing it removed four real findings from Java material that
// had not moved in any release: a read tested in a branch reaches the answer
// without ever being returned.
//
// So the test is not about the returns. It is about whether the guarded
// operation's value goes anywhere at all.

import java.nio.file.Files;
import java.nio.file.Path;

public class Commands {

    // A QUERY, AND THE ONE THAT BROKE IT. Every return is a constant, yet the
    // read decides which constant. `false` means both "not there" and "could
    // not tell", which is exactly what rule 2 reports.
    public static boolean hasLayout(Path dir, String name) {
        if (dir == null || name == null) {
            return false;
        }
        try {
            if (!Files.isRegularFile(dir.resolve(name))) {
                return false;
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    // A COMMAND. The delete's value is thrown away and the answer is a
    // constant, so `false` reports the failure and nothing else.
    public static boolean discard(Path file) {
        try {
            Files.delete(file);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
