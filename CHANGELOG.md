# Changes

## 0.1.0-preview.4

Fixes restart of an existing Clips database. Startup now applies only pending
migrations, preserving accounts and content while retaining the future-schema
downgrade guard. Includes preview3's integrated Workspace navigation and short
sidebar fix. Use Workspace53. Preview2/3 could start a fresh database but failed
when reopening its completed migrations; preview4 supersedes them.

## 0.1.0-preview.3

Workspace now has its own navigation item on phones and in the sidebar on wider
screens. With Workspace52, this opens the app picker and suppresses the floating
launcher while the integrated control is visible. All six phone items fit at
320 CSS pixels; no launcher covers For You or video captions. Keyboard activation,
Escape dismissal and focus return remain available. The link opens Workspace
normally if the picker script is unavailable. Android client2 uses this updated
server UI without requiring a new APK.

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
