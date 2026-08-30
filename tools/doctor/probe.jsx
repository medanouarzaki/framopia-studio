/*
 * What a live After Effects can tell the doctor, read-only.
 *
 * It opens nothing, sets nothing and saves nothing, and in particular it never
 * writes a `TextDocument.font`: a name that is set but not installed is recorded
 * to stay in `app.fonts.allFonts` for the rest of the application session, so a
 * check that wrote one would corrupt the reading it was taking.
 *
 * The scripting preference is the one a fresh install has switched off. Every
 * driven script writes its result to a file for the caller to read back, so a
 * machine with it off gets "After Effects wrote no result" and nothing that
 * names the cause. Reading it is the only way the doctor can say so — and if
 * the preference is off, this script cannot write its own result either, which
 * the caller reads as unreachable rather than as absent.
 *
 * ES3 only.
 */

function framopiaDoctorProbe(resultPath) {
    var out = {};
    try {
        out.appVersion = String(app.version);
        out.buildName = String(app.buildName);

        /*
         * The preference is a long under the main section. A build of After
         * Effects that does not carry this key gives null rather than a guess:
         * "could not be determined" is a real answer and folding it into "on"
         * is the failure this whole command exists to avoid.
         */
        out.scriptingAllowed = null;
        try {
            var value = app.preferences.getPrefAsLong(
                'Main Pref Section',
                'Pref_SCRIPTING_FILE_NETWORK_SECURITY'
            );
            out.scriptingAllowed = value === 1;
        } catch (prefError) {
            out.scriptingPrefError = String(prefError);
        }

        var names = framopiaInstalledFontNames();
        out.fontNames = names === null ? null : names;
        out.fontNameCount = names === null ? null : names.length;
        out.ok = true;
    } catch (e) {
        out.ok = false;
        out.message = String(e);
    }
    var f = new File(resultPath);
    f.encoding = 'UTF-8';
    f.open('w');
    f.write(JSON.stringify(out));
    f.close();
    return 'ok';
}
