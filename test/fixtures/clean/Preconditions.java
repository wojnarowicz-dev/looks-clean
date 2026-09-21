package fixtures;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.logging.Logger;

/**
 * Three shapes rule 4 must NOT report, and three neighbours that make the
 * silence mean something.
 *
 * WHY THIS FILE IS LOAD-BEARING. A negative fixture that is silent because
 * nothing in it was comparable proves nothing at all. Every method here shares
 * one family and one file, so the peer group reaches minpop and a convention
 * exists — the three `read*` methods do not collapse. Before the correction
 * this file produced three findings; after it, none. Delete the correction and
 * this fixture goes loud, which is the only way a negative test earns its place.
 *
 * Nothing here is reported by the other three rules either, and that is
 * deliberate rather than lucky: every handler uses its error binding, so rule 1
 * is satisfied; every handler collapses to the same value, so rule 2 has no
 * convention to report a deviation from; no read anywhere carries a deadline,
 * so rule 3 has none either.
 */
public class Preconditions {

    private static final Logger LOG = Logger.getLogger(Preconditions.class.getName());

    // ---------------------------------------------------------- the neighbours
    // A failure exit and a normal exit that do not meet: the normal path answers
    // with content, so there is nothing for the failure path to collide with.

    static String readOne(Path p) {
        try {
            return Files.readString(p);
        } catch (IOException e) {
            LOG.warning("readOne failed: " + p + " " + e);
            return null;
        }
    }

    static String readTwo(Path p) {
        try {
            return Files.readString(p);
        } catch (IOException e) {
            LOG.warning("readTwo failed: " + p + " " + e);
            return null;
        }
    }

    static String readThree(Path p) {
        try {
            return Files.readString(p);
        } catch (IOException e) {
            LOG.warning("readThree failed: " + p + " " + e);
            return null;
        }
    }

    // ---------------------------------------------------------- the three shapes

    /**
     * A null check on an argument. The `return null` above the try answers a
     * caller who asked a malformed question; it is not this method looking and
     * finding nothing, so it is not the empty path the catch collides with.
     */
    static String guardedByNull(Path p) {
        if (p == null) {
            return null;
        }
        try {
            return Files.readString(p);
        } catch (IOException e) {
            LOG.warning("guardedByNull failed: " + p + " " + e);
            return null;
        }
    }

    /**
     * THE STRING CASE, PINNED ON PURPOSE. `isBlank()` on a String parameter is a
     * precondition. The same call on a COLLECTION parameter would be a real
     * "found nothing", and the two are told apart by nothing the tool can see —
     * so this row exists to keep the decision from being re-argued from memory.
     */
    static String guardedByBlank(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        try {
            return Files.readString(Path.of(name));
        } catch (IOException e) {
            LOG.warning("guardedByBlank failed: " + name + " " + e);
            return null;
        }
    }

    /**
     * A method with no answer at all. Every return is the same by construction,
     * so saying that its two paths agree says nothing. If the failure here needs
     * reporting it is rule 1's to report, and rule 1 can see it.
     */
    static void touchQuietly(Path p) {
        if (p == null) {
            return;
        }
        try {
            Files.createDirectories(p);
        } catch (IOException e) {
            LOG.warning("touchQuietly failed: " + p + " " + e);
            return;
        }
    }
}
