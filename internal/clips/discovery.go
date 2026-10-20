package clips

import (
	"encoding/json"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strings"

	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
)

const clipsSchema = `
CREATE TABLE watch_signals(user_id TEXT NOT NULL,post_id TEXT NOT NULL,seconds REAL NOT NULL DEFAULT 0,completion REAL NOT NULL DEFAULT 0,skipped INTEGER NOT NULL DEFAULT 0,hidden INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL,PRIMARY KEY(user_id,post_id));
CREATE TABLE watch_events(user_id TEXT NOT NULL,event_id TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(user_id,event_id));
CREATE TABLE interests(user_id TEXT NOT NULL,tag TEXT NOT NULL,weight REAL NOT NULL DEFAULT 0,PRIMARY KEY(user_id,tag));
CREATE TABLE messages(id TEXT PRIMARY KEY,sender TEXT NOT NULL,recipient TEXT NOT NULL,body TEXT NOT NULL,post_id TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL,seen INTEGER NOT NULL DEFAULT 0,request_key TEXT NOT NULL,UNIQUE(sender,request_key));
CREATE INDEX message_inbox ON messages(recipient,created);
CREATE TABLE clip_options(post_id TEXT PRIMARY KEY,comments INTEGER NOT NULL DEFAULT 1,remix INTEGER NOT NULL DEFAULT 0,downloads INTEGER NOT NULL DEFAULT 0);
`

var hashtagRE = regexp.MustCompile(`#[\pL\pN_]{1,40}`)

func tags(caption string) []string {
	found := map[string]bool{}
	out := []string{}
	for _, s := range hashtagRE.FindAllString(strings.ToLower(caption), 12) {
		if !found[s] {
			out = append(out, s)
			found[s] = true
		}
	}
	return out
}

type rankedPost struct {
	Post
	Reason string  `json:"reason"`
	Score  float64 `json:"-"`
}

func (a *App) discover(w http.ResponseWriter, r *http.Request) {
	user, mode := uid(r), r.URL.Query().Get("mode")
	query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	if len(query) > 100 {
		apphost.Problem(w, 400, "Search is too long")
		return
	}
	weights := map[string]float64{}
	rows, err := a.H.DB.Query("SELECT tag,weight FROM interests WHERE user_id=?", user)
	if err != nil {
		a.fail(w, err)
		return
	}
	for rows.Next() {
		var t string
		var v float64
		if rows.Scan(&t, &v) == nil {
			weights[t] = v
		}
	}
	rows.Close()
	rows, err = a.H.DB.Query("SELECT id FROM posts WHERE state='published' AND kind='reel' AND publish_at<=? ORDER BY publish_at DESC,id DESC LIMIT 1000", a.now().Unix())
	if err != nil {
		a.fail(w, err)
		return
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	candidates := []rankedPost{}
	for _, id := range ids {
		p, e := a.post(id)
		if e != nil || !a.visible(user, p) || a.exists("SELECT count(*) FROM relations WHERE actor=? AND target=? AND kind='mute'", user, p.Owner) {
			continue
		}
		follow := a.exists("SELECT count(*) FROM relations WHERE actor=? AND target=? AND kind='follow' AND state='accepted'", user, p.Owner)
		if mode == "following" && !follow {
			continue
		}
		if mode == "friends" && (!follow || !a.exists("SELECT count(*) FROM relations WHERE actor=? AND target=? AND kind='follow' AND state='accepted'", p.Owner, user)) {
			continue
		}
		if mode == "saved" && !a.exists("SELECT count(*) FROM engagement WHERE user_id=? AND post_id=? AND kind='save'", user, id) {
			continue
		}
		if owner := r.URL.Query().Get("owner"); owner != "" && owner != p.Owner {
			continue
		}
		if query != "" && !strings.Contains(strings.ToLower(p.Caption+" "+a.getProfile(p.Owner).Handle), query) {
			continue
		}
		var hidden, skipped int
		var completion float64
		a.H.DB.QueryRow("SELECT hidden,skipped,completion FROM watch_signals WHERE user_id=? AND post_id=?", user, id).Scan(&hidden, &skipped, &completion)
		if hidden != 0 {
			continue
		}
		p = a.decorate(p, user)
		age := math.Max(0, float64(a.now().Unix()-p.PublishAt)/3600)
		score := 4/(1+age/24) + math.Log1p(float64(p.Likes))*0.5 + math.Log1p(float64(p.Comments))*0.25
		reason := "A recent clip to discover"
		for _, tag := range tags(p.Caption) {
			if weights[tag] > 0 {
				score += math.Min(6, weights[tag])
				reason = "Because you enjoy " + tag
			}
		}
		if follow {
			score += 3
			reason = "From someone you follow"
		}
		if completion > 0 {
			score -= 2 + completion*2
		}
		if skipped != 0 {
			score -= 4
		}
		if mode == "following" || mode == "friends" {
			score = float64(p.PublishAt)
		}
		candidates = append(candidates, rankedPost{p, reason, score})
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].Score == candidates[j].Score {
			return candidates[i].ID > candidates[j].ID
		}
		return candidates[i].Score > candidates[j].Score
	})
	// Greedy diversity avoids adjacent creators when another creator is available.
	out := []rankedPost{}
	last := ""
	for len(candidates) > 0 && len(out) < 60 {
		index := 0
		if mode != "following" && mode != "friends" {
			for i, c := range candidates {
				if c.Owner != last {
					index = i
					break
				}
			}
		}
		chosen := candidates[index]
		out = append(out, chosen)
		last = chosen.Owner
		candidates = append(candidates[:index], candidates[index+1:]...)
	}
	apphost.JSON(w, 200, out)
}

