/*
 * Never import a project into itself.
 *
 * Block 9 session 10 wrote a measurement script that imported
 * `templates/library.aep` while that same file was the open project. After
 * Effects does it without complaint: the result was a project holding two of
 * every comp, dirty, and both the audit and the build then refused it — which
 * cost a session. The file on disk was never in danger, but nothing said so at
 * the time.
 *
 * Every script that opens or imports a project checks this first. The
 * comparison is on `fsName`, After Effects' own absolute path for a file, so a
 * relative path or a symlink cannot slip past it.
 *
 * ES3 only.
 */

function framopiaRefuseSelfImport(pathStr) {
    var open = null;
    try {
        open = app.project === null ? null : app.project.file;
    } catch (e) {
        // A project with no file cannot be the one being imported.
        return;
    }
    if (open === null) return;

    var incoming = new File(pathStr);
    if (open.fsName !== incoming.fsName) return;

    throw new Error(
        'refusing to import ' + incoming.fsName + ' into itself: that file is the project ' +
            'currently open in After Effects. Importing it would duplicate every comp and ' +
            'leave the project dirty. Close it first, or open something else.'
    );
}
