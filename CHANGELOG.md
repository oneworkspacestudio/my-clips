# Changes

## 0.1.0-preview.2

Initial standalone Windows/PWA/Android application with vertical video feeds,
structured multi-clip editor, camera capture, filters/glow, text, soundtrack and
voiceover, CC0 defaults, authorized My Music imports, audience controls,
recommendations, profiles, follows, comments, mutual messages, notifications and
small WebRTC live rooms. Includes private Drive scopes and adaptive HLS streaming.

Requires Workspace 0.3.0-preview.51 for integrated private storage. See the
feature matrix and acceptance record before production use.

The first source candidate (preview1, unreleased) exposed a Windows native-path
creation bug for imported music and voiceover. Preview2 fixes nested original
paths and verifies byte preservation, no overwrite and root containment.