func (a *App) signal(w http.ResponseWriter, r *http.Request) {
	p, e := a.post(r.PathValue("id"))
	if e != nil || !a.visible(uid(r), p) {
		http.NotFound(w, r)
		return
	}
	var in struct {
		Event             string
		Seconds, Duration float64
		Hidden            bool
	}
	if !apphost.Decode(w, r, &in) {
		return
	}
	if len(in.Event) < 8 || len(in.Event) > 100 || in.Seconds < 0 || in.Seconds > 600 || in.Duration <= 0 || in.Duration > 600 || math.IsNaN(in.Seconds) || math.IsNaN(in.Duration) {
		apphost.Problem(w, 400, "Invalid watch event")
		return
	}
	// Clamp observed playback to the known edit duration, never trust a client
	// assertion of a full watch of a much shorter fake duration.
	if len(p.Media) > 0 {
		if m, err := a.media(p.Media[0]); err == nil {
			var edl EDL
			if json.Unmarshal(m.Project, &edl) == nil {
				if d := edlDuration(edl); d > 0 {
					in.Duration = d
				}
			}
		}
	}
	completion := math.Min(1, in.Seconds/in.Duration)
	skipped := in.Seconds < 2
	tx, e := a.H.DB.Begin()
	if e != nil {
		a.fail(w, e)
		return
	}
	defer tx.Rollback()
	res, e := tx.Exec("INSERT OR IGNORE INTO watch_events VALUES(?,?,?)", uid(r), in.Event, a.now().Unix())
	if e != nil {
		a.fail(w, e)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		apphost.JSON(w, 200, map[string]bool{"ok": true})
		return
	}
	_, e = tx.Exec(`INSERT INTO watch_signals VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,post_id) DO UPDATE SET seconds=max(seconds,excluded.seconds),completion=max(completion,excluded.completion),skipped=excluded.skipped,hidden=max(hidden,excluded.hidden),updated=excluded.updated`, uid(r), p.ID, in.Seconds, completion, skipped, in.Hidden, a.now().Unix())
	if e != nil {
		a.fail(w, e)
		return
	}
	weight := completion * 0.5
	if skipped {
		weight = -0.25
	}
	if in.Hidden {
		weight = -2
	}
	for _, tag := range tags(p.Caption) {
		if _, e = tx.Exec(`INSERT INTO interests VALUES(?,?,?) ON CONFLICT(user_id,tag) DO UPDATE SET weight=max(-5,min(12,weight+excluded.weight))`, uid(r), tag, weight); e != nil {
			a.fail(w, e)
			return
		}
	}
	// Bound idempotency history; explicit reset clears all personalization.
	tx.Exec("DELETE FROM watch_events WHERE created<?", a.now().Unix()-30*86400)
	if e = tx.Commit(); e != nil {
		a.fail(w, e)
		return
	}
	apphost.JSON(w, 200, map[string]bool{"ok": true})
}

func (a *App) resetFeed(w http.ResponseWriter, r *http.Request) {
	tx, e := a.H.DB.Begin()
	if e != nil {
		a.fail(w, e)
		return
	}
	defer tx.Rollback()
	for _, table := range []string{"watch_signals", "watch_events", "interests"} {
		if _, e = tx.Exec("DELETE FROM "+table+" WHERE user_id=?", uid(r)); e != nil {
			a.fail(w, e)
			return
		}
	}
	if e = tx.Commit(); e != nil {
		a.fail(w, e)
		return
	}
	apphost.JSON(w, 200, map[string]bool{"ok": true})
}

