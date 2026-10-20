package clips

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
)

//go:embed sounds/*.ogg
var defaultSounds embed.FS
var defaultSoundNames = map[string]string{"jingles_NES00": "Pixel sunrise", "jingles_NES03": "Next level", "jingles_PIZZI00": "Little adventure", "jingles_PIZZI03": "Bright idea", "jingles_STEEL00": "Island afternoon", "jingles_SAX00": "After hours"}

func soundTitle(raw string) string {
	var p struct{ Title string }
	json.Unmarshal([]byte(raw), &p)
	return p.Title
}
func (a *App) prepareSounds() error {
	dir := filepath.Join(a.H.Config.Data, "sounds")
	if e := os.MkdirAll(dir, 0700); e != nil {
		return e
	}
	for id := range defaultSoundNames {
		b, e := defaultSounds.ReadFile("sounds/" + id + ".ogg")
		if e != nil {
			return e
		}
		file := filepath.Join(dir, id+".ogg")
		old, _ := os.ReadFile(file)
		if string(old) != string(b) {
			if e = os.WriteFile(file, b, 0600); e != nil {
				return e
			}
		}
	}
	return nil
}
func (a *App) soundPath(owner, id string) (string, error) {
	if _, ok := defaultSoundNames[id]; ok {
		return filepath.Join(a.H.Config.Data, "sounds", id+".ogg"), nil
	}
	if !validID(id) {
		return "", errors.New("sound unavailable")
	}
	m, e := a.media(id)
	if e != nil || m.Owner != owner || m.Kind != "sounds" {
		return "", errors.New("sound unavailable")
	}
	p := filepath.Join(a.Root, filepath.FromSlash(m.Original))
	if !withinRoot(a.Root, p) {
		return "", errors.New("sound unavailable")
	}
	return p, nil
}
func (a *App) sounds(w http.ResponseWriter, r *http.Request) {
	out := []map[string]string{}
	for id, name := range defaultSoundNames {
		out = append(out, map[string]string{"id": id, "name": name, "artist": "Kenney", "license": "CC0-1.0", "source": "default", "url": "https://kenney.nl/assets/music-jingles"})
	}
	rows, e := a.H.DB.Query("SELECT id,project FROM media WHERE owner=? AND kind='sounds' ORDER BY created DESC LIMIT 100", uid(r))
	if e != nil {
		a.fail(w, e)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id, raw string
		rows.Scan(&id, &raw)
		out = append(out, map[string]string{"id": id, "name": soundTitle(raw), "source": "your-library", "license": "Your confirmed rights"})
	}
	apphost.JSON(w, 200, out)
}
func (a *App) soundFile(w http.ResponseWriter, r *http.Request) {
	p, e := a.soundPath(uid(r), r.PathValue("id"))
	if e != nil {
		http.NotFound(w, r)
		return
	}
	if _, ok := defaultSoundNames[r.PathValue("id")]; !ok && a.storageCheck(r.Context()) != nil {
		apphost.Problem(w, 503, "Protected storage is unavailable")
		return
	}
	f, e := os.Open(p)
	if e != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, e := f.Stat()
	if e != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	http.ServeContent(w, r, filepath.Base(p), info.ModTime(), f)
}
func (a *App) uploadSound(w http.ResponseWriter, r *http.Request) {
	if a.storageCheck(r.Context()) != nil || a.ffprobePath() == "" {
		apphost.Problem(w, 503, "Storage and media tools must be connected")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32<<20)
	if e := r.ParseMultipartForm(1 << 20); e != nil {
		apphost.Problem(w, 413, "Choose an audio file up to 30 MiB")
		return
	}
	defer r.MultipartForm.RemoveAll()
	if r.FormValue("rights") != "confirmed" {
		apphost.Problem(w, 400, "Confirm permission to use this sound in your videos")
		return
	}
	f, h, e := r.FormFile("audio")
	if e != nil {
		apphost.Problem(w, 400, "Choose an audio file")
		return
	}
	defer f.Close()
	b, e := io.ReadAll(io.LimitReader(f, 30<<20+1))
	if e != nil || len(b) > 30<<20 || len(b) == 0 {
		apphost.Problem(w, 413, "Choose an audio file up to 30 MiB")
		return
	}
	ext := strings.ToLower(filepath.Ext(h.Filename))
	switch ext {
	case ".mp3", ".ogg", ".wav", ".m4a", ".aac", ".webm", ".flac":
	default:
		apphost.Problem(w, 415, "Choose MP3, Ogg, WAV, M4A, AAC, WebM or FLAC")
		return
	}
	a.storageMu.Lock()
	defer a.storageMu.Unlock()
	var used int64
	a.H.DB.QueryRow("SELECT coalesce(sum(bytes),0) FROM media WHERE owner=?", uid(r)).Scan(&used)
	if used+int64(len(b)) > 2<<30 {
		apphost.Problem(w, 413, "Your media quota is full")
		return
	}
	id := apphost.ID()
	rel := filepath.Join("users", uid(r), "sounds", id+ext)
	root, e := os.OpenRoot(a.Root)
	if e != nil {
		a.fail(w, e)
		return
	}
	defer root.Close()
	if e = writeRoot(root, rel, b); e != nil {
		a.fail(w, e)
		return
	}
	committed := false
	defer func() {
		if !committed {
			root.Remove(rel)
		}
	}()
	info, e := a.probe(r.Context(), filepath.Join(a.Root, rel))
	if e != nil || !info.Audio {
		apphost.Problem(w, 415, "Use audio up to 10 minutes")
		return
	}
	sum := sha256.Sum256(b)
	name := r.FormValue("title")
	if name == "" {
		name = filepath.Base(h.Filename)
	}
	if len(name) > 150 {
		name = name[:150]
	}
	project := encode(map[string]any{"title": name, "duration": info.Duration, "rightsConfirmed": true})
	_, e = a.H.DB.Exec("INSERT INTO media VALUES(?,?,?,?,?,?,?,?,?,?,?)", id, uid(r), "sounds", filepath.ToSlash(rel), "", http.DetectContentType(b), hex.EncodeToString(sum[:]), len(b), "ready", a.now().Unix(), project)
	if e != nil {
		a.fail(w, e)
		return
	}
	committed = true
	apphost.JSON(w, 201, map[string]string{"id": id, "name": name})
}
