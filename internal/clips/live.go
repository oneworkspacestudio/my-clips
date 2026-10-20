package clips

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
)

const liveSchema = `
CREATE TABLE live_rooms(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,updated INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE live_peers(room TEXT NOT NULL,user_id TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(room,user_id));
CREATE TABLE live_signals(id INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT NOT NULL,sender TEXT NOT NULL,recipient TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL);
`

func (a *App) liveRoom(id, user string) (string, bool) {
	var owner string
	var at int64
	var active bool
	if a.H.DB.QueryRow("SELECT owner,updated,active FROM live_rooms WHERE id=?", id).Scan(&owner, &at, &active) != nil || !active || at < a.now().Unix()-90 || a.blocked(user, owner) {
		return "", false
	}
	if user != owner && a.getProfile(owner).Private && !a.exists("SELECT count(*) FROM relations WHERE actor=? AND target=? AND kind='follow' AND state='accepted'", user, owner) {
		return "", false
	}
	return owner, true
}
func (a *App) liveRooms(w http.ResponseWriter, r *http.Request) {
	rows, e := a.H.DB.Query("SELECT id,title FROM live_rooms WHERE active=1 AND updated>? ORDER BY updated DESC LIMIT 100", a.now().Unix()-90)
	if e != nil {
		a.fail(w, e)
		return
	}
	out := []map[string]any{}
	for rows.Next() {
		var id, title string
		rows.Scan(&id, &title)
		out = append(out, map[string]any{"id": id, "title": title})
	}
	rows.Close()
	visible := []map[string]any{}
	for _, room := range out {
		if owner, ok := a.liveRoom(room["id"].(string), uid(r)); ok {
			room["owner"] = owner
			room["profile"] = a.getProfile(owner)
			visible = append(visible, room)
		}
	}
	apphost.JSON(w, 200, visible)
}
func (a *App) startLive(w http.ResponseWriter, r *http.Request) {
	var in struct{ Title string }
	if !apphost.Decode(w, r, &in) {
		return
	}
	in.Title = strings.TrimSpace(in.Title)
	if len(in.Title) < 1 || len(in.Title) > 150 {
		apphost.Problem(w, 400, "Give your live a title up to 150 characters")
		return
	}
	a.H.DB.Exec("UPDATE live_rooms SET active=0 WHERE owner=?", uid(r))
	id := apphost.ID()
	if _, e := a.H.DB.Exec("INSERT INTO live_rooms VALUES(?,?,?,?,1)", id, uid(r), in.Title, a.now().Unix()); e != nil {
		a.fail(w, e)
		return
	}
	apphost.JSON(w, 201, map[string]string{"id": id, "owner": uid(r)})
}
func (a *App) liveHeartbeat(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.liveRoom(r.PathValue("id"), uid(r))
	if !ok {
		http.NotFound(w, r)
		return
	}
	if owner == uid(r) {
		a.H.DB.Exec("UPDATE live_rooms SET updated=? WHERE id=?", a.now().Unix(), r.PathValue("id"))
		rows, e := a.H.DB.Query("SELECT user_id FROM live_peers WHERE room=? AND updated>?", r.PathValue("id"), a.now().Unix()-90)
		if e != nil {
			a.fail(w, e)
			return
		}
		candidates := []string{}
		for rows.Next() {
			var user string
			if rows.Scan(&user) == nil {
				candidates = append(candidates, user)
			}
		}
		rows.Close()
		authorized := []string{}
		for _, user := range candidates {
			if _, ok := a.liveRoom(r.PathValue("id"), user); ok {
				authorized = append(authorized, user)
			}
		}
		apphost.JSON(w, 200, map[string]any{"ok": true, "peers": authorized})
		return
	} else {
		a.H.DB.Exec("UPDATE live_peers SET updated=? WHERE room=? AND user_id=?", a.now().Unix(), r.PathValue("id"), uid(r))
	}
	apphost.JSON(w, 200, map[string]bool{"ok": true})
}
func (a *App) joinLive(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	owner, ok := a.liveRoom(id, uid(r))
	if !ok {
		http.NotFound(w, r)
		return
	}
	a.publishMu.Lock()
	defer a.publishMu.Unlock()
	if uid(r) != owner && a.exists("SELECT count(*) FROM live_peers WHERE room=? AND updated>? HAVING count(*)>=8", id, a.now().Unix()-60) && !a.exists("SELECT count(*) FROM live_peers WHERE room=? AND user_id=?", id, uid(r)) {
		apphost.Problem(w, 429, "This live has reached its 8-viewer preview capacity")
		return
	}
	if uid(r) != owner {
		a.H.DB.Exec("INSERT INTO live_peers VALUES(?,?,?) ON CONFLICT(room,user_id) DO UPDATE SET updated=excluded.updated", id, uid(r), a.now().Unix())
	}
	ice := json.RawMessage(`[]`)
	if raw := os.Getenv("MYCLIPS_ICE_SERVERS"); json.Valid([]byte(raw)) {
		ice = json.RawMessage(raw)
	}
	apphost.JSON(w, 200, map[string]any{"owner": owner, "iceServers": ice})
}
func (a *App) endLive(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	owner, ok := a.liveRoom(id, uid(r))
	if !ok || owner != uid(r) {
		http.NotFound(w, r)
		return
	}
	a.H.DB.Exec("UPDATE live_rooms SET active=0 WHERE id=?", id)
	a.H.DB.Exec("DELETE FROM live_signals WHERE room=?", id)
	apphost.JSON(w, 200, map[string]bool{"ok": true})
}
func (a *App) liveSignals(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	owner, ok := a.liveRoom(id, uid(r))
	if !ok {
		http.NotFound(w, r)
		return
	}
	if uid(r) != owner && !a.exists("SELECT count(*) FROM live_peers WHERE room=? AND user_id=? AND updated>?", id, uid(r), a.now().Unix()-90) {
		http.NotFound(w, r)
		return
	}
	if r.Method == "POST" {
		var in struct {
			To   string
			Body json.RawMessage
		}
		if !apphost.Decode(w, r, &in) {
			return
		}
		if len(in.Body) > 24000 || !json.Valid(in.Body) || in.To == uid(r) || a.blocked(uid(r), in.To) {
			apphost.Problem(w, 400, "Invalid live signaling message")
			return
		}
		if uid(r) != owner && in.To != owner || uid(r) == owner && !a.exists("SELECT count(*) FROM live_peers WHERE room=? AND user_id=? AND updated>?", id, in.To, a.now().Unix()-90) {
			http.NotFound(w, r)
			return
		}
		if _, e := a.H.DB.Exec("INSERT INTO live_signals(room,sender,recipient,body,created) VALUES(?,?,?,?,?)", id, uid(r), in.To, string(in.Body), a.now().Unix()); e != nil {
			a.fail(w, e)
			return
		}
		a.H.DB.Exec("DELETE FROM live_signals WHERE created<?", a.now().Unix()-120)
		apphost.JSON(w, 201, map[string]bool{"ok": true})
		return
	}
	after := parseBefore(r.URL.Query().Get("after"))
	if after == 1<<62 {
		after = 0
	}
	rows, e := a.H.DB.Query("SELECT id,sender,body FROM live_signals WHERE room=? AND recipient=? AND id>? ORDER BY id LIMIT 100", id, uid(r), after)
	if e != nil {
		a.fail(w, e)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var n int64
		var sender, body string
		rows.Scan(&n, &sender, &body)
		out = append(out, map[string]any{"id": n, "sender": sender, "body": json.RawMessage(body)})
	}
	apphost.JSON(w, 200, out)
}