func (a *App) clipOptions(w http.ResponseWriter, r *http.Request) {
	p, e := a.post(r.PathValue("id"))
	if e != nil || !a.visible(uid(r), p) {
		http.NotFound(w, r)
		return
	}
	if r.Method == "GET" {
		var comments, remix, downloads bool
		comments = true
		a.H.DB.QueryRow("SELECT comments,remix,downloads FROM clip_options WHERE post_id=?", p.ID).Scan(&comments, &remix, &downloads)
		apphost.JSON(w, 200, map[string]bool{"comments": comments, "remix": remix, "downloads": downloads})
		return
	}
	if p.Owner != uid(r) {
		http.NotFound(w, r)
		return
	}
	var in struct{ Comments, Remix, Downloads bool }
	if !apphost.Decode(w, r, &in) {
		return
	}
	_, e = a.H.DB.Exec("INSERT INTO clip_options VALUES(?,?,?,?) ON CONFLICT(post_id) DO UPDATE SET comments=excluded.comments,remix=excluded.remix,downloads=excluded.downloads", p.ID, in.Comments, in.Remix, in.Downloads)
	if e != nil {
		a.fail(w, e)
		return
	}
	apphost.JSON(w, 200, map[string]bool{"ok": true})
}

func (a *App) messages(w http.ResponseWriter, r *http.Request) {
	other := r.URL.Query().Get("with")
	if other != "" && a.blocked(uid(r), other) {
		http.NotFound(w, r)
		return
	}
	rows, e := a.H.DB.Query("SELECT id,sender,recipient,body,post_id,created,seen FROM messages WHERE (sender=? OR recipient=?) AND (?='' OR sender=? OR recipient=?) ORDER BY created DESC LIMIT 100", uid(r), uid(r), other, other, other)
	if e != nil {
		a.fail(w, e)
		return
	}
	out := []map[string]any{}
	for rows.Next() {
		var id, sender, to, body, post string
		var at int64
		var seen bool
		if rows.Scan(&id, &sender, &to, &body, &post, &at, &seen) == nil {
			out = append(out, map[string]any{"id": id, "sender": sender, "recipient": to, "body": body, "post": post, "created": at, "seen": seen})
		}
	}
	rows.Close()
	visible := []map[string]any{}
	for _, m := range out {
		sender := m["sender"].(string)
		to := m["recipient"].(string)
		if a.blocked(uid(r), sender) || a.blocked(uid(r), to) {
			continue
		}
		if post := m["post"].(string); post != "" {
			p, e := a.post(post)
			if e != nil || !a.visible(uid(r), p) {
				m["post"] = ""
				m["body"] = "Shared clip is unavailable"
			}
		}
		m["profile"] = a.getProfile(sender)
		visible = append(visible, m)
	}
	if other != "" {
		a.H.DB.Exec("UPDATE messages SET seen=1 WHERE sender=? AND recipient=?", other, uid(r))
	}
	apphost.JSON(w, 200, visible)
}
func (a *App) sendMessage(w http.ResponseWriter, r *http.Request) {
	var in struct{ To, Body, Post, RequestKey string }
	if !apphost.Decode(w, r, &in) {
		return
	}
	in.Body = strings.TrimSpace(in.Body)
	if len(in.Body) > 2000 || (in.Body == "" && in.Post == "") || len(in.RequestKey) < 8 || len(in.RequestKey) > 100 {
		apphost.Problem(w, 400, "Write a message up to 2,000 characters")
		return
	}
	if in.To == uid(r) || a.blocked(uid(r), in.To) || !a.exists("SELECT count(*) FROM relations WHERE actor=? AND target=? AND kind='follow' AND state='accepted'", in.To, uid(r)) || !a.exists("SELECT count(*) FROM relations WHERE actor=? AND target=? AND kind='follow' AND state='accepted'", uid(r), in.To) {
		apphost.Problem(w, 403, "Messages are available between mutual followers")
		return
	}
	if in.Post != "" {
		p, e := a.post(in.Post)
		if e != nil || !a.visible(uid(r), p) || !a.visible(in.To, p) {
			http.NotFound(w, r)
			return
		}
	}
	id := apphost.ID()
	_, e := a.H.DB.Exec("INSERT OR IGNORE INTO messages VALUES(?,?,?,?,?,?,0,?)", id, uid(r), in.To, in.Body, in.Post, a.now().Unix(), in.RequestKey)
	if e != nil {
		a.fail(w, e)
		return
	}
	// Fetch canonical ID so retries do not create duplicate notifications.
	a.H.DB.QueryRow("SELECT id FROM messages WHERE sender=? AND request_key=?", uid(r), in.RequestKey).Scan(&id)
	a.notify(in.To, uid(r), "message", id)
	apphost.JSON(w, 201, map[string]string{"id": id})
}
