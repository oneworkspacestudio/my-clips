package main

import (
	"fmt"
	"github.com/oneworkspacestudio/my-clips/internal/clips"
	"github.com/oneworkspacestudio/my-clips/internal/webui"
	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
	"os"
)

var version = "0.1.0-preview.1"

func main() {
	if e := apphost.Main(apphost.Config{ID: "clips", Name: "My Clips", Version: version, Listen: "127.0.0.1:9014", MediaCapture: true}, webui.Files(), func(h *apphost.Host) (apphost.Application, error) { return clips.New(h) }); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
