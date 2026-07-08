# Sodor Live

A simple dark-mode 24/7 episode stream. It behaves like live TV: the current episode and timestamp are calculated from the real clock, so every visitor sees the same point in the loop. Episodes are shuffled into a random-looking daily order, and the player exposes mute, volume, fullscreen, and a non-interactive progress bar without pause or seeking.

## Add Episodes

1. Put your video files in the `episodes/` folder.
2. Open `episodes.json`.
3. Add one object per episode:

```json
{
  "id": "s01e01",
  "title": "Thomas & Gordon",
  "season": 1,
  "episode": 1,
  "file": "episodes/s01e01-thomas-and-gordon.mp4"
}
```

The video file name does not need to match the `id` or `title`. The only rule is that `file` must exactly match the video path and file name. For example, if your file is called `episodes/my-video.mp4`, then use:

```json
"file": "episodes/my-video.mp4"
```

The app reads video durations from the files automatically. If you ever want to override that, add `durationSeconds` to an episode. For example, a 5 minute 30 second episode is `330`:

```json
"durationSeconds": 330
```

The order on the site is randomised automatically, so you do not need to arrange the JSON file perfectly. Keep the episode details accurate so the Now Streaming section displays correctly.

The current "Others Are Watching Right Now" number is a placeholder until a backend or realtime service is added.

## Run Locally

Because the site loads `episodes.json`, use a local web server instead of opening `index.html` directly.

From this folder, run:

```powershell
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

Only upload or publish video files you have the rights to use.

## Alpha Label

The Alpha hover text is in `index.html` on the `<span class="alpha-badge">` element. When you add more episodes, update this part of the `title` attribute:

```html
Episodes available: S1 E1-15
```

For example, change it to `Episodes available: S1 E1-15` after adding episodes 11-15.

