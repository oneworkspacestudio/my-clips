package clips

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

type App struct {
	helpers                                  mediaHelpers
	H                                        *apphost.Host
	storageMu                                sync.Mutex
	publishMu                                sync.Mutex
	VAPIDPrivate, VAPIDPublic                string
	Root, Guard, GuardToken, FFmpeg, FFprobe string
	now                                      func() time.Time
	limitsMu                                 sync.Mutex
	limits                                   map[string][]time.Time
}

func New(h *apphost.Host) (*App, error) {
	if e := migrate(h); e != nil {
		return nil, e
	}
	a := &App{H: h, Root: os.Getenv("MYCLIPS_PHOTOS_ROOT"), Guard: os.Getenv("MYCLIPS_STORAGE_GUARD_URL"), GuardToken: os.Getenv("MYCLIPS_STORAGE_GUARD_TOKEN"), FFmpeg: os.Getenv("MYCLIPS_FFMPEG"), FFprobe: os.Getenv("MYCLIPS_FFPROBE"), now: time.Now, limits: map[string][]time.Time{}}
	if a.Root == "" && h.Config.WorkspaceURL == "" {
		a.Root = filepath.Join(h.Config.Data, "media", "My Photos", "My Clips")
		os.Setenv("MYCLIPS_STANDALONE_STORAGE", "isolated")
	}
	if a.FFmpeg == "" {
		a.FFmpeg, _ = exec.LookPath("ffmpeg")
	}
	if a.FFprobe == "" {
		a.FFprobe, _ = exec.LookPath("ffprobe")
	}
	if e := a.recoverJobs(); e != nil {
		return nil, e
	}
	if e := a.prepareSounds(); e != nil {
		return nil, e
	}
	if e := a.preparePush(); e != nil {
		return nil, e
	}
	a.routes()
	return a, nil
}

