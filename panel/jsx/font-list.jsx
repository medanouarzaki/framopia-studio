/*
 * Every face this After Effects can set, for the client setup screen.
 *
 * **The name that matters is After Effects' own.** Block 10 session 12 measured
 * that macOS and After Effects disagree on two of the three K2 faces — the
 * system says `Inter-Regular_SemiBold` and `CormorantGaramond-SemiBoldItalic`
 * where After Effects says `Inter-SemiBold` and
 * `CormorantGaramondItalic-SemiBoldItalic` — because both are variable fonts and
 * After Effects constructs its own name for an instance. A list built from the
 * system would offer names no build can use, so this asks the host that will
 * draw the type.
 *
 * **Nothing here writes a font.** Setting a name that is not installed adds it
 * to `app.fonts.allFonts` for the rest of the application session, so a reader
 * that wrote would corrupt what the next reader sees.
 *
 * ES3 only.
 */

function framopiaFontList(optionsPath, resultPath) {
    var out = { ok: false, names: [], families: -1 };
    try {
        var names = framopiaInstalledFontNames();
        if (names === null) {
            out.ok = false;
            out.message = 'this After Effects does not expose app.fonts';
        } else {
            out.ok = true;
            out.names = names;
            try {
                out.families = app.fonts.allFonts.length;
            } catch (eCount) {
                out.families = -1;
            }
        }
    } catch (err) {
        out.ok = false;
        out.message = String(err);
    }
    var f = new File(resultPath);
    f.encoding = 'UTF-8';
    f.open('w');
    f.write(JSON.stringify(out));
    f.close();
    return out.ok ? 'ok' : 'error';
}
