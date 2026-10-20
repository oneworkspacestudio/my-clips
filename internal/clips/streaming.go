package clips

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
)

var streamName = regexp.MustCompile(`^(master\.m3u8|[0-2]\.m3u8|[0-2]-[0-9]{5}\.ts|poster\.jpg|video\.mp4)$`)

func (a *App) makeStreams(ctx context.Context, dir, job string) error {
	master := "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-INDEPENDENT-SEGMENTS\n"
	for i, tier := range []struct{ w, h, video, max, buf, audio int }{{360, 640, 450, 650, 1300, 96}, {540, 960, 1000, 1400, 2800, 96}, {720, 1280, 2200, 2800, 5600, 128}} {
		name := fmt.Sprintf("%d.m3u8", i)
		args := []string{"-protocol_whitelist", "file,pipe", "-threads", "2", "-i", "video.mp4", "-map", "0:v", "-map", "0:a?", "-vf", fmt.Sprintf("scale=%d:%d", tier.w, tier.h), "-c:v", "libx264", "-preset", "veryfast", "-b:v", fmt.Sprint(tier.video) + "k", "-maxrate", fmt.Sprint(tier.max) + "k", "-bufsize", fmt.Sprint(tier.buf) + "k", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-threads", "2", "-c:a", "aac", "-b:a", fmt.Sprint(tier.audio) + "k", "-hls_time", "2", "-hls_playlist_type", "vod", "-hls_flags", "independent_segments", "-hls_segment_filename", fmt.Sprintf("%d-%%05d.ts", i), "-map_metadata", "-1", name}
		if e := a.ffmpeg(ctx, dir, args...); e != nil {
			return e
		}
		peak, avg, e := variantBandwidth(filepath.Join(dir, name))
		if e != nil {
			return e
		}
		master += fmt.Sprintf("#EXT-X-STREAM-INF:BANDWIDTH=%d,AVERAGE-BANDWIDTH=%d,RESOLUTION=%dx%d\n%s\n", peak, avg, tier.w, tier.h, name)
		a.H.DB.Exec("UPDATE jobs SET progress=? WHERE id=?", 60+i*15, job)
	}
	if e := a.ffmpeg(ctx, dir, "-protocol_whitelist", "file,pipe", "-i", "video.mp4", "-frames:v", "1", "-vf", "scale=360:640", "-update", "1", "poster.jpg"); e != nil {
		return e
	}
	tmp := filepath.Join(dir, "master.pending")
	if e := os.WriteFile(tmp, []byte(master), 0600); e != nil {
		return e
	}
	return os.Rename(tmp, filepath.Join(dir, "master.m3u8"))
}

// Adapted from My Tube: advertise measured segment bandwidth including muxing.
func variantBandwidth(file string) (int64, int64, error) {
	f, e := os.Open(file)
	if e != nil {
		return 0, 0, e
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	var seconds, totalSeconds, peak float64
	var total int64
	count := 0
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "#EXTINF:") {
			seconds, e = strconv.ParseFloat(strings.Split(strings.TrimPrefix(line, "#EXTINF:"), ",")[0], 64)
			if e != nil || seconds <= 0 || !finite(seconds) {
				return 0, 0, errors.New("invalid segment duration")
			}
			continue
		}
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if seconds <= 0 || !streamName.MatchString(line) || !strings.HasSuffix(line, ".ts") {
			return 0, 0, errors.New("invalid segment")
		}
		info, e := os.Stat(filepath.Join(filepath.Dir(file), line))
		if e != nil || !info.Mode().IsRegular() {
			return 0, 0, errors.New("missing segment")
		}
		total += info.Size()
		totalSeconds += seconds
		peak = math.Max(peak, float64(info.Size())*8/seconds)
		seconds = 0
		count++
	}
	if scanner.Err() != nil || count == 0 {
		return 0, 0, errors.New("empty playlist")
	}
	return int64(math.Ceil(peak * 1.15)), int64(math.Ceil(float64(total) * 8 / totalSeconds)), nil
}
func (a *App) streamFile(w http.ResponseWriter, r *http.Request) {
	id, name := r.PathValue("id"), r.PathValue("file")
	if !validID(id) || !streamName.MatchString(name) {
		http.NotFound(w, r)
		return
	}
	m, e := a.media(id)
	if e != nil || m.State != "ready" || !strings.HasPrefix(m.MIME, "video/") || !a.remixSourcesVisible(uid(r), m, 0) || (m.Owner != uid(r) && !a.canSeeMedia(uid(r), id)) {
		http.NotFound(w, r)
		return
	}
	if a.storageCheck(r.Context()) != nil {
		apphost.Problem(w, 503, "Protected video storage is unavailable")
		return
	}
	root, e := os.OpenRoot(a.Root)
	if e != nil {
		a.fail(w, e)
		return
	}
	defer root.Close()
	f, e := root.Open(filepath.Join("generated", "streams", m.Owner, id, name))
	if e != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, e := f.Stat()
	if e != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	// Authorization is re-evaluated on every playlist/segment/range request.
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Content-Type", map[string]string{".m3u8": "application/vnd.apple.mpegurl", ".ts": "video/mp2t", ".jpg": "image/jpeg", ".mp4": "video/mp4"}[filepath.Ext(name)])
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, name, info.ModTime(), f)
}
