# Implemented behaviour and limits

| Area | Implemented | Preview boundary |
| --- | --- | --- |
| Feed | Vertical scroll/snap, active-video playback, For You/Following/Friends, search, likes, saves and comments | Latest 1,000 candidates, returns up to 60; no endless catalog pagination |
| Ranking | Recency, follows, watch completion/skips, hashtag interests, seen penalty, creator diversity, reset and Not interested | Original explainable heuristic, not TikTok's proprietary model; no ML training service |
| Capture | Camera, microphone opt-in, flip, pause/resume, multi-clip, 60-second recording | Device codec/permission support varies; no background recording |
| Editor | Up to ten clips, trim/speed/reorder, seven filters plus none, glow, flip, timed text/emoji, preview, music and voice mixing | 180-second render; no face AR, automatic captions, chroma key or beat detection |
| Music | Six embedded CC0 jingles, own files and authenticated My Music browser import | Rights confirmation required; commercial catalog rights not supplied; My Music requires managed same-origin deployment |
| Publishing | Caption, audience, schedule, private local draft, opt-in Duet/Stitch | Draft UI requires an authenticated online session to reopen; no resumable chunk upload |
| Drive | Unmodified originals, account-scoped read-only native source, fail-closed configuration guard | Derivatives are app-managed files; no Google Drive integration |
| Streaming | 2-second HLS segments, three measured bitrate tiers, poster, MP4 fast start/ranges, bounded player buffer | CPU encoding, no GPU farm, CDN, autoscaler or load benchmark |
| Community | Profiles, private follows, approval, block/mute/restrict, reporting, server-owner moderation | No automated trust/safety classifier or age-assurance system |
| Messaging | Mutual-follow messages, shares, retry deduplication and unread activity | No application E2EE, attachments, calls or message requests |
| Live | Real WebRTC camera/audio, private-account audience checks, eight viewers, heartbeat expiry | Peer mesh; operator TURN needed on restrictive networks; no SFU, gifts, recordings or RTMP |
| Notifications | Durable inbox, SSE, opt-in Web Push, quiet hours; native Android polling | Browser delivery needs HTTPS/support; no FCM and no guaranteed immediate background delivery |
| Android | Signed native WebView shell, server connection, file picker, capture permissions, notification job | Same server UI; no independent offline-native video editor or Play Store publication |
| Commerce | None | No ads, Shop, coins, gifts, subscriptions or payments |

Default sound titles are original display labels for unchanged Kenney files;
the upstream archive and selected asset hashes are in `default-music.json`.
