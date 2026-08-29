/*
 * Three things only After Effects can settle, measured in one pass.
 *
 * 1. Which font name string AE actually accepts. The repo stores family and
 *    style as one string ("Inter Semi-Bold") and has never written
 *    TextDocument.font; AE reports its own as a PostScript name
 *    ("Inter-SemiBold"). Nothing here has ever set one, so what a write takes
 *    is unknown rather than assumed.
 * 2. What AE does with a name it cannot resolve. If it substitutes silently the
 *    builder has to check before it places a card, and this is the evidence.
 * 3. The size ratios between the three faces, from sourceRectAtTime on real
 *    text at the project's real sizes. EMPHASIS_SIZE_RATIO is 1.0 and
 *    near-certainly wrong; ARABIC_SIZE_RATIO is 1.07, measured against Inter
 *    and unverified against Cormorant.
 *
 * Run it yourself: File > Scripts > Run Script File...
 *
 * It works inside the project you already have open, because the alternative
 * is closing it. It adds one temporary composition, measures, and removes it
 * again. **It never saves.** After Effects marks a project modified as soon as
 * anything is added and that flag is read-only from a script, so the project
 * will show as modified afterwards even though the comp is gone — undo, or
 * close without saving.
 *
 * ES3 only: no const, no let, no arrow functions, no Array.forEach, no
 * Array.indexOf, no trailing commas. JSON comes from the repo's json2 shim.
 */

function framopiaMeasureFonts() {
    var HERE = new File($.fileName).parent;
    var REPO = HERE.parent.parent;

    // The host may or may not have JSON; the shim installs it where it does not.
    try {
        $.evalFile(new File(REPO.fsName + '/panel/jsx/json2.jsx'));
    } catch (shimError) {
        // If JSON is already there this does not matter. If it is not, the
        // write below fails and says so rather than leaving a silent gap.
    }

    var OUT_DIR = new Folder(REPO.fsName + '/.local/build');
    var OUT = new File(OUT_DIR.fsName + '/font-measurements.json');

    /* PROJECT_SPEC §3 / core/src/typography.ts. */
    var SUBTITLE_SIZE = 343;
    var KEYWORD_SIZE = 425;

    var FACES = [
        { role: 'latin', family: 'Inter', style: 'Semi Bold', repoString: 'Inter Semi-Bold' },
        {
            role: 'emphasis',
            family: 'Cormorant Garamond',
            style: 'SemiBold Italic',
            repoString: 'Cormorant Garamond SemiBold Italic'
        },
        { role: 'arabic', family: 'Almarai', style: 'Bold', repoString: 'Almarai Bold' }
    ];

    /*
     * One word and a phrase, so a ratio is not read off a single word.
     *
     * The keys are `oneWord` and `phrase` and not the obvious `short` and
     * `long`: **both of those are reserved words in ExtendScript**, whose list
     * is Java's rather than JavaScript's, and it rejects them as unquoted
     * object keys and after a dot. Written the obvious way this file did not
     * parse and measured nothing. `npm run check` gates every .jsx against that
     * list now.
     */
    var SAMPLES = {
        latin: { oneWord: 'glow', phrase: 'dernière génération' },
        emphasis: { oneWord: 'glow', phrase: 'dernière génération' },
        arabic: { oneWord: 'شنو', phrase: 'ترطيب عميق للبشرة' }
    };

    var stage = 'start';
    var result;
    var comp = null;

    try {
        stage = 'check-project';
        if (app.project === null) throw new Error('no project is open');

        stage = 'list-fonts';
        var installed = framopiaListFonts(FACES);

        stage = 'make-comp';
        app.beginUndoGroup('Framopia font measurement');
        comp = app.project.items.addComp('framopia_font_probe', 1920, 1080, 1, 2, 30);
        var layer = comp.layers.addText('measure');

        stage = 'name-round-trip';
        var naming = [];
        var i;
        var j;
        for (i = 0; i < FACES.length; i++) {
            var face = FACES[i];
            var candidates = framopiaCandidatesFor(face, installed);
            var tried = [];
            for (j = 0; j < candidates.length; j++) {
                tried.push(framopiaTryFont(layer, candidates[j]));
            }
            naming.push({ role: face.role, family: face.family, style: face.style, tried: tried });
        }

        stage = 'unresolvable-name';
        var nonsense = 'Framopia No Such Face ZZQX';
        var beforeNonsense = framopiaReadFont(layer);
        var nonsenseResult = framopiaTryFont(layer, nonsense);
        nonsenseResult.fontBeforeTheAttempt = beforeNonsense;

        stage = 'measure';
        var measurements = [];
        for (i = 0; i < FACES.length; i++) {
            var f = FACES[i];
            var name = framopiaBestName(f, naming);
            if (name === null) {
                measurements.push({ role: f.role, resolved: false, reason: 'no name round-tripped' });
                continue;
            }
            var sample = SAMPLES[f.role];
            measurements.push({
                role: f.role,
                fontUsed: name,
                resolved: true,
                subtitle: framopiaMeasureAt(layer, comp, name, SUBTITLE_SIZE, sample),
                keyword: framopiaMeasureAt(layer, comp, name, KEYWORD_SIZE, sample)
            });
        }

        result = {
            ok: true,
            measuredAt: new Date().toString(),
            aeVersion: app.version,
            subtitleSize: SUBTITLE_SIZE,
            keywordSize: KEYWORD_SIZE,
            installed: installed,
            naming: naming,
            unresolvable: nonsenseResult,
            measurements: measurements,
            note:
                'Ratios are not computed here. The next session applies them with the user ' +
                'looking at a build; this file is the measurement.'
        };
    } catch (err) {
        result = { ok: false, stage: stage, message: String(err) };
    }

    /* The comp goes whatever happened, so a failure leaves nothing behind. */
    try {
        if (comp !== null) comp.remove();
    } catch (removeError) {
        result.compLeftBehind = 'framopia_font_probe could not be removed: ' + String(removeError);
    }
    try {
        app.endUndoGroup();
    } catch (undoError) {
        // Nothing to do: the group was never opened.
    }

    try {
        if (!OUT_DIR.exists) OUT_DIR.create();
        OUT.encoding = 'UTF-8';
        OUT.open('w');
        OUT.write(JSON.stringify(result, null, 2));
        OUT.close();
    } catch (writeError) {
        alert('Framopia: could not write the result file: ' + String(writeError));
        return 'error';
    }

    /* One line, not a dialog he has to dismiss for every step. */
    alert(
        result.ok
            ? 'Framopia: font measurement done.\nWritten to ' + OUT.fsName +
              '\n\nThe project is marked modified because a temporary composition was added ' +
              'and removed. Do not save; undo if you like.'
            : 'Framopia: font measurement failed at "' + result.stage + '".\n' +
              result.message + '\nWritten to ' + OUT.fsName
    );
    return result.ok ? 'ok' : 'error';
}

