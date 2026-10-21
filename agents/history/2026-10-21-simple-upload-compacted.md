# My Clips simple upload

User requested the three supplied TikTok-style reference screens: select media,
preview, post details. Editing/creation must be behind an explicit button and a
simple upload must not require a manual render. Prior chat authorization includes
local installation and GitHub pushes/releases. No subagents used.

Canonical repository started clean at efc7f42 (public preview4 code f515b49).
Workspace58/Monitor3 is now installed and public; older history's Workspace53
release checkpoint is stale. This change is a Clips component update; no manager
change is needed. Preserve unrelated installed versions, notably installed Chat9.

Implemented AUI screens SelectMedia/UploadPreview/PostDetails; retained Editor as
the optional advanced page. Automatic upload/preparation/publish with progress,
safe retries and account-scoped IndexedDB drafts. No implicit 60-second trim.
Local thumbnail stills avoid decoder exhaustion; source File URLs are revoked.
Photo carousels, stories, captions, location, cover frame, audience, comment/remix
options and schedule use real APIs. Add link adds an HTTPS URL to the description.
Do not simulate unavailable AutoCut, commercial sounds or third-party posting.

Publication and clip_options now commit atomically, with a rollback/idempotency
regression. CoverTime is a bounded EDL property used for the streaming poster.
Preserve immutable account IDs, expected-account/CSRF guards, media authorization,
the protected Photos/Clips adapter and fail-closed isolation checks. Owner data is
never a fixture. Android client2 uses server UI; no new APK is needed here.

Go tests/vet and AUI/TypeScript/Vite build passed. Native Chrome synthetic checks
passed for the three screens, optional edits, cover, draft restore, failed Post
retry with one upload/one job, private media/range and direct photos. Phone
screenshots at390 and overflow checks at320/576/1024 passed; all nine thumbnails
were visually checked after replacing live tile decoders with stills. Full legacy
HLS, music/text edits, audience denial, real synthetic camera and two-session live
regression also passed (three Chrome tests). Existing Vite bundle-size advisory
remains; it does not block the build.

Task artifacts: I:/Projects/tooling/clips-upload-20261021; scripts/isolated NTFS
fixtures: C:/Projects/.cache/clips-upload-20261021. Python37, Node26, Go1.27.2 on I.
Use per-process GIT_CONFIG_GLOBAL=NUL and GIT_CONFIG_NOSYSTEM=1 with exact
safe.directory to avoid unavailable-drive global Git config stalls. Tests need
GOTMPDIR on C NTFS; module/build caches on I. Published assets are immutable.
Resume: finish acceptance, review diff, build release5 with exact source commit,
create managed workspace-update.json from public Workspace58 catalog, verify
published asset digests, then use normal backed-up updater selecting only clips.


## Packaging correction

Preview5 source289fd0d and eleven assets were published/verified. The isolated
Workspace58→Clips5 online upgrade then safely refused the manifest before
downtime: it included clips-contract from the full distribution catalog, while
installed catalogs retain only the executable and three license packages.
Preview4 had the same inherited publisher mistake. Do not replace immutable5
assets. Preview6 uses the installed catalog shape and only those four packages;
compatibility.json remains in the standalone ZIP. The UI code is unchanged.
Native predecessor setup/guard/OIDC and original upload passed before refusal.
An initial harness attempt also used unsupported old `gh auth token`; removed
that call. Anonymous public update discovery works without a token.
