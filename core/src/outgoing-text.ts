/**
 * Nothing that names a file on this machine is sent to a model.
 *
 * **The rule this guards is `core/src/client-pictures.ts`'s first one**: a
 * client's own photograph — a doctor's patient results above all — never leaves
 * this machine. Until now that rule was held by a source scan over
 * `service/src/images/`, which fails if one of those files mentions
 * `clientPictures` by name. That catches the obvious mistake and nothing else:
 * a file reading `mode.pictures` directly, or a path reaching a prompt from
 * anywhere upstream, passes it silently.
 *
 * So the property is asserted where it can actually be observed — at the last
 * point before the request leaves. The image client takes strings, so a
 * photograph could only leave as a path, and a prompt has no legitimate reason
 * to carry one.
 *
 * Deliberately narrow: it looks for a filesystem path, not for a photograph.
 * A guard that had to know which paths were photographs would have to read the
 * client's pictures, which is exactly what the source scan forbids the image
 * graph from doing.
 */
export class OutgoingPathError extends Error {
  constructor(field: string, offending: string) {
    super(
      `${field} names a file on this machine (${offending}). ` +
        'Nothing on this disk is sent to a model — a client’s own photographs least of all.',
    );
    this.name = 'OutgoingPathError';
  }
}

/*
 * A POSIX absolute path with at least one directory in it, and a Windows drive
 * path. A bare `/` or a lone word after a slash is not a path claim: prompts
 * legitimately contain "3/4", "and/or", dates and ratios, and flagging those
 * would make the guard something people switch off.
 */
const ABSOLUTE_PATH = /(?:^|[\s"'(<])(?:[A-Za-z]:\\[^\s"'<>)]+|(?:~)?\/(?:[\w.-]+\/)+[\w.-]+)/;

/** The path in `text`, or null when it names none. */
export function localPathIn(text: string): string | null {
  const found = ABSOLUTE_PATH.exec(text);
  if (found === null) return null;
  return found[0].replace(/^[\s"'(<]/, '');
}

/**
 * Throws rather than sending. `field` names which string it was, so a failure
 * says where to look.
 */
export function assertSendsNoLocalPath(field: string, text: string): void {
  const found = localPathIn(text);
  if (found !== null) throw new OutgoingPathError(field, found);
}