/* Every installed face whose family looks like one we are asking about. */
function framopiaListFonts(faces) {
    var out = { available: false, reason: null, families: [] };
    if (typeof app.fonts === 'undefined' || app.fonts === null) {
        out.reason = 'this After Effects has no app.fonts; nothing can be listed';
        return out;
    }
    var all;
    try {
        all = app.fonts.allFonts;
    } catch (e) {
        out.reason = 'app.fonts.allFonts threw: ' + String(e);
        return out;
    }
    out.available = true;
    var i;
    var j;
    for (i = 0; i < faces.length; i++) {
        var wanted = faces[i].family.toLowerCase();
        var found = [];
        for (j = 0; j < all.length; j++) {
            var font = all[j];
            var family;
            try {
                family = String(font.familyName);
            } catch (familyError) {
                continue;
            }
            if (family.toLowerCase().indexOf(wanted) === -1) continue;
            found.push({
                familyName: family,
                styleName: String(font.styleName),
                postScriptName: String(font.postScriptName)
            });
        }
        out.families.push({ role: faces[i].role, asked: faces[i].family, found: found });
    }
    return out;
}

/* The strings worth trying, most likely first. */
function framopiaCandidatesFor(face, installed) {
    var candidates = [];
    var i;
    var j;
    for (i = 0; i < installed.families.length; i++) {
        if (installed.families[i].role !== face.role) continue;
        var found = installed.families[i].found;
        for (j = 0; j < found.length; j++) {
            if (framopiaSameStyle(found[j].styleName, face.style)) {
                candidates.push(found[j].postScriptName);
            }
        }
    }
    candidates.push(face.repoString);
    candidates.push(face.family + '-' + face.style.replace(/ /g, ''));
    candidates.push(face.family + ' ' + face.style);
    return candidates;
}

function framopiaSameStyle(a, b) {
    return String(a).toLowerCase().replace(/[ \-]/g, '') ===
        String(b).toLowerCase().replace(/[ \-]/g, '');
}

function framopiaReadFont(layer) {
    return String(layer.property('Source Text').value.font);
}

/*
 * Set a font, read it back, and say whether it took.
 *
 * The read-back is the whole point: if After Effects substitutes a face for a
 * name it cannot resolve, the string written and the string reported differ,
 * and the builder has to check rather than trust.
 */
function framopiaTryFont(layer, name) {
    var prop = layer.property('Source Text');
    var row = { asked: name, readBack: null, roundTripped: false, threw: null };
    try {
        var doc = prop.value;
        doc.text = 'Ag';
        doc.font = name;
        prop.setValue(doc);
        row.readBack = framopiaReadFont(layer);
        row.roundTripped = row.readBack === name;
    } catch (e) {
        row.threw = String(e);
    }
    return row;
}

/* The first candidate that round-tripped, or null. */
function framopiaBestName(face, naming) {
    var i;
    var j;
    for (i = 0; i < naming.length; i++) {
        if (naming[i].role !== face.role) continue;
        var tried = naming[i].tried;
        for (j = 0; j < tried.length; j++) {
            if (tried[j].roundTripped) return tried[j].asked;
        }
    }
    return null;
}

/*
 * sourceRectAtTime at an explicit time, never prop.value and never wherever the
 * current time indicator happens to sit — Block 7 session 3 lost 50px of
 * baseline to exactly that.
 */
function framopiaRect(layer, comp, text, font, size) {
    var prop = layer.property('Source Text');
    var doc = prop.value;
    doc.text = text;
    doc.font = font;
    doc.fontSize = size;
    prop.setValue(doc);
    var r = layer.sourceRectAtTime(comp.duration / 2, false);
    return { width: r.width, height: r.height, top: r.top, left: r.left };
}

function framopiaMeasureAt(layer, comp, font, size, sample) {
    /* Measured once each: every call sets the text and re-measures the layer. */
    var oneWord = framopiaRect(layer, comp, sample.oneWord, font, size);
    var phrase = framopiaRect(layer, comp, sample.phrase, font, size);
    return {
        size: size,
        /* An uppercase letter with no descender: cap height. */
        capHeight: framopiaRect(layer, comp, 'H', font, size).height,
        /* A lowercase letter with neither: an x-height proxy. */
        xHeight: framopiaRect(layer, comp, 'x', font, size).height,
        oneWordText: sample.oneWord,
        oneWordAdvance: oneWord.width,
        oneWordRect: oneWord,
        phraseText: sample.phrase,
        phraseAdvance: phrase.width,
        phraseRect: phrase
    };
}

framopiaMeasureFonts();
