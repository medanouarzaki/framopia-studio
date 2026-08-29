/*
 * Which faces this After Effects really has.
 *
 * **After Effects does not refuse a font name it cannot resolve.** Writing an
 * invented name to `TextDocument.font` succeeds, reads back unchanged, and the
 * layer renders in a substituted face — measured on 26.0x67 with a name coined
 * for the purpose. So nothing downstream can tell a face that was set from a
 * face that was silently replaced, and the only defence is to check before
 * anything is placed. Same shape as the absent face masks and the absent
 * watermark measurement: an input whose absence produces a plausible wrong
 * output.
 *
 * **`app.fonts.allFonts` is not an array of font objects.** Each entry
 * stringifies to one family's PostScript names joined by commas —
 * `Inter-Thin,Inter-ExtraLight,…` — and a single-face family is one name.
 *
 * **The list is polluted by writing.** A name that is set but not installed is
 * added to `allFonts` and stays for the rest of the application session, so a
 * check has to run before anything sets a font, and a fresh launch is the only
 * way to clear it. Nothing in a build sets an invented name, so this matters
 * for the measurement script rather than for a build.
 *
 * ES3 only.
 */

function framopiaInstalledFontNames() {
    if (typeof app.fonts === 'undefined' || app.fonts === null) return null;
    var all;
    try {
        all = app.fonts.allFonts;
    } catch (e) {
        return null;
    }
    if (!all || typeof all.length !== 'number') return null;
    var names = [];
    var i;
    var j;
    for (i = 0; i < all.length; i++) {
        var group = String(all[i]).split(',');
        for (j = 0; j < group.length; j++) {
            var name = String(group[j]).replace(/^\s+/, '').replace(/\s+$/, '');
            if (name !== '') names.push(name);
        }
    }
    return names;
}

/**
 * The names in `wanted` this host does not have.
 *
 * Returns null when the host cannot be asked at all — an After Effects with no
 * `app.fonts`. That is "cannot tell", which a caller must not read as "all
 * present": the difference is the whole point of checking.
 */
function framopiaMissingFonts(wanted, names) {
    if (names === null) return null;
    var missing = [];
    var i;
    var j;
    for (i = 0; i < wanted.length; i++) {
        var found = false;
        for (j = 0; j < names.length; j++) {
            if (names[j] === wanted[i]) {
                found = true;
                break;
            }
        }
        if (!found) missing.push(wanted[i]);
    }
    return missing;
}
