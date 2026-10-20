package clips

import (
	"path/filepath"
	"testing"

	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
)

func TestReopenMigratedDatabasePreservesAccounts(t *testing.T) {
	root := t.TempDir()
	t.Setenv("MYCLIPS_PHOTOS_ROOT", filepath.Join(root, "media"))
	t.Setenv("MYCLIPS_STANDALONE_STORAGE", "isolated")
	config := apphost.Config{ID: "clips", Name: "My Clips", Version: "test", Data: filepath.Join(root, "Private"), Listen: "127.0.0.1:29113", Origin: "http://localhost:29113"}
	for attempt := 0; attempt < 3; attempt++ {
		h, err := apphost.New(config, nil)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = New(h); err != nil {
			h.Close()
			t.Fatalf("startup %d: %v", attempt+1, err)
		}
		if attempt == 0 {
			_, err = h.DB.Exec("INSERT INTO host_users(id,issuer,subject,name,email,role) VALUES(?,?,?,?,?,?)", "synthetic", "local:clips", "synthetic", "Restart account", "restart@example.test", "owner")
			if err != nil {
				h.Close()
				t.Fatal(err)
			}
		}
		var count, version int
		err = h.DB.QueryRow("SELECT count(*) FROM host_users WHERE id='synthetic'").Scan(&count)
		if err == nil {
			err = h.DB.QueryRow("SELECT max(version) FROM host_migrations").Scan(&version)
		}
		h.Close()
		if err != nil || count != 1 || version != 3 {
			t.Fatalf("reopened account/schema changed: count=%d version=%d error=%v", count, version, err)
		}
	}
}

func TestFutureDatabaseStillRefusesDowngrade(t *testing.T) {
	root := t.TempDir()
	t.Setenv("MYCLIPS_PHOTOS_ROOT", filepath.Join(root, "media"))
	t.Setenv("MYCLIPS_STANDALONE_STORAGE", "isolated")
	h, err := apphost.New(apphost.Config{ID: "clips", Name: "My Clips", Version: "test", Data: filepath.Join(root, "Private"), Listen: "127.0.0.1:29113", Origin: "http://localhost:29113"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer h.Close()
	if _, err = New(h); err != nil {
		t.Fatal(err)
	}
	if err = h.Migrate(4, "CREATE TABLE future_data(value TEXT); INSERT INTO future_data VALUES('preserve');"); err != nil {
		t.Fatal(err)
	}
	if err = migrate(h); err == nil {
		t.Fatal("future schema accepted by older executable")
	}
	var value string
	if err = h.DB.QueryRow("SELECT value FROM future_data").Scan(&value); err != nil || value != "preserve" {
		t.Fatal("future data changed", err)
	}
}
