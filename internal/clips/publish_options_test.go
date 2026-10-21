package clips

import (
	"encoding/json"
	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
	"testing"
)

func TestPublishPrivacyIsAtomicAndRetryDoesNotResetIt(t *testing.T) {
	f := setup(t)
	m := f.upload(t, "alice")
	in := map[string]any{"kind": "post", "caption": "Synthetic private options", "visibility": "public", "media": []string{m.ID}, "requestKey": apphost.ID(), "comments": false, "remix": true}
	// A failure saving privacy must roll back publication as well.
	if _, e := f.a.H.DB.Exec("CREATE TRIGGER reject_options BEFORE INSERT ON clip_options BEGIN SELECT RAISE(ABORT,'synthetic failure'); END"); e != nil {
		t.Fatal(e)
	}
	if w := f.call("POST", "/api/posts", "alice", in); w.Code != 503 {
		t.Fatal(w.Code, w.Body.String())
	}
	var n int
	f.a.H.DB.QueryRow("SELECT count(*) FROM posts").Scan(&n)
	if n != 0 {
		t.Fatal("post became visible before its privacy options")
	}
	f.a.H.DB.Exec("DROP TRIGGER reject_options")
	w := f.call("POST", "/api/posts", "alice", in)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var post Post
	json.Unmarshal(w.Body.Bytes(), &post)
	if w = f.call("POST", "/api/posts/"+post.ID+"/comments", "bob", map[string]string{"body": "Must be rejected"}); w.Code != 403 {
		t.Fatal("comments were not disabled", w.Code, w.Body.String())
	}
	in["comments"] = true
	if w = f.call("POST", "/api/posts", "alice", in); w.Code != 200 {
		t.Fatal("retry failed", w.Code)
	}
	var comments, remix bool
	f.a.H.DB.QueryRow("SELECT comments,remix FROM clip_options WHERE post_id=?", post.ID).Scan(&comments, &remix)
	if comments || !remix {
		t.Fatal("retry reset privacy options")
	}
	f.a.H.DB.QueryRow("SELECT count(*) FROM posts").Scan(&n)
	if n != 1 {
		t.Fatal("retry duplicated post")
	}
}
