# Sorting Lab

A standalone browser app for the 20 algorithms in CompilerStuck's rainbow-circle sorting video. Everything runs locally in a Web Worker. No account, network requests, external libraries, package installation, or .NET runtime is required for the downloaded app.

## Play

**[Play Sorting Lab](https://adubry75.github.io/sorting-lab/)** — public, with no sign-in required.

You can also open `index.html` in a current browser such as Edge, Chrome, or Firefox. The app's **Download app** button saves a self-contained HTML copy with the code and license embedded.

Select an algorithm and press **Start sorting**. Pause and use **Step** to advance one algorithm checkpoint. A checkpoint can be a comparison or an auxiliary write, so a step need not visibly move a dot. Gravity advances batches of bead-row updates. **Reset** restores the same algorithm, input pattern, and seed; **Reshuffle** selects a fresh seed. Changing an input cancels the current run.

The inputs are permutations of the unique integer ranks 0 through n−1, with sizes from 64 to 50,000. For Bubble, Gnome, Cycle, Selection, and other quadratic sorts, start with 256 or 1,024 elements. All algorithms support 50,000, but slow methods can require billions of operations. The controls remain responsive and Reset cancels the worker immediately.

The playback slider has 163 speed settings from 1 to 1,000,000 checkpoints per frame, including 500. Between 100 and 1,000 it advances in increments of 25; higher ranges use progressively wider increments. Arrow keys move one setting at a time. Changing speed takes effect on the next worker batch without resetting the experiment.

### Sound

Sound starts after you click **Start sorting** or **Step**. Use **Sound on/off** and the volume slider to control it. Pause, reset, completion, and hiding the tab silence the instrument. **Run without animation** is silent.

**Bass** adds a smooth sine layer one octave below the mapped note (default 55%). **Phaser** blends a slow, roughly seven-second filter sweep into the upper voice (default 60%); the bass bypasses the phaser to stay steady. Set either effect to 0% to remove it, or both to 0% for the plain soft tone. These are custom sound-design choices, not a claim about effects used in the video. The main note mapping remains unchanged, and all layers stop together when playback stops.

The note mapping comes from [the original 2022 MidiSys.java](https://github.com/66-m/sorting-visualizer/blob/d70a61e48f649a9f66c681816f02a90145596c79/src/main/java/io/github/compilerstuck/Sound/MidiSys.java): MIDI note `28 + floor(40 * (value + 1) / length)`. Pitch follows the written value, not swap distance or circle angle. Comparisons and auxiliary writes don't trigger notes. When a display batch contains several writes, the highest written index wins, following the original visualization's ascending-index draw order. Animation batching differs from the Java application, so the note sequence and timing can differ from the recording.

The voice deliberately favors relaxed listening over reproducing the original buzzy MIDI instrument. A sine-led waveform has only two faint overtones; continuous oscillator phase, a short pitch glide, and gentle volume envelopes avoid sharp per-frame restarts. Target pitches and write triggers remain unchanged. Idle notes fade within roughly half a second, individual steps make a short soft tone, and pause/mute/reset use an eight-millisecond fade. This is our own calm voice, not a claim to reproduce a newer video or its soundbank. No Java, downloaded samples, MIDI hardware, or external audio dependencies are used; sound works in the standalone HTML too.

**Run without animation** restores the same input and seed, then processes large batches with the main circle held still until completion. The compute counter measures time spent advancing the instrumented JavaScript algorithm. It excludes pauses, rendering, worker messaging, and waiting between frames. It includes generator and counter overhead and is not a calibrated benchmark or a comparison with Java/.NET.

## Reading the picture

- Angle: current index around the circle.
- Color: value.
- Radius: closeness to the correct position, using wrapped displacement.
- Rim: the value is in its final position.
- The percentage counts exact final positions, not adjacent ordered pairs.

The auxiliary workspace shows buffers or counts. Larger arrays are reduced to 100 consecutive-group mean values. Its vertical scale follows the current maximum. It is not an exhaustive memory profiler; scalar bookkeeping, recursion stacks, and some small temporary structures are not displayed.

## Modify the app

Source files are deliberately framework-free:

- `engine.js`: the 20 generator-based algorithms and worker protocol.
- `audio.js`: MIDI pitch mapping and the soft Web Audio voice.
- `app.js`: input generation, playback, circle rasterization, controls, and optional WebMCP tools.
- `page.html` and `style.css`: interface and appearance.
- `build.cjs`: combines the sources and license into a self-contained HTML file.
- `test.cjs`: correctness, large-input, and worker-protocol tests.
- `serve.cjs`: optional localhost preview server.

With Node.js 22 or later installed:

```text
node test.cjs
node test-audio.cjs
node build.cjs
node serve.cjs
```

The preview is at http://127.0.0.1:4173. Reload after rebuilding. No npm install is needed. The build updates both `dist/index.html` for local preview and the root `index.html` served by GitHub Pages. Commit the rebuilt root file to publish changes from the `main` branch. Running tests covers 260 small cases across all 20 algorithms, twelve 50,000-element cases, input validation, auxiliary preparation, and the worker's step/completion protocol.

## Fidelity and deliberate adaptations

This is an adaptation of the algorithms and visual mapping, not a port of the entire Java application. Rendering, controls, pacing, and instrumentation were rewritten for the browser. The input seed and animation order can differ from the recording.

- American Flag uses the video's specialized one-bucket-per-rank method, not a general recursive MSD radix implementation.
- Bucket uses per-value counters, matching the counting-style video variant.
- TimSort uses fixed 32-item insertion-sorted runs and bottom-up merging, not full production TimSort.
- Gravity uses a bounded-memory bead simulation for rank permutations and samples at most 300 layers. It does not allocate a quadratic bead grid. Its intermediate frames and timing are not a benchmark of a literal bead-matrix implementation.
- Radix uses ten stable buckets and round-robin writes across bucket regions.
- Iterative quicksort partition stacks avoid JavaScript recursion limits.
- Each worker batch has a time cap. UI speed is a requested maximum number of checkpoints per frame, not a guaranteed frame rate.
- The upstream application's other visualization modes are not included.

## Credits and license

Inspired by [CompilerStuck's video](https://www.youtube.com/watch?v=M3OuTtW662Y). Algorithm adaptations and disparity-circle mapping derive from [Marcel Mauel's sorting-visualizer](https://github.com/66-m/sorting-visualizer), Copyright (C) 2020–2026 Marcel Mauel, licensed under GNU AGPL version 3. This adaptation is distributed under the same license; see `LICENSE`. The full license is also embedded in the standalone HTML. The JavaScript and CSS are embedded, so the downloaded app includes its source.
