package clips

import (
	"archive/zip"
	"context"
	"encoding/json"
	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func (a *App) jobs(w http.ResponseWriter, r *http.Request) {
	rows, e := a.H.DB.Query("SELECT id,media_id,state,progress,error FROM jobs WHERE owner=? ORDER BY created DESC LIMIT 30", uid(r))
	if e != nil {
		a.fail(w, e)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, media, state, err string
		var progress int
		rows.Scan(&id, &media, &state, &progress, &err)
		out = append(out, map[string]any{"id": id, "media": media, "state": state, "progress": progress, "error": err})
	}
	apphost.JSON(w, 200, out)
}
func (a *App) runJob(ctx context.Context) {
	var id, owner, media, raw string
	if a.H.DB.QueryRow("SELECT id,owner,media_id,edl FROM jobs WHERE state='queued' ORDER BY created LIMIT 1").Scan(&id, &owner, &media, &raw) != nil {
		return
	}
	if a.storageCheck(ctx) != nil {
		return
	}
	res, e := a.H.DB.Exec("UPDATE jobs SET state='running',progress=5 WHERE id=? AND state='queued'", id)
	if e != nil {
		return
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		return
	}
	var edl EDL
	if json.Unmarshal([]byte(raw), &edl) != nil {
		return
	}
	err := a.render(ctx, id, owner, media, edl)
	if err != nil {
		a.H.Log.Warn("Render could not complete", "job", id, "diagnostic", err.Error())
		a.H.DB.Exec("UPDATE jobs SET state='failed',error='Render failed. Check clip duration, FFmpeg availability and free storage; retry from the draft.' WHERE id=?", id)
	} else {
		a.H.DB.Exec("UPDATE jobs SET state='complete',progress=100 WHERE id=?", id)
	}
}
func withinRoot(root, p string) bool {
	resolved, e := filepath.EvalSymlinks(p)
	if e != nil {
		return false
	}
	rel, e := filepath.Rel(root, resolved)
	return e == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
func (a *App) report(w http.ResponseWriter, r *http.Request) {
	var in struct{ Post, Reason string }
	if !apphost.Decode(w, r, &in) {
		return
	}
	p, e := a.post(in.Post)
	if e != nil || !a.visible(uid(r), p) {
		http.NotFound(w, r)
		return
	}
	if len(in.Reason) < 3 || len(in.Reason) > 1000 {
		apphost.Problem(w, 400, "Explain the report in 3–1,000 characters")
		return
	}
	a.H.DB.Exec("INSERT INTO reports VALUES(?,?,?,?,'open',?)", apphost.ID(), uid(r), p.ID, in.Reason, a.now().Unix())
	apphost.JSON(w, 201, map[string]bool{"ok": true})
}
func (a *App) moderation(w http.ResponseWriter, r *http.Request) {
	rows, e := a.H.DB.Query("SELECT id,post_id,reason,created FROM reports WHERE state='open' ORDER BY created LIMIT 100")
	if e != nil {
		a.fail(w, e)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, post, reason string
		var at int64
		rows.Scan(&id, &post, &reason, &at)
		out = append(out, map[string]any{"id": id, "post": post, "reason": reason, "created": at})
	}
	apphost.JSON(w, 200, out)
}
func (a *App) moderate(w http.ResponseWriter, r *http.Request) {
	var in struct{ Action string }
	if !apphost.Decode(w, r, &in) {
		return
	}
	if in.Action != "remove" && in.Action != "dismiss" {
		apphost.Problem(w, 400, "Choose Remove or Dismiss")
		return
	}
	tx, e := a.H.DB.Begin()
	if e != nil {
		a.fail(w, e)
		return
	}
	defer tx.Rollback()
	if in.Action == "remove" {
		_, e = tx.Exec("UPDATE posts SET state='removed' WHERE id=(SELECT post_id FROM reports WHERE id=?)", r.PathValue("id"))
		if e != nil {
			a.fail(w, e)
			return
		}
	}
	_, e = tx.Exec("UPDATE reports SET state=? WHERE id=?", in.Action, r.PathValue("id"))
	if e != nil {
		a.fail(w, e)
		return
	}
	if e = tx.Commit(); e != nil {
		a.fail(w, e)
		return
	}
	a.H.Audit(uid(r), "moderation."+in.Action, r.PathValue("id"))
	apphost.JSON(w, 200, map[string]bool{"ok": true})
}
func (a *App) exportAccount(w http.ResponseWriter, r *http.Request) {
	if e := a.storageCheck(r.Context()); e != nil {
		a.fail(w, e)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="my-clips-export.zip"`)
	z := zip.NewWriter(w)
	defer z.Close()
	f, e := z.Create("profile.json")
	if e != nil {
		return
	}
	json.NewEncoder(f).Encode(a.getProfile(uid(r)))
	rows, e := a.H.DB.Query("SELECT id FROM posts WHERE owner=?", uid(r))
	if e != nil {
		return
	}
	ids := []string{}
	for rows.Next() {
		var id string
		rows.Scan(&id)
		ids = append(ids, id)
	}
	rows.Close()
	posts := []Post{}
	for _, id := range ids {
		p, e := a.post(id)
		if e == nil {
			posts = append(posts, p)
		}
	}
	f, e = z.Create("posts.json")
	if e != nil {
		return
	}
	json.NewEncoder(f).Encode(posts)
	rows, e = a.H.DB.Query("SELECT DISTINCT original FROM media WHERE owner=?", uid(r))
	if e != nil {
		return
	}
	paths := []string{}
	for rows.Next() {
		var p string
		rows.Scan(&p)
		paths = append(paths, p)
	}
	rows.Close()
	root, e := os.OpenRoot(a.Root)
	if e != nil {
		return
	}
	defer root.Close()
	for _, p := range paths {
		f, e := root.Open(filepath.FromSlash(p))
		if e != nil {
			continue
		}
		out, e := z.Create("originals/" + filepath.Base(p))
		if e == nil {
			io.Copy(out, io.LimitReader(f, 101<<20))
		}
		f.Close()
	}
}
func (a *App) deleteAccount(w http.ResponseWriter, r *http.Request) {
	var in struct{ Confirmation string }
	if !apphost.Decode(w, r, &in) {
		return
	}
	if in.Confirmation != "DELETE MY CLIPS ACCOUNT" {
		apphost.Problem(w, 400, "Type DELETE MY CLIPS ACCOUNT to confirm")
		return
	}
	tx, e := a.H.DB.Begin()
	if e != nil {
		a.fail(w, e)
		return
	}
	defer tx.Rollback()
	for _, q := range []string{"UPDATE posts SET state='deleted' WHERE owner=?", "DELETE FROM host_sessions WHERE user_id=?", "DELETE FROM drafts WHERE owner=?", "DELETE FROM push_subscriptions WHERE owner=?", "DELETE FROM preferences WHERE user_id=?", "DELETE FROM highlights WHERE owner=?", "DELETE FROM events WHERE user_id=?", "UPDATE profiles SET bio='',links='[]',private=1 WHERE user_id=?", "UPDATE host_users SET role='disabled',name='Deleted account',email='' WHERE id=?"} {
		if _, e = tx.Exec(q, uid(r)); e != nil {
			a.fail(w, e)
			return
		}
	}
	if e = tx.Commit(); e != nil {
		a.fail(w, e)
		return
	}
	apphost.JSON(w, 200, map[string]string{"status": "disabled", "retention": "Originals remain protected for owner-managed retention and backup. This does not delete your MyAccounts identity."})
}
