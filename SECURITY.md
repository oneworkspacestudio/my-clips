# Security and privacy

Preview software; no independent security audit or production-scale claim.

Identity comes from the pinned Workspace apphost. Immutable issuer/subject pairs
own media, drafts, messages and follows. Mutations require authenticated sessions,
CSRF and account fencing. Private API/media responses are not service-worker
cached. Local drafts use account-scoped IndexedDB and clear on account changes.

Managed originals are physically outside every broad Drive source:
`Data/videos-clips/My Photos/My Clips/users/<identity-hash>/`.
The default-disabled, read-only native source gives each user only their own
physical scope. The server's loopback capability guard checks the actual native
configuration; uploads and streams fail closed if isolation is unavailable.
Rendered files are outside those original-file scopes. Do not repoint this source
at a shared folder, follow reparse points, or relax source defaults.

Every HLS playlist, segment, poster and MP4 range request checks current access.
Revoking source remix permission, making its account private, blocking the viewer
or removing the source also denies dependent remixes. Already downloaded copies
cannot be recalled. A server owner can access server files and moderate posts.
Messages and live signaling are not end-to-end encrypted by this application.

The editor accepts bounded structured operations, not arbitrary FFmpeg arguments.
Rendering has time, resolution and process-thread limits. Uploads are at most
100 MiB per clip, original storage 2 GiB per account in this preview, and creation
renders at most 180 seconds plus a five-second Stitch. Render derivatives and
backups need additional disk space and administrator retention.

Push notifications contain generic activity text, never private message bodies.
Android uses standard TLS validation, rejects cleartext/mixed content, isolates
camera permissions to the configured origin, and has no JavaScript/native bridge.
Web Push uses each app's protected VAPID key; Android activity polling can be
delayed by battery controls. TURN credentials are supplied to authorized live
clients and should be temporary credentials on a controlled relay.

Account disabling hides its posts and revokes sessions. It retains protected
originals for operator retention/backups and does not delete MyAccounts identity.
Exports include private originals: protect the downloaded archive.

Report vulnerabilities privately through the repository's security contact
before publishing exploitable details. Never include real cookies, tokens,
account exports, signing keys or private media in an issue.
