/*
 * Text measurement, done by After Effects because only After Effects can
 * answer it. Block 7 session 4 established that no font-metrics library in
 * this repo can: advance widths, kerning and Arabic positional shaping would
 * all have to be modelled, and a model of what AE will draw is not what AE
 * draws. The builder is already inside AE when it needs the width.
 *
 * ES3 only. This is the one place ExtendScript holds logic that could not live
 * in the service, and it is deliberate.
 *
 * `sourceRectAtTime` is measured at an explicit time, never `prop.value` and
 * never wherever the current time indicator happens to sit: Block 7 session 3
 * lost 50 px of baseline to exactly that. The source rect is the layer's own
 * bounds before its transforms, so an animated Position cannot move it — but
 * `measureAt` reports the rect at two times so the claim is checked rather
 * than asserted.
 */

/**
 * Sets a point-text layer's string, and its face and colour when the build
 * carries them.
 *
 * `style` is optional and absent for a client with no measured font names; the
 * template's own type is then left exactly as it was, which is what every build
 * did before Block 9 session 6. **A missing style is never a guessed one**:
 * After Effects accepts a font name it cannot resolve and renders a substitute
 * without saying so, so a guess would not fail — it would set the wrong type.
 *
 * `font`, `fillColor` and `text` go in one `setValue`: a TextDocument read from
 * a property is a copy, so writing it back twice would discard the first write.
 * `applyFill` has to be true or the colour is carried and not drawn.
 */
function framopiaSetText(layer, value, style) {
    var prop = layer.property('Source Text');
    var doc = prop.value;
    doc.text = value;
    if (style) {
        // A size-only style is legal: shrink-to-fit re-sets the size on a card
        // whose client carries no measured font names, and writing `undefined`
        // to `font` would break the layer rather than leave it alone.
        if (style.font) doc.font = style.font;
        if (style.fontSize) doc.fontSize = style.fontSize;
        if (style.fillColor) {
            doc.applyFill = true;
            doc.fillColor = style.fillColor;
        }
    }
    prop.setValue(doc);
}

/**
 * The string the fit actually left on the layer.
 *
 * A card that wrapped carries the two-line form; one that did not carries the
 * single line. A shadow drawn from the other one would not line up with the
 * word it is behind, and the difference is only knowable after the measurement.
 */
function framopiaFittedText(fit, candidate) {
    if (fit && fit.wrapped && candidate.twoLines) return candidate.twoLines;
    return candidate.oneLine;
}

/** What After Effects has on the layer now, for a caller that checks. */
function framopiaReadTextStyle(layer) {
    var doc = layer.property('Source Text').value;
    return { font: String(doc.font), fontSize: doc.fontSize };
}

