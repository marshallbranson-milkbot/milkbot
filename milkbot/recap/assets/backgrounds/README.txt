Drop .mp4 / .mov / .webm / .mkv files here.

When the recap pipeline renders a video, it picks one file at random from this folder, loops it, scales/crops it to 1080x1920, darkens it slightly for caption readability, and uses it as the background.

Good picks:
- Subway Surfers gameplay
- Minecraft parkour / grass-chopping
- Satisfying slime / kinetic sand compilations
- Fast driving/racing clips
- Any high-motion vertical clip

Keep files under ~30MB for fast Railway deploys. Shorter clips (15-30s) work fine since they loop.

If this folder is empty, the renderer falls back to an animated gradient background.