func migrate(h *apphost.Host) error {
	migrations := []string{schema, clipsSchema, liveSchema}
	var current int
	if e := h.DB.QueryRow("SELECT coalesce(max(version),0) FROM host_migrations").Scan(&current); e != nil {
		return e
	}
	// Host.Migrate rejects a lower target as a downgrade. Reopening an already
	// upgraded database must skip completed steps, while newer schemas still fail.
	if current < 0 || current > len(migrations) {
		return errors.New("app data needs a newer executable; restore a compatible backup to downgrade")
	}
	for version := current + 1; version <= len(migrations); version++ {
		if e := h.Migrate(version, migrations[version-1]); e != nil {
			return e
		}
	}
	return nil
}
func uid(r *http.Request) string { return apphost.Current(r).User.ID }
func encode(v any) string        { b, _ := json.Marshal(v); return string(b) }
func validID(s string) bool      { return regexp.MustCompile(`^[a-f0-9]{48}$`).MatchString(s) }
func (a *App) fail(w http.ResponseWriter, e error) {
	a.H.Log.Error("social operation failed", "type", fmtType(e))
	apphost.Problem(w, 503, "This operation could not finish. Check My Photos and retry; nothing has been published.")
}
func fmtType(e error) string {
	if e == nil {
		return ""
	}
	return "operation"
}
func (a *App) route(method, path string, fn http.HandlerFunc) {
	a.H.Mux.HandleFunc(method+" "+path, a.H.Require(func(w http.ResponseWriter, r *http.Request) {
		a.ensureProfile(apphost.Current(r).User)
		if r.Method != "GET" && !a.allowed(uid(r)) {
			apphost.Problem(w, 429, "Too many changes. Wait a minute and retry.")
			return
		}
		fn(w, r)
	}))
}
func (a *App) allowed(user string) bool {
	a.limitsMu.Lock()
	defer a.limitsMu.Unlock()
	now := a.now()
	xs := a.limits[user]
	kept := xs[:0]
	for _, v := range xs {
		if now.Sub(v) < time.Minute {
			kept = append(kept, v)
		}
	}
	if len(kept) >= 120 {
		return false
	}
	a.limits[user] = append(kept, now)
	return true
}
func (a *App) routes() {
	a.route("GET", "/api/live", a.liveRooms)
	a.route("POST", "/api/live", a.startLive)
	a.route("POST", "/api/live/{id}/join", a.joinLive)
	a.route("POST", "/api/live/{id}/heartbeat", a.liveHeartbeat)
	a.route("POST", "/api/live/{id}/end", a.endLive)
	a.route("GET", "/api/live/{id}/signals", a.liveSignals)
	a.route("POST", "/api/live/{id}/signals", a.liveSignals)
	a.route("GET", "/api/clips", a.bootstrap)
	a.route("GET", "/api/discover", a.discover)
	a.route("POST", "/api/posts/{id}/signal", a.signal)
	a.route("POST", "/api/feed/reset", a.resetFeed)
	a.route("GET", "/api/posts/{id}/options", a.clipOptions)
	a.route("PUT", "/api/posts/{id}/options", a.clipOptions)
	a.route("GET", "/api/messages", a.messages)
	a.route("POST", "/api/messages", a.sendMessage)
	a.route("GET", "/api/sounds", a.sounds)
	a.route("POST", "/api/sounds", a.uploadSound)
	a.route("GET", "/api/sounds/{id}", a.soundFile)
	a.route("GET", "/api/stream/{id}/{file}", a.streamFile)
	a.route("GET", "/api/feed", a.feed)
	a.route("GET", "/api/posts/{id}", a.getPost)
	a.route("POST", "/api/posts", a.publish)
	a.route("PATCH", "/api/posts/{id}", a.editPost)
	a.route("POST", "/api/posts/{id}/{action}", a.postAction)
	a.route("GET", "/api/posts/{id}/comments", a.comments)
	a.route("POST", "/api/posts/{id}/comments", a.addComment)
	a.route("GET", "/api/profiles", a.profiles)
	a.route("GET", "/api/profiles/{id}", a.profile)
	a.route("PATCH", "/api/profile", a.editProfile)
	a.route("POST", "/api/profiles/{id}/relations", a.relation)
	a.route("GET", "/api/relations", a.relations)
	a.route("POST", "/api/media", a.upload)
	a.route("GET", "/api/media", a.library)
	a.route("GET", "/api/media/{id}", a.serveMedia)
	a.route("GET", "/api/drafts", a.drafts)
	a.route("PUT", "/api/drafts/{id}", a.saveDraft)
	a.route("DELETE", "/api/drafts/{id}", a.deleteDraft)
	a.route("GET", "/api/highlights", a.highlights)
	a.route("POST", "/api/highlights", a.addHighlight)
	a.route("GET", "/api/notifications", a.notifications)
	a.route("POST", "/api/notifications/read", a.readNotifications)
	a.route("GET", "/api/events", a.events)
	a.route("GET", "/api/preferences", a.preferences)
	a.route("PUT", "/api/preferences", a.setPreferences)
	a.route("POST", "/api/push/subscribe", a.subscribe)
	a.route("DELETE", "/api/push/subscribe", a.unsubscribe)
	a.route("POST", "/api/push/test", a.testPush)
	a.route("POST", "/api/jobs", a.createJob)
	a.route("GET", "/api/jobs", a.jobs)
	a.route("POST", "/api/reports", a.report)
	a.H.Mux.HandleFunc("GET /api/moderation", a.H.Owner(a.moderation))
	a.H.Mux.HandleFunc("POST /api/moderation/{id}", a.H.Owner(a.moderate))
	a.route("GET", "/api/export", a.exportAccount)
	a.route("POST", "/api/account/delete", a.deleteAccount)
}
func (a *App) bootstrap(w http.ResponseWriter, r *http.Request) {
	apphost.JSON(w, 200, map[string]any{"profile": a.getProfile(uid(r)), "helperStatus": a.helperProgress(), "photosConnected": a.storageCheck(r.Context()) == nil, "videoRendering": a.ffmpegPath() != "" && a.ffprobePath() != "", "pushKey": a.VAPIDPublic, "chatURL": a.H.Config.WorkspaceURL + "/_workspace/open/chat", "capabilities": map[string]bool{"live": true, "chatAdapter": true, "autoCaptions": false, "licensedMusic": true, "payments": false}})
}
func (a *App) Run(ctx context.Context) error {
	ticker := time.NewTicker(time.Second * 3)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			a.prepareMedia(ctx)
			a.tick(ctx)
		}
	}
}
func (a *App) tick(ctx context.Context) {
	a.H.Freeze.RLock()
	defer a.H.Freeze.RUnlock()
	now := a.now().Unix()
	a.publishScheduled(ctx)
	a.H.DB.Exec("UPDATE posts SET state='archived' WHERE kind='story' AND state='published' AND expires<=?", now)
	a.runJob(ctx)
	a.deliverPush(ctx)
}
func safeRoot(root string) error {
	if !filepath.IsAbs(root) || !strings.EqualFold(filepath.Base(root), "My Clips") || !strings.EqualFold(filepath.Base(filepath.Dir(root)), "My Photos") {
		return errors.New("choose My Photos/My Clips")
	}
	for p := filepath.Clean(root); ; p = filepath.Dir(p) {
		if info, e := os.Lstat(p); e == nil && info.Mode()&os.ModeSymlink != 0 {
			return errors.New("linked storage is not allowed")
		}
		if filepath.Dir(p) == p {
			break
		}
	}
	return nil
}
