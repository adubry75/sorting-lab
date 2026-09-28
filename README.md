# Sorting Lab

A standalone browser app for the 20 algorithms in CompilerStuck's rainbow-circle sorting video. Everything runs locally in a Web Worker. No account, network requests, external libraries, package installation, or .NET runtime is required for the downloaded app.

## Play

**[Play Sorting Lab](https://adubry75.github.io/sorting-lab/)** — public, with no sign-in required.

You can also open `index.html` in a current browser such as Edge, Chrome, or Firefox. The app's **Download app** button saves a self-contained HTML copy with the code and license embedded.

Select an algorithm and press **Start sorting**. Pause and use **Step** to advance one algorithm checkpoint. A checkpoint can be a comparison or an auxiliary write, so a step need not visibly move a dot. Gravity advances batches of bead-row updates. **Reset** restores the same algorithm, input pattern, and seed; **Reshuffle** selects a fresh seed. Changing an input cancels the current run.

The inputs are permutations of the unique integer ranks 0 through n−1, with sizes from 64 to 50,000. For Bubble, Gnome, Cycle, Selection, and other quadratic sorts, start with 256 or 1,024 elements. All algorithms support 50,000, but slow methods can require billions of operations. The controls remain responsive and Reset cancels the worker immediately.

The playback slider starts at 500 checkpoints per frame so the first sort lasts long enough to hear. It has 163 settings from 1 to 1,000,000 checkpoints per frame. Between 100 and 1,000 it advances in increments of 25; higher ranges use progressively wider increments. Arrow keys move one setting at a time. Changing speed takes effect on the next worker batch without resetting the experiment.

### Sound

Sound starts after you click **Start sorting** or **Step**. Use **Sound on/off** and the volume slider to control it. Pause, reset, completion, and hiding the tab silence the instrument. **Run without animation** is silent.

**Tone** defaults to **Video-derived**, with **Volume at 70%**. Its three stereo wavetables were fitted from short periodic low, middle, and high passages in the supplied video audio (around 38, 55, and 63 seconds), using cycle alignment, averaging, and Fourier coefficients. The sound carries its waveform phase across highlighted values and crossfades note transitions over eight milliseconds. This preserves complete low-frequency cycles even when the display updates faster than the bass oscillates. The previous implementation restarted from zero every frame, turning some low notes into a refresh-rate buzz.

The output level is calibrated against the recording's absolute signal level, rather than only its normalized frequency distribution. The earlier default was approximately 16 dB quieter in a five-second Merge Sort comparison. A 20 Hz high-pass removes DC and a soft peak limiter leaves headroom for optional effects; the limiter is linear below its threshold. **Soft synth** retains the earlier sine-led voice and smooth pitch changes for comparison. This is a compact tone model, not a reconstruction of the original synthesizer or a replay of the recording. Different algorithms, batching, timing, and note transitions can still sound different. Numerical agreement does not establish an exact perceptual match on every speaker system.

**Bass** adds an optional sine layer one octave below the mapped note. **Phaser** blends an optional slow, roughly seven-second filter sweep into the upper voice; the bass bypasses it. Both default to 0%, since the measured reference tone already contains low-frequency and stereo detail. These controls are custom effects, not a claim about effects used in the video. All layers stop together when playback stops.

The note mapping comes from [the original 2022 MidiSys.java](https://github.com/66-m/sorting-visualizer/blob/d70a61e48f649a9f66c681816f02a90145596c79/src/main/java/io/github/compilerstuck/Sound/MidiSys.java): MIDI note `28 + floor(40 * (value + 1) / length)`. Pitch follows the value at the highlighted position, not swap distance or circle angle. The source's `Marker.SET` also marks searches and auxiliary preparation: it does not mean only main-array writes. The latest checkpoint's highest highlighted index determines the tone, instead of accumulating all visited indices across a batch. Counting highlights the value-indexed position used by the reference; Merge highlights the next position while merging two nonempty runs. Rendering and batching still differ from the Java application.

Idle notes fade within roughly half a second, individual steps make a short tone, and pause/mute/reset use an eight-millisecond fade. No Java, MIDI hardware, network audio downloads, or external audio dependencies are used; the embedded reference model and sound engine work in the standalone HTML too. Reshuffle remains instantaneous, so the recording's animated shuffle introduction is not reproduced.

Background reading: [iZotope on low-end impact and attack](https://www.izotope.com/community/blog/eq-cheat-sheet), and [Genelec on frequency response, listening level, and temporal response](https://www.genelec.com/-/blog/how-to-analyse-frequency-and-temporal-responses). The calibration uses the supplied recording as its reference; those articles inform the diagnosis rather than prescribing an added kick-drum sound.

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
- `audio.js`: MIDI pitch mapping, embedded stereo reference-tone coefficients, soft comparison voice, and optional effects.
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

Optional audio-render regression: `node test-audio-render.cjs` uses Playwright and an installed Microsoft Edge. These are development-test dependencies only, not app dependencies. It renders real Web Audio output offline to verify 41 Hz bass survives 30/60/120 highlight updates per second, remains at a comparable level across those rates, stops cleanly, and retains clipping headroom with the effects at maximum.

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
