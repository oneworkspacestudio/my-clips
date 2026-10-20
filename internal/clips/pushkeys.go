package clips

import (
	"encoding/json"
	"os"
	"path/filepath"

	webpush "github.com/SherClockHolmes/webpush-go"
)

func (a *App) preparePush() error {
	if os.Getenv("MYCLIPS_VAPID_PRIVATE") != "" && os.Getenv("MYCLIPS_VAPID_PUBLIC") != "" {
		a.VAPIDPrivate = os.Getenv("MYCLIPS_VAPID_PRIVATE")
		a.VAPIDPublic = os.Getenv("MYCLIPS_VAPID_PUBLIC")
		return nil
	}
	file := filepath.Join(a.H.Config.Data, "push-keys.json")
	var keys struct{ Private, Public string }
	b, e := os.ReadFile(file)
	if e == nil {
		if e = json.Unmarshal(b, &keys); e != nil {
			return e
		}
	} else if os.IsNotExist(e) {
		keys.Private, keys.Public, e = webpush.GenerateVAPIDKeys()
		if e != nil {
			return e
		}
		b, _ = json.Marshal(keys)
		if e = os.WriteFile(file, b, 0600); e != nil {
			return e
		}
	} else {
		return e
	}
	a.VAPIDPrivate, a.VAPIDPublic = keys.Private, keys.Public
	return nil
}