function framopiaMeasureAt(layer, timeS) {
    var r = layer.sourceRectAtTime(timeS, false);
    return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Sets the card's text, measures it, and breaks it only if the measurement
 * says so. The break point arrives precomputed from the service; this decides
 * whether to use it.
 *
 * Returns everything measured along the way, including the one-line width of a
 * card that stayed on one line, so the survey can report a distribution rather
 * than a verdict.
 */
function framopiaFitText(layer, sampleTimeS, candidate, safeWidth, style) {
    var out = {
        wrapped: false,
        overflows: false,
        reason: null,
        oneLineWidth: null,
        wrappedWidth: null,
        lineWidths: null,
        oneLineTop: null,
        wrappedTop: null,
        lineRects: null,
        lineCount: 1
    };

    framopiaSetText(layer, candidate.oneLine, style);
    var one = framopiaMeasureAt(layer, sampleTimeS);
    out.oneLineWidth = one.width;
    out.oneLineTop = one.top;

    if (one.width <= safeWidth) return out;

    if (!candidate.twoLines) {
        // The ruling covers a card too wide to fit; it does not cover a single
        // word too wide to fit. Emitted whole and flagged rather than shrunk.
        out.overflows = true;
        out.reason = candidate.reason || 'no break point';
        return out;
    }

    framopiaSetText(layer, candidate.twoLines, style);
    var two = framopiaMeasureAt(layer, sampleTimeS);
    out.wrapped = true;
    out.lineCount = 2;
    out.wrappedWidth = two.width;
    out.wrappedTop = two.top;

    /*
     * Each line on its own. Two reasons: the wrapped rect is the union of the
     * two, so it could not say which line overran; and its `top` is the top of
     * line one's *ink*, which moves when the break changes which glyphs land on
     * line one. Comparing the wrapped rect's top against line one measured
     * alone is what actually tests whether the first line moved — comparing it
     * against the one-line rect tests something else and reads as a false
     * alarm.
     */
    var widths = [];
    var rects = [];
    for (var i = 0; i < candidate.lines.length; i++) {
        framopiaSetText(layer, candidate.lines[i], style);
        var lr = framopiaMeasureAt(layer, sampleTimeS);
        widths.push(lr.width);
        rects.push(lr);
    }
    out.lineWidths = widths;
    out.lineRects = rects;
    framopiaSetText(layer, candidate.twoLines, style);

    for (var j = 0; j < widths.length; j++) {
        if (widths[j] > safeWidth) {
            out.overflows = true;
            out.reason = 'line ' + (j + 1) + ' still exceeds the bound after breaking';
        }
    }
    return out;
}

/**
 * Makes a card fit: **break it if it can be broken, shrink it only if it
 * cannot.**
 *
 * PROJECT_SPEC §3 ruling 3 as the user settled it on 2026-08-30. The previous
 * reading forced every overlong card onto one line and scaled it down, which
 * made `test-1`'s keyword 56% the height of the ordinary cards around it — and
 * a keyword is meant to be the largest thing on screen. So a card with a space
 * to break at goes onto two lines at its authored size, and only a single word
 * with nowhere to break comes down in size.
 *
 * **The size is written on the TextDocument, never on the layer's Scale.** The
 * templates animate Scale, so writing it would fight the animation the user
 * authored.
 *
 * Every branch is taken on a width After Effects measured. The bound applies to
 * the **widest line**, which for a point-text layer is the width of the whole
 * layer's source rect — the rect is the union of the lines. Each line is also
 * measured on its own for the record, and the full text put back afterwards.
 */
function framopiaShrinkNextSize(fontSize, measuredWidth, safeWidth) {
    return Math.floor(fontSize * safeWidth / measuredWidth * 10000) / 10000;
}

/** Each line on its own, with the card's real text restored afterwards. */
function framopiaLineWidths(layer, sampleTimeS, lines, placed, style) {
    var widths = [];
    var i;
    for (i = 0; i < lines.length; i++) {
        framopiaSetText(layer, lines[i], style);
        widths.push(framopiaMeasureAt(layer, sampleTimeS).width);
    }
    framopiaSetText(layer, placed, style);
    return widths;
}

function framopiaFitCard(layer, sampleTimeS, candidate, safeWidth, style, maxAttempts) {
    var out = {
        text: candidate.oneLine,
        lines: [candidate.oneLine],
        broken: false,
        baseFontSize: null,
        finalFontSize: null,
        factor: 1,
        widthBeforePx: null,
        widthAfterPx: null,
        lineWidthsPx: null,
        measurements: [],
        attempts: 0,
        fits: false
    };

    framopiaSetText(layer, candidate.oneLine, style);
    var size = layer.property('Source Text').value.fontSize;
    out.baseFontSize = size;

    var width = framopiaMeasureAt(layer, sampleTimeS).width;
    out.widthBeforePx = width;
    out.measurements.push({ fontSize: size, broken: false, widthPx: width });
    out.attempts = 1;

    /* Step 2: a break is preferred over any reduction in size. */
    if (width > safeWidth && candidate.twoLines) {
        framopiaSetText(layer, candidate.twoLines, style);
        width = framopiaMeasureAt(layer, sampleTimeS).width;
        out.broken = true;
        out.text = candidate.twoLines;
        out.lines = candidate.lines;
        out.measurements.push({ fontSize: size, broken: true, widthPx: width });
        out.attempts = out.attempts + 1;
    }

    /* Step 3: only now, and keeping whatever break was made. */
    var limit = maxAttempts || 6;
    while (width > safeWidth && out.attempts < limit) {
        size = framopiaShrinkNextSize(size, width, safeWidth);
        framopiaSetText(layer, out.text, { fontSize: size });
        width = framopiaMeasureAt(layer, sampleTimeS).width;
        out.measurements.push({ fontSize: size, broken: out.broken, widthPx: width });
        out.attempts = out.attempts + 1;
    }

    var finalStyle = { fontSize: size };
    if (style && style.font) finalStyle.font = style.font;
    out.lineWidthsPx = out.broken
        ? framopiaLineWidths(layer, sampleTimeS, out.lines, out.text, finalStyle)
        : [width];
    out.finalFontSize = size;
    out.widthAfterPx = width;
    out.factor = out.baseFontSize === 0 ? 1 : size / out.baseFontSize;
    out.fits = width <= safeWidth;
    return out;
}

/**
 * The refusal, built where the measurements are.
 *
 * A card that converged the wrong way and one that was already at the bound
 * look identical from a single width, so the whole sequence goes in the
 * message — the person reading it cannot re-run the build.
 */
function framopiaTooWideMessage(id, kind, fit, safeWidth, font) {
    var parts = [];
    var i;
    for (i = 0; i < fit.measurements.length; i++) {
        var m = fit.measurements[i];
        parts.push(m.fontSize + (m.broken ? ' broken' : '') + ' -> ' + m.widthPx.toFixed(2) + 'px');
    }
    return id + ' (' + kind + ') cannot be brought under ' + safeWidth +
        'px in ' + fit.attempts + ' attempts: "' + fit.text + '" in ' +
        (font || 'the template\u2019s own face') + ' at ' + fit.baseFontSize + ', ' +
        (fit.broken ? 'broken onto two lines' : 'with no break point') +
        '. Measured ' + parts.join(', ') +
        '. The card is not clipped, so the build stops here.';
}
