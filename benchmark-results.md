# Benchmark Results — Vampire Survivors Clone

## How to Run the Benchmark

1. Start the game and enter a match
2. Press **B** (keyboard) or tap the **B button** (mobile) to open the Performance Overlay
3. Press **N** to start the extended benchmark
4. Wait 60 seconds — the benchmark runs automatically
5. Open **Browser Console** (F12 → Console tab) to see the JSON result
6. The result is also stored at `window.__benchmarkResult` for programmatic access

### What Happens During Benchmark

- **150 enemies** are spawned in rings around the player (all enemy types)
- **60 XP orbs** are scattered nearby
- Auto-attack weapons continue firing, creating projectiles naturally
- Player HP is set to 9999 (invincible during benchmark)
- FPS is sampled every second for 60 seconds
- Frame times are recorded per-frame for P95/P99 calculations

### After Benchmark

- All spawned entities are cleaned up
- Player HP is restored
- Game continues normally

## JSON Output Format

```json
{
  "benchmark": {
    "version": "2.0",
    "timestamp": "2026-05-05T17:00:00.000Z",
    "duration_ms": 60000,
    "target_duration_ms": 60000,
    "pass": true,
    "pass_criteria": "avgFPS >= 30"
  },
  "fps": {
    "avg": 45,
    "min": 28,
    "max": 60,
    "sample_count": 60,
    "samples_per_second": [
      { "time_s": 1000, "fps": 45, "entities": 210 },
      { "time_s": 2000, "fps": 42, "entities": 215 }
    ]
  },
  "frame_time": {
    "avg_ms": 22.5,
    "p95_ms": 38.2,
    "p99_ms": 55.1,
    "total_frames": 2700
  },
  "entities": {
    "total_at_start": 210,
    "enemies": 150,
    "xp_orbs": 60,
    "projectiles": 12
  },
  "system": {
    "screen_size": "1920x1080",
    "renderer": "WebGL"
  }
}
```

### Field Descriptions

| Field | Description |
|---|---|
| `benchmark.pass` | `true` if avgFPS ≥ 30, `false` otherwise |
| `fps.avg` | Average FPS over the full 60-second measurement |
| `fps.min` | Lowest 1-second FPS sample |
| `fps.max` | Highest 1-second FPS sample |
| `fps.samples_per_second` | Array of per-second samples with entity counts |
| `frame_time.avg_ms` | Average time between frames (lower = better) |
| `frame_time.p95_ms` | 95th percentile frame time — 5% of frames were slower than this |
| `frame_time.p99_ms` | 99th percentile frame time — 1% of frames were slower than this |
| `frame_time.total_frames` | Total frames rendered during benchmark |
| `entities.total_at_start` | Entity count at benchmark end (before cleanup) |

## Expected Values (Pass Criteria)

| Metric | PASS | FAIL |
|---|---|---|
| avg FPS @ 100+ entities | ≥ 30 FPS | < 30 FPS |
| P95 frame time | < 50 ms | ≥ 50 ms |
| P99 frame time | < 100 ms | ≥ 100 ms |

### Context

- **30 FPS** is the minimum for acceptable gameplay
- **60 FPS** is the target for smooth gameplay
- **P95 < 50ms** means 95% of frames render in under 50ms (20+ FPS even in worst moments)
- Frame times are more meaningful than FPS averages because they show jank/spikes

## Running on Different Hardware

For comparative benchmarks across devices:

1. Run on each device
2. Copy the JSON from browser console
3. Compare `fps.avg`, `frame_time.p95_ms`, and `frame_time.p99_ms`

The entity count is fixed (~210 at start), so comparisons are fair across devices.
