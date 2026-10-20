package clips

import (
	"encoding/json"
	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
	"testing"
)

func TestPersonalizationPrivacyResetAndReplay(t *testing.T) {
	f := setup(t)
	m := f.upload(t, "alice")
	public := f.publish(t, "alice", "public", "post", []string{m.ID}, apphost.ID(), 0)
	private := f.publish(t, "alice", "private", "post", []string{m.ID}, apphost.ID(), 0)
	f.a.H.DB.Exec("UPDATE posts SET kind='reel',caption='#nature test' WHERE id IN (?,?)", public.ID, private.ID)
	w := f.call("GET", "/api/discover", "bob", nil)
	var posts []rankedPost
	json.Unmarshal(w.Body.Bytes(), &posts)
	if w.Code != 200 || len(posts) != 1 || posts[0].ID != public.ID {
		t.Fatal("private clip in discovery", w.Code, w.Body.String())
	}
	signal := map[string]any{"event": "test-watch-1", "seconds": 8, "duration": 10}
	for i := 0; i < 2; i++ {
		if w = f.call("POST", "/api/posts/"+public.ID+"/signal", "bob", signal); w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	var weight float64
	f.a.H.DB.QueryRow("SELECT weight FROM interests WHERE user_id=? AND tag='#nature'", f.users["bob"]).Scan(&weight)
	if weight != .4 {
		t.Fatal("duplicate watch changed recommendation", weight)
	}
	w = f.call("POST", "/api/posts/"+private.ID+"/signal", "bob", signal)
	if w.Code != 404 {
		t.Fatal("private signal accepted", w.Code)
	}
	f.call("POST", "/api/posts/"+public.ID+"/signal", "bob", map[string]any{"event": "test-hidden-1", "seconds": 0, "duration": 10, "hidden": true})
	w = f.call("GET", "/api/discover", "bob", nil)
	json.Unmarshal(w.Body.Bytes(), &posts)
	if len(posts) != 0 {
		t.Fatal("not interested ignored")
	}
	f.call("POST", "/api/feed/reset", "bob", map[string]any{})
	w = f.call("GET", "/api/discover", "bob", nil)
	json.Unmarshal(w.Body.Bytes(), &posts)
	if len(posts) != 1 {
		t.Fatal("feed reset failed")
	}
}

func TestLiveMembershipAndMutualMessageBoundary(t *testing.T) {
	f := setup(t)
	w := f.call("POST", "/api/live", "alice", map[string]any{"title": "Synthetic live"})
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var room map[string]string
	json.Unmarshal(w.Body.Bytes(), &room)
	id := room["id"]
	w = f.call("POST", "/api/live/"+id+"/signals", "bob", map[string]any{"to": f.users["alice"], "body": map[string]string{"test": "hello"}})
	if w.Code != 404 {
		t.Fatal("nonmember signaling")
	}
	if w = f.call("POST", "/api/live/"+id+"/join", "bob", map[string]any{}); w.Code != 200 {
		t.Fatal(w.Code)
	}
	w = f.call("POST", "/api/live/"+id+"/signals", "bob", map[string]any{"to": f.users["alice"], "body": map[string]string{"test": "hello"}})
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = f.call("GET", "/api/live/"+id+"/signals", "alice", nil); w.Code != 200 {
		t.Fatal(w.Code)
	}
	var heartbeat struct{ Peers []string }
	w = f.call("POST", "/api/live/"+id+"/heartbeat", "alice", map[string]any{})
	json.Unmarshal(w.Body.Bytes(), &heartbeat)
	if len(heartbeat.Peers) != 1 {
		t.Fatal("live peer missing from broadcaster heartbeat")
	}
	f.call("POST", "/api/profiles/"+f.users["bob"]+"/relations", "alice", map[string]any{"kind": "block", "enabled": true})
	w = f.call("POST", "/api/live/"+id+"/heartbeat", "alice", map[string]any{})
	json.Unmarshal(w.Body.Bytes(), &heartbeat)
	if len(heartbeat.Peers) != 0 {
		t.Fatal("blocked viewer remains authorized for live media")
	}
	if w = f.call("POST", "/api/live/"+id+"/heartbeat", "bob", map[string]any{}); w.Code != 404 {
		t.Fatal("blocked live heartbeat accepted")
	}
	f.call("POST", "/api/profiles/"+f.users["bob"]+"/relations", "alice", map[string]any{"kind": "block", "enabled": false})
	f.call("POST", "/api/live/"+id+"/end", "alice", map[string]any{})
	if w = f.call("GET", "/api/live/"+id+"/signals", "bob", nil); w.Code != 404 {
		t.Fatal("ended live signaling")
	}
	message := map[string]any{"to": f.users["bob"], "body": "Hello", "requestKey": "message-unique"}
	if w = f.call("POST", "/api/messages", "alice", message); w.Code != 403 {
		t.Fatal("stranger message allowed")
	}
	for _, pair := range [][2]string{{"alice", "bob"}, {"bob", "alice"}} {
		f.call("POST", "/api/profiles/"+f.users[pair[1]]+"/relations", pair[0], map[string]any{"kind": "follow", "enabled": true})
	}
	for i := 0; i < 2; i++ {
		if w = f.call("POST", "/api/messages", "alice", message); w.Code != 201 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	var count int
	f.a.H.DB.QueryRow("SELECT count(*) FROM messages").Scan(&count)
	if count != 1 {
		t.Fatal("message retry duplicated")
	}
	f.call("POST", "/api/profiles/"+f.users["alice"]+"/relations", "bob", map[string]any{"kind": "block", "enabled": true})
	if w = f.call("POST", "/api/messages", "alice", message); w.Code != 403 {
		t.Fatal("blocked message allowed")
	}
}

func TestRemixRevocation(t *testing.T) {
	f := setup(t)
	source := f.upload(t, "alice")
	p := f.publish(t, "alice", "public", "post", []string{source.ID}, apphost.ID(), 0)
	f.call("PUT", "/api/posts/"+p.ID+"/options", "alice", map[string]bool{"remix": true, "comments": true})
	m := f.upload(t, "bob")
	f.a.H.DB.Exec("UPDATE media SET project=? WHERE id=?", encode(EDL{Remix: p.ID}), m.ID)
	remix := f.publish(t, "bob", "public", "post", []string{m.ID}, apphost.ID(), 0)
	if !f.a.visible(f.users["alice"], remix) {
		t.Fatal("enabled remix invisible")
	}
	f.call("PUT", "/api/posts/"+p.ID+"/options", "alice", map[string]bool{"remix": false, "comments": true})
	if f.a.visible(f.users["bob"], remix) {
		t.Fatal("revoked source still visible")
	}
	if w := f.call("GET", "/api/media/"+m.ID, "bob", nil); w.Code != 404 {
		t.Fatal("revoked derivative remains accessible", w.Code)
	}
}
