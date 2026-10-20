package clips

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/oneworkspacestudio/one-workspace/pkg/apphost"
)

type Clip struct {
	Media  string  `json:"media"`
	Start  float64 `json:"start"`
	End    float64 `json:"end"`
	Speed  float64 `json:"speed"`
	Filter string  `json:"filter,omitempty"`
	Flip   bool    `json:"flip,omitempty"`
}
type TextOverlay struct {
	Text  string  `json:"text"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Size  int     `json:"size"`
}
type EDL struct {
	Clips          []Clip        `json:"clips"`
	Mute           bool          `json:"mute"`
	Quality        string        `json:"quality"`
	Sound          string        `json:"sound,omitempty"`
	SoundStart     float64       `json:"soundStart"`
	SoundVolume    float64       `json:"soundVolume"`
	OriginalVolume float64       `json:"originalVolume"`
	Voice          string        `json:"voice,omitempty"`
	VoiceVolume    float64       `json:"voiceVolume"`
	Text           []TextOverlay `json:"text,omitempty"`
	Remix          string        `json:"remix,omitempty"`
	RemixMode      string        `json:"remixMode,omitempty"`
}

var filterGraph = map[string]string{
	"": "", "none": "", "vivid": ",eq=saturation=1.35:contrast=1.08",
	"warm":    ",colorbalance=rs=.10:bs=-.08",
	"cool":    ",colorbalance=rs=-.07:bs=.10",
	"mono":    ",hue=s=0",
	"vintage": ",eq=saturation=.65:contrast=.92:brightness=.03,colorbalance=rs=.06",
	"glow":    ",split[clean][soft];[soft]gblur=sigma=9[blur];[clean][blur]blend=all_mode=screen:all_opacity=.18",
}

func number(f float64) string { return strconv.FormatFloat(f, 'f', 3, 64) }
func finite(v float64) bool   { return !math.IsNaN(v) && !math.IsInf(v, 0) }
func edlDuration(edl EDL) float64 {
	d := 0.0
	for _, c := range edl.Clips {
		if c.Speed > 0 {
			d += (c.End - c.Start) / c.Speed
		}
	}
	return d
}
func (a *App) createJob(w http.ResponseWriter, r *http.Request) {
	var edl EDL
	if !apphost.Decode(w, r, &edl) {
		return
	}
	if a.ffmpegPath() == "" || a.ffprobePath() == "" {
		apphost.Problem(w, 503, "Configure FFmpeg and FFprobe before rendering")
		return
	}
	if a.storageCheck(r.Context()) != nil {
		apphost.Problem(w, 503, "Protected Drive storage is unavailable")
		return
	}
	if len(edl.Clips) < 1 || len(edl.Clips) > 10 {
		apphost.Problem(w, 400, "Choose 1–10 clips")
		return
	}
	for _, c := range edl.Clips {
		m, e := a.media(c.Media)
		_, filterOK := filterGraph[c.Filter]
		if e != nil || m.Owner != uid(r) || !strings.HasPrefix(m.MIME, "video/") || !finite(c.Start) || !finite(c.End) || !finite(c.Speed) || c.Start < 0 || c.End <= c.Start || c.End > 600 || c.Speed < .5 || c.Speed > 2 || !filterOK {
			apphost.Problem(w, 400, "Choose your own clips, valid trim times, filters and speeds 0.5–2")
			return
		}
	}
	duration := edlDuration(edl)
	if duration > 180 {
		apphost.Problem(w, 400, "Keep the final video within 3 minutes")
		return
	}
	for _, v := range []float64{edl.SoundStart, edl.SoundVolume, edl.OriginalVolume, edl.VoiceVolume} {
		if !finite(v) || v < 0 || v > 600 {
			apphost.Problem(w, 400, "Invalid sound settings")
			return
		}
	}
	if edl.SoundVolume > 1 || edl.OriginalVolume > 1 || edl.VoiceVolume > 1 || len(edl.Text) > 20 {
		apphost.Problem(w, 400, "Use volume 0–1 and at most 20 text overlays")
		return
	}
	for _, t := range edl.Text {
		if len(t.Text) > 300 || t.Start < 0 || t.End <= t.Start || t.End > duration || t.X < 0 || t.X > 1 || t.Y < 0 || t.Y > 1 || t.Size < 16 || t.Size > 72 {
			apphost.Problem(w, 400, "Check text, size, position and timing")
			return
		}
	}
	for _, sound := range []string{edl.Sound, edl.Voice} {
		if sound != "" {
			if _, e := a.soundPath(uid(r), sound); e != nil {
				http.NotFound(w, r)
				return
			}
		}
	}
	if edl.Remix != "" {
		p, e := a.post(edl.Remix)
		if e != nil || !a.remixAllowed(uid(r), p) || (edl.RemixMode != "duet" && edl.RemixMode != "stitch") {
			apphost.Problem(w, 403, "The creator has not enabled remixing for this clip")
			return
		}
	}
	if a.exists("SELECT count(*) FROM jobs WHERE owner=? AND state IN ('queued','running') HAVING count(*)>=3", uid(r)) {
		apphost.Problem(w, 429, "Wait for your current renders to finish")
		return
	}
	id, output := apphost.ID(), apphost.ID()
	if _, e := a.H.DB.Exec("INSERT INTO jobs VALUES(?,?,?,?,'queued',0,'',?)", id, uid(r), output, encode(edl), a.now().Unix()); e != nil {
		a.fail(w, e)
		return
	}
	apphost.JSON(w, 202, map[string]string{"id": id, "media": output})
}
func (a *App) remixAllowed(user string, p Post) bool {
	return p.State == "published" && p.Visibility == "public" && a.visible(user, p) && !a.getProfile(p.Owner).Private && a.exists("SELECT count(*) FROM clip_options WHERE post_id=? AND remix=1", p.ID)
}

type videoInfo struct {
	Duration      float64
	Width, Height int
	Audio         bool
}

func (a *App) probe(ctx context.Context, file string) (videoInfo, error) {
	c, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(c, a.ffprobePath(), "-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", file)
	b, e := cmd.Output()
	if e != nil || len(b) > 65536 {
		return videoInfo{}, errors.New("cannot probe media")
	}
	var p struct {
		Format  struct{ Duration string }
		Streams []struct {
			Codec_type    string
			Width, Height int
		}
	}
	if json.Unmarshal(b, &p) != nil {
		return videoInfo{}, errors.New("invalid media probe")
	}
	info := videoInfo{}
	info.Duration, _ = strconv.ParseFloat(p.Format.Duration, 64)
	for _, s := range p.Streams {
		if s.Codec_type == "video" {
			info.Width = s.Width
			info.Height = s.Height
		}
		if s.Codec_type == "audio" {
			info.Audio = true
		}
	}
	if !finite(info.Duration) || info.Duration <= 0 || info.Duration > 601 || int64(info.Width)*int64(info.Height) > 33177600 {
		return info, errors.New("media duration or dimensions exceed limits")
	}
	return info, nil
}
func (a *App) ffmpeg(ctx context.Context, dir string, args ...string) error {
	c, cancel := context.WithTimeout(ctx, 12*time.Minute)
	defer cancel()
	base := []string{"-nostdin", "-hide_banner", "-loglevel", "error", "-max_alloc", "134217728", "-y"}
	cmd := exec.CommandContext(c, a.ffmpegPath(), append(base, args...)...)
	cmd.Dir = dir
	cmd.Stdout = io.Discard
	var diagnostic cappedDiagnostic
	cmd.Stderr = &diagnostic
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("media encoder: %w: %s", err, diagnostic.String())
	}
	return nil
}

type cappedDiagnostic struct{ bytes.Buffer }

func (b *cappedDiagnostic) Write(p []byte) (int, error) {
	n := len(p)
	if left := 8192 - b.Len(); left > 0 {
		b.Buffer.Write(p[:min(n, left)])
	}
	return n, nil
}
func (a *App) render(ctx context.Context, job, owner, id string, edl EDL) error {
	if !validID(id) || len(edl.Clips) == 0 {
		return errors.New("invalid render")
	}
	dir := filepath.Join(a.Root, "generated", "streams", owner, id)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	if !withinRoot(a.Root, dir) {
		return errors.New("unsafe render directory")
	}
	root, e := os.OpenRoot(dir)
	if e != nil {
		return e
	}
	defer root.Close()
	// Retry removes only this job's known intermediate names; originals remain.
	root.Remove("master.m3u8")
	args := []string{}
	filters := []string{}
	concat := ""
	total := edlDuration(edl)
	for i, c := range edl.Clips {
		m, e := a.media(c.Media)
		if e != nil || m.Owner != owner {
			return errors.New("media unavailable")
		}
		source := filepath.Join(a.Root, filepath.FromSlash(m.Original))
		if !withinRoot(a.Root, source) {
			return errors.New("unsafe source")
		}
		info, e := a.probe(ctx, source)
		if e != nil || c.End > info.Duration+.15 || info.Width == 0 {
			return errors.New("trim beyond clip")
		}
		args = append(args, "-protocol_whitelist", "file,pipe", "-threads", "2", "-ss", number(c.Start), "-t", number(c.End-c.Start), "-i", source)
		vf := fmt.Sprintf("[%d:v]setpts=(PTS-STARTPTS)/%s,scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30", i, number(c.Speed))
		if c.Flip {
			vf += ",hflip"
		}
		if c.Filter == "glow" {
			vf += ",gblur=sigma=.6,eq=brightness=.04:saturation=1.12"
		} else {
			vf += filterGraph[c.Filter]
		}
		filters = append(filters, vf+fmt.Sprintf("[v%d]", i))
		if info.Audio {
			filters = append(filters, fmt.Sprintf("[%d:a]atempo=%s,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=%s,asetpts=PTS-STARTPTS[a%d]", i, number(c.Speed), number((c.End-c.Start)/c.Speed), i))
		} else {
			filters = append(filters, fmt.Sprintf("anullsrc=r=48000:cl=stereo,atrim=duration=%s[a%d]", number((c.End-c.Start)/c.Speed), i))
		}
		concat += fmt.Sprintf("[v%d][a%d]", i, i)
	}
	filters = append(filters, concat+fmt.Sprintf("concat=n=%d:v=1:a=1[basev][basea]", len(edl.Clips)))
	video := "basev"
	audio := "basea"
	next := len(edl.Clips)
	if edl.Remix != "" {
		p, e := a.post(edl.Remix)
		if e != nil || !a.remixAllowed(owner, p) || len(p.Media) != 1 {
			return errors.New("remix permission changed")
		}
		m, e := a.media(p.Media[0])
		if e != nil {
			return e
		}
		source := filepath.Join(a.Root, filepath.FromSlash(m.Rendered))
		if !withinRoot(a.Root, source) {
			return errors.New("unsafe remix")
		}
		args = append(args, "-protocol_whitelist", "file,pipe", "-threads", "2", "-i", source)
		if edl.RemixMode == "duet" {
			filters = append(filters, fmt.Sprintf("[%d:v]scale=360:1280:force_original_aspect_ratio=decrease,pad=360:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=180,trim=duration=%s,setpts=PTS-STARTPTS[remix]", next, number(total)), "[basev]scale=360:1280:force_original_aspect_ratio=decrease,pad=360:1280:(ow-iw)/2:(oh-ih)/2[own]", "[remix][own]hstack=inputs=2[remixed]")
		} else {
			info, e := a.probe(ctx, source)
			if e != nil {
				return e
			}
			d := math.Min(5, info.Duration)
			filters = append(filters, fmt.Sprintf("[%d:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,trim=duration=%s,setpts=PTS-STARTPTS[remix]", next, number(d)), "[remix][basev]concat=n=2:v=1:a=0[remixed]")
			filters = append(filters, fmt.Sprintf("[basea]adelay=%d|%d[delayed]", int(d*1000), int(d*1000)))
			audio = "delayed"
			total += d
		}
		video = "remixed"
		next++
	}
	volume := edl.OriginalVolume
	if edl.Mute {
		volume = 0
	}
	filters = append(filters, fmt.Sprintf("[%s]volume=%s[original]", audio, number(volume)))
	mix := "[original]"
	mixCount := 1
	for i, sound := range []string{edl.Sound, edl.Voice} {
		if sound == "" {
			continue
		}
		p, e := a.soundPath(owner, sound)
		if e != nil {
			return e
		}
		start, gain := edl.SoundStart, edl.SoundVolume
		if i == 1 {
			start = 0
			gain = edl.VoiceVolume
		}
		args = append(args, "-protocol_whitelist", "file,pipe", "-stream_loop", "-1", "-ss", number(start), "-t", number(total), "-i", p)
		filters = append(filters, fmt.Sprintf("[%d:a]aresample=48000,volume=%s,afade=t=out:st=%s:d=0.5[sound%d]", next, number(gain), number(math.Max(0, total-.5)), i))
		mix += fmt.Sprintf("[sound%d]", i)
		mixCount++
		next++
	}
	filters = append(filters, mix+fmt.Sprintf("amix=inputs=%d:duration=first:normalize=0,alimiter=limit=.95[outa]", mixCount))
	for i, t := range edl.Text {
		name := fmt.Sprintf("text-%02d.txt", i)
		if e = os.WriteFile(filepath.Join(dir, name), []byte(t.Text), 0600); e != nil {
			return e
		}
		out := fmt.Sprintf("text%d", i)
		filters = append(filters, fmt.Sprintf("[%s]drawtext=textfile=%s:expansion=none:fontcolor=white:fontsize=%d:box=1:boxcolor=black@0.45:boxborderw=10:x=(w-tw)*%s:y=(h-th)*%s:enable='between(t,%s,%s)'[%s]", video, name, t.Size, number(t.X), number(t.Y), number(t.Start), number(t.End), out))
		video = out
	}
	args = append(args, "-filter_complex_threads", "1", "-filter_complex", strings.Join(filters, ";"), "-map", "["+video+"]", "-map", "[outa]", "-c:v", "libx264", "-preset", "veryfast", "-b:v", "2200k", "-maxrate", "2800k", "-bufsize", "5600k", "-pix_fmt", "yuv420p", "-r", "30", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-threads", "2", "-t", number(total), "-map_metadata", "-1", "video.mp4")
	if e = a.ffmpeg(ctx, dir, args...); e != nil {
		return e
	}
	info, e := root.Stat("video.mp4")
	if e != nil || info.Size() == 0 || info.Size() > 160<<20 {
		return errors.New("invalid output")
	}
	a.H.DB.Exec("UPDATE jobs SET progress=45 WHERE id=?", job)
	if e = a.makeStreams(ctx, dir, job); e != nil {
		return e
	}
	first, _ := a.media(edl.Clips[0].Media)
	rel, _ := filepath.Rel(a.Root, filepath.Join(dir, "video.mp4"))
	_, e = a.H.DB.Exec("INSERT INTO media VALUES(?,?,?,?,?,?,?,?,?,?,?)", id, owner, "reels", first.Original, filepath.ToSlash(rel), "video/mp4", first.SHA, int64(0), "ready", a.now().Unix(), encode(edl))
	return e
}
