# Base selection

Reviewed 20 October 2026:

| Candidate | Useful capabilities | Fit |
| --- | --- | --- |
| [Loops server](https://github.com/joinloops/loops-server) | Federated short video network, AGPL-3.0 | PHP/Laravel/Redis deployment introduces another runtime and identity/storage integration. |
| [PeerTube](https://docs.joinpeertube.org/admin/configuration) | Adaptive HLS, creator tools, federation and live streaming | A substantial video platform with its own operational model. |
| My Social + My Tube | Existing native Windows apphost, MyAccounts, scoped Drive originals, privacy and notifications; tested HLS rate ladder | Selected foundation for an independent app compatible with One Workspace. |

My Clips has original branding and implementation. Familiar navigation and
creation flows are informed by [TikTok's creation documentation](https://support.tiktok.com/en/using-tiktok/creating-videos/stitch).
Its explainable recommendation model uses watch completion, skips, interests,
follows, freshness and creator diversity, informed by
[TikTok's public description of signals](https://support.tiktok.com/en/using-tiktok/exploring-videos/how-tiktok-recommends-content).
This is not TikTok's proprietary model or an integration with TikTok accounts.

Code provenance: My Social source 0744a86c826a978c76cbfe521b00336dbe187dc0
(Apache-2.0) and My Tube source da3dc1d8f59d9932c09cac71b3528c484c9cdf6f
(see retained notices). No Loops or PeerTube source is copied.
