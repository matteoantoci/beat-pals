# Automatic charts: from an audio file to a chart

Checked on 2026-11-20. "[UNVERIFIED]" marks a claim that I could not confirm in a primary source. "[INFERENCE]" marks my own conclusion from the sources.

## Summary for Beat Pals

1. A child chart needs only a good beat grid and correct downbeats. Beat This (CPJKU, MIT code and weights) gives beats and downbeats in one model. It runs on the M2 in Python, and an ONNX export of it already runs in a browser in the open-source app Autochart ([beat_this](https://github.com/CPJKU/beat_this), [Autochart engine docs](https://github.com/dvar0/autochart/blob/main/docs/engine-integration.md)).
2. Full note transcription is not necessary for a 4-year-old child. It is also the weakest part of all tools: STRUM gets a guitar onset F1 of 65% against human charts ([STRUM README](https://github.com/opria123/strum)). See section 3.
3. The tempo map in a chart is the most important input for the game, not the notes. Tools differ: SongHero writes one constant BPM ([timeline.py](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/timeline.py)), audio2chart writes no real tempo map ([Reddit post of the author](https://www.reddit.com/r/CloneHero/comments/1oyt4zb/automating_charting_process)), chartgen and Autochart write a tempo map that follows the detected beats ([chartgen tempo.py](https://github.com/ErnestSarna/chartgen/blob/main/chartgen/tempo.py), [Autochart engine docs](https://github.com/dvar0/autochart/blob/main/docs/engine-integration.md)).
4. At 120 BPM one beat is 500 ms. With the ±250 ms hit window from decision 1, a note on each beat makes every tap a hit. The game must use strong beats or downbeats, not every beat. [INFERENCE]
5. Recommended path: for song folders with a chart, take beats and downbeats from the chart `[SyncTrack]`. For audio without a chart, run a small Beat This script on the Mac that writes a `notes.chart` with a tempo map that follows each detected beat. A port of Beat This into the PWA is a later, optional step.

## 1. Finished tools

### 1.1 Comparison table

| Tool | Platform | Input | Output | Difficulties and parts | Tempo map | Cost and license | Quality reports |
|---|---|---|---|---|---|---|---|
| AutoChart.eu | Web service, upload ([home](https://autochart.eu/)) | MP3 or FLAC, up to 20 minutes and 200 MB ([FAQ data on home page](https://autochart.eu/)) | Zip: `notes.mid`, one audio file for each instrument, `song.ini`, cover art ([guide](https://autochart.eu/guides/make-a-chart-from-any-song)) | Easy to Expert for drums (pro drums), guitar, bass; vocals with lyrics ([guide](https://autochart.eu/guides/make-a-chart-from-any-song)) | Not documented [UNVERIFIED] | First song free, then €3, €2 or €1 for each song in packs; closed service ([home](https://autochart.eu/)) | The FAQ says: "we can't guarantee their quality". Best for rock, pop and metal; weaker for electronic or orchestral music ([home](https://autochart.eu/)). I found no independent user report [UNVERIFIED]. |
| Autochart (dvar0) with the Fretformer model | Desktop app: Windows x64, macOS Apple Silicon (`.dmg`), Linux x64. A browser engine exists in the code ([README](https://github.com/dvar0/autochart)) | Audio file, or a song folder with `notes.chart` ([README](https://github.com/dvar0/autochart)) | Song folder with `notes.chart` ([engine docs](https://github.com/dvar0/autochart/blob/main/docs/engine-integration.md)) | Easy to Expert, lead guitar only ([README](https://github.com/dvar0/autochart)) | Beat This plus a grid smoother; tempo anchors from the detected grid ([engine docs](https://github.com/dvar0/autochart/blob/main/docs/engine-integration.md)) | Free. App AGPL-3.0; Fretformer weights CC BY-NC-SA 4.0; Demucs and Beat This parts MIT ([README](https://github.com/dvar0/autochart), [model card](https://github.com/dvar0/autochart/blob/main/docs/huggingface-model-card.md)) | Author: "the Easy charts kinda suck right now". One user: "surprisingly good". One charter: "these charts are not good" ([Reddit](https://www.reddit.com/r/CloneHero/comments/1wr057t/autochart_ai_guitar_charts_for_clone_hero_yarg/)) |
| SongHero (`any-song-clone-hero-cli`) | CLI: macOS, Linux, Windows through WSL. Node 18+, Python 3.9+, `yt-dlp`, `ffmpeg` ([README](https://github.com/jackwallner/any-song-clone-hero-cli)) | CLI: Spotify track or playlist link only. The Python script `analyze.py` accepts a local audio file (see 1.2) | `notes.chart`, `song.ini`, `song.opus` ([README](https://github.com/jackwallner/any-song-clone-hero-cli)) | Easy to Expert, guitar only ([generate_chart.py](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/generate_chart.py)) | One constant BPM from `librosa` ([timeline.py](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/timeline.py)) | Free, MIT ([README](https://github.com/jackwallner/any-song-clone-hero-cli)) | No user reports found. The 7 GitHub issues are bugs and feature requests ([issues](https://github.com/jackwallner/any-song-clone-hero-cli/issues)) |
| chartgen | Windows installer. macOS from source is possible but not documented (see 1.3) ([README](https://github.com/ErnestSarna/chartgen)) | YouTube link, or local MP3, FLAC, WAV, OGG, Opus, M4A ([README](https://github.com/ErnestSarna/chartgen)) | `notes.chart`, `song.ini`, `song.opus`, `album.png` ([README](https://github.com/ErnestSarna/chartgen)) | Expert to Easy, 5-fret guitar only ([README](https://github.com/ErnestSarna/chartgen)) | Follows the detected beats: a new BPM event when the beats drift more than 25 ms from the current tempo ([tempo.py](https://github.com/ErnestSarna/chartgen/blob/main/chartgen/tempo.py)) | Free, MIT ([README](https://github.com/ErnestSarna/chartgen)) | Calibrated against 800 human charts, says the author ([README](https://github.com/ErnestSarna/chartgen)). No third-party reports found. |
| OCTAVE editor with STRUM | Desktop: Windows, macOS, Linux; "macOS and Linux have not been fully tested" ([Reddit](https://www.reddit.com/r/CloneHero/comments/1tefkaf/octave_chart_editor_autocharter_for_clone_hero)). STRUM CLI lists "PyTorch 2.x with CUDA" ([STRUM](https://github.com/opria123/strum)) | Audio file, stem folder, or YouTube link ([OCTAVE guide](https://octavestudio.tools/guide/auto-chart)) | `notes.mid`, one `.ogg` for each stem, `song.ini` ([OCTAVE guide](https://octavestudio.tools/guide/auto-chart)) | Easy to Expert for drums, guitar, bass, keys, vocals ([STRUM](https://github.com/opria123/strum)) | One BPM, found by a ±5 BPM search, then a phase snap [INFERENCE from the STRUM README text] ([STRUM](https://github.com/opria123/strum)) | Free, MIT ([STRUM](https://github.com/opria123/strum)) | Onset F1 against human charts: drums 83.8%, guitar 65.1%, bass 69.4%, vocals 53.9%, on 29 pre-screened songs ([STRUM](https://github.com/opria123/strum)). Author: drums are "the strongest by a wide margin". One user: "way off for all instruments" ([Reddit](https://www.reddit.com/r/CloneHero/comments/1tefkaf/octave_chart_editor_autocharter_for_clone_hero)). A macOS bug in the Demucs step is fixed in a beta ([issue 11](https://github.com/opria123/octave/issues/11)). |
| audio2chart (3podi) | Google Colab notebook, or local Python with a GPU ([README](https://github.com/3podi/audio2chart)) | MP3 or WAV ([README](https://github.com/3podi/audio2chart)) | `notes.chart` ([README](https://github.com/3podi/audio2chart)) | Guitar only. A temperature under 0.4 gives an "Easy"-like chart, says the author ([Reddit](https://www.reddit.com/r/CloneHero/comments/1oyt4zb/automating_charting_process)) | "It doesn't tempo map" ([Reddit](https://www.reddit.com/r/CloneHero/comments/1oyt4zb/automating_charting_process)); chartgen notes a fixed 200 BPM ([chartgen tempo.py](https://github.com/ErnestSarna/chartgen/blob/main/chartgen/tempo.py)) | Free. No license file in the repository ([chartgen history](https://github.com/ErnestSarna/chartgen/blob/main/docs/history.md)) | One tester: "the result is very random" ([Reddit](https://www.reddit.com/r/CloneHero/comments/1oyt4zb/automating_charting_process)). chartgen removed it: same note time accuracy, less human texture ([chartgen history](https://github.com/ErnestSarna/chartgen/blob/main/docs/history.md)) |
| Audio2Hero | Hugging Face Space (Gradio) and Python code ([repo](https://github.com/mb6611/audio2hero)) | Audio file ([Space app.py](https://huggingface.co/spaces/Tim-gubski/Audio2Hero/blob/main/app.py)) | Zip: `notes.mid`, `song.ogg`, `song.ini` ([Space app.py](https://huggingface.co/spaces/Tim-gubski/Audio2Hero/blob/main/app.py)) | Medium only, guitar ([repo](https://github.com/mb6611/audio2hero)) | Not documented [UNVERIFIED] | Model card MIT ([model](https://huggingface.co/mb6611/audio2hero)); no license in the GitHub repository ([repo](https://github.com/mb6611/audio2hero)) | Known limits from the authors: no stem separation, overlapped sustains, notes after the song end ([repo](https://github.com/mb6611/audio2hero)). The Space status was `RUNTIME_ERROR` on 2026-11-20 ([Space API](https://huggingface.co/api/spaces/Tim-gubski/Audio2Hero/runtime)). |
| Tensor Hero | Jupyter notebooks; a student web front end ([repo](https://github.com/elliottwaissbluth/tensor-hero), [front end](https://rexcheng1997.github.io/tensorhero-frontend/public/about.html)) | Audio file ([repo](https://github.com/elliottwaissbluth/tensor-hero)) | `notes.chart` ([repo](https://github.com/elliottwaissbluth/tensor-hero)) | Guitar ([front end](https://rexcheng1997.github.io/tensorhero-frontend/public/about.html)) | Not documented [UNVERIFIED] | MIT ([repo](https://github.com/elliottwaissbluth/tensor-hero)) | A 2022 Berkeley capstone ([paper](https://www.ischool.berkeley.edu/sites/default/files/sproject_attachments/tensorhero_capstone.pdf)). I did not confirm that the web generator still works [UNVERIFIED]. |

Tools that do not make a chart from audio:

| Tool | What it does | Source |
|---|---|---|
| Moonscraper Chart Editor | Manual `.chart` editor. I found no audio-to-notes feature. | [repo](https://github.com/FireFox2000000/Moonscraper-Chart-Editor) |
| Onyx Music Game Toolkit | Converts chart formats. "Fill in automatic lower difficulties" makes Hard, Medium, Easy from Expert in a MIDI. Builds for macOS. GPL-3.0. | [Onyx readme](https://onyxite.org/toolkit/readme.html) |
| Music Charts Tools | Browser tool. Makes Hard, Medium, Easy from an Expert guitar track. | [guitar difficulties page](https://cloneherocharts.vercel.app/guitar-difficulties) |
| YARG | Plays charts. I found no chart generator in it [UNVERIFIED]. | [AutoChart.eu YARG guide](https://autochart.eu/guides/yarg-vs-clone-hero) |

Other small projects that I did not evaluate: a drums-only chart tool with a beat-grid editor ([charter](https://github.com/Johan-ZeLearner/charter)), a random-forest fret model ([clone-hero-chart-ml](https://github.com/axlprz/clone-hero-chart-ml)), and a transformer model card ([tab-hero](https://huggingface.co/MattGroho/tab-hero)).

### 1.2 SongHero: local audio file or only Spotify?

- The CLI accepts only Spotify input. `runPipeline` calls `parseSpotifyInput`, which throws an error for any value that is not a Spotify track URL or URI ([lib/pipeline.js](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/lib/pipeline.js), [python/sources.py](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/sources.py)).
- The audio comes from a `yt-dlp` download, not from Spotify ([lib/pipeline.js](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/lib/pipeline.js)).
- The Python step accepts a local file: `python/analyze.py <audio_file>` writes analysis JSON, and `python/generate_chart.py <analysis.json> <metadata.json>` writes the chart text ([analyze.py](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/analyze.py), [generate_chart.py](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/generate_chart.py)). So a parent can run SongHero on an owned file with two commands. [INFERENCE: I read the code; I did not run it.]
- Method: `librosa.beat.beat_track` on the percussive part, onsets snapped to a beat grid within 150 ms, fret from the chroma pitch class. Medium keeps the notes on beats with frets capped at 3 (4 lanes). Easy keeps every second Medium note ([analyze.py](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/analyze.py)). So SongHero Easy is already a "beat" chart.
- Risk for Beat Pals: the `[SyncTrack]` has one BPM event only. The notes keep the measured seconds, so the chart tick of a note does not show its beat number when the song tempo drifts ([timeline.py](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/timeline.py)). [INFERENCE]

### 1.3 chartgen: can it run on macOS from source?

- The install scripts are Windows only (`install.bat`, `setup.ps1`). The README gives manual steps: a venv, `torch==2.9.1 torchaudio==2.9.1`, `pip install -r requirements.txt`, then `basic-pitch==0.4.0 --no-deps` ([README](https://github.com/ErnestSarna/chartgen)).
- The code has a macOS branch (`open` for the song folder) ([app.py](https://github.com/ErnestSarna/chartgen/blob/main/chartgen/app.py)). The cache and settings path falls back to the home folder when `APPDATA` is absent ([cache.py](https://github.com/ErnestSarna/chartgen/blob/main/chartgen/cache.py)).
- The pinned packages that need native builds have macOS arm64 wheels on PyPI: `onnxruntime 1.28.0`, `ctranslate2 4.8.1`, `torch 2.9.1`, `numba 0.66.0`, `llvmlite 0.48.0`, `scikit-learn 1.9.0`, `lameenc 1.8.4`, `soxr 1.1.0` ([PyPI JSON API](https://pypi.org/pypi/onnxruntime/1.28.0/json), checked for each package).
- The stem and lyric code selects CUDA or CPU only, with no MPS branch ([stems.py](https://github.com/ErnestSarna/chartgen/blob/main/chartgen/stems.py), [lyrics.py](https://github.com/ErnestSarna/chartgen/blob/main/chartgen/lyrics.py)). On the M2 it runs on the CPU. The author gives about 20 minutes for a 4-minute song on a PC CPU ([README](https://github.com/ErnestSarna/chartgen)).
- Answer: probably yes, CPU only, with manual setup. Nobody reports a macOS run [UNVERIFIED].

## 2. Building blocks for a Mac pipeline

### 2.1 Table

| Block | Task | Apple Silicon (M2) | Browser | Accuracy notes | License |
|---|---|---|---|---|---|
| Beat This (`beat_this`) | Beats and downbeats | PyTorch. The CLI selects CUDA or CPU only ([cli.py](https://github.com/CPJKU/beat_this/blob/main/beat_this/cli.py)). The Python API takes any `device`; a fix for MPS autocast was merged on 2026-02-02 ([PR 14](https://github.com/CPJKU/beat_this/pull/14)) | ONNX export runs in `onnxruntime-web` (WebGPU, or wasm on CPU) in Autochart ([engine docs](https://github.com/dvar0/autochart/blob/main/docs/engine-integration.md)). The `beat_this_core_fp32.onnx` file is 82 MB ([catalog.json](https://github.com/dvar0/autochart/blob/main/engine/catalog.json)) | GTZAN test: beat F1 89.1, downbeat F1 78.3; small model 88.8 and 77.2 ([paper, Table 2](https://arxiv.org/html/2407.21658)). Model files: about 78 MB, small model 8.1 MB ([README](https://github.com/CPJKU/beat_this)) | MIT for code and weights ([README](https://github.com/CPJKU/beat_this)) |
| madmom | Beats, downbeats (RNN plus DBN) | PyPI 0.16.1 supports only Python < 3.10 and numpy < 1.20; install from GitHub ([beat_this README](https://github.com/CPJKU/beat_this)). Import problems are open issues ([issue 547](https://github.com/CPJKU/madmom/issues/547)) | No | Classic baseline. Beat This without DBN beats it on beat F1 ([paper](https://arxiv.org/html/2407.21658)) | Code BSD-style; model files CC BY-NC-SA 4.0 ([LICENSE](https://github.com/CPJKU/madmom/blob/main/LICENSE)) |
| librosa | Beats and one global tempo; no downbeats | Pure Python; SongHero and chartgen run it ([SongHero analyze.py](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/analyze.py)) | No | Dynamic programme after Ellis 2007; picks peaks "approximately consistent with estimated tempo" ([beat.py](https://github.com/librosa/librosa/blob/main/librosa/beat.py)). chartgen saw a 120.0 BPM click read as 117.5 BPM with a median of gaps ([chartgen tempo.py](https://github.com/ErnestSarna/chartgen/blob/main/chartgen/tempo.py)) | ISC ([repo](https://github.com/librosa/librosa)) |
| Essentia and essentia.js | Beats and BPM (`RhythmExtractor2013`, `BeatTrackerMultiFeature`); no downbeat algorithm in this list | Essentia builds on macOS [UNVERIFIED for M2] | essentia.js is WebAssembly and has these algorithms ([API docs](https://mtg.github.io/essentia.js/docs/api/Essentia.html)) | Classic DSP methods, older than the neural trackers [INFERENCE] | AGPL-3.0 ([essentia](https://github.com/MTG/essentia), [essentia.js](https://github.com/MTG/essentia.js)). The hosted PWA code would need an AGPL-compatible license. |
| BeatNet | Beats, downbeats, meter; online and offline modes | Needs madmom and `pyaudio` ([README](https://github.com/mjhydri/BeatNet)) | No | Online (causal) tracker; offline mode adds a DBN ([README](https://github.com/mjhydri/BeatNet)) | CC BY 4.0 ([repo](https://github.com/mjhydri/BeatNet)) |
| All-In-One (`allin1`) | BPM, beats, downbeats, beat number 1 to 4, sections with labels (intro, verse, chorus) | Needs NATTEN and madmom. NATTEN has no MPS kernel, so the Mac runs a slow CPU kernel, and the install often fails ([PR 39](https://github.com/mir-aidj/all-in-one/pull/39), [issue 17](https://github.com/mir-aidj/all-in-one/issues/17)). PR 39 (open) adds a plain PyTorch fallback | No | Harmonix Set, 8-fold cross-validation: beat F1 0.958, downbeat F1 0.915 ([paper, Table 1](https://arxiv.org/html/2307.16425)). It runs Demucs first, so it is slow ([pyproject via PyPI](https://pypi.org/project/allin1/)) | MIT ([repo](https://github.com/mir-aidj/all-in-one)) |
| Demucs v4 (`htdemucs`, `htdemucs_ft`, `htdemucs_6s`) | Stems: drums, bass, vocals, other (plus guitar and piano in `htdemucs_6s`) | Default device is CUDA, else MPS, else CPU ([separate.py](https://github.com/adefossez/demucs/blob/main/demucs/separate.py)). On CPU it takes about 1.5 times the track length ([README](https://github.com/adefossez/demucs)) | ONNX port runs in the browser in Autochart ([engine docs](https://github.com/dvar0/autochart/blob/main/docs/engine-integration.md)) | 9.00 dB SDR on MUSDB HQ; "the `piano` source is not working great" ([README](https://github.com/adefossez/demucs)) | MIT. The Meta repository is archived; `adefossez/demucs` is the maintained copy ([facebookresearch/demucs](https://github.com/facebookresearch/demucs), [adefossez/demucs](https://github.com/adefossez/demucs)) |
| Spotify Basic Pitch | Polyphonic notes to MIDI | CoreML is the default runtime on macOS. README: "For Mac M1 hardware, we currently only support python version 3.10" ([README](https://github.com/spotify/basic-pitch)) | `basic-pitch-ts` on npm; last push 2023-05 ([basic-pitch-ts](https://github.com/spotify/basic-pitch-ts)) | "works best on one instrument at a time", so it needs stems ([README](https://github.com/spotify/basic-pitch)) | Apache-2.0 ([repo](https://github.com/spotify/basic-pitch)) |
| `web-audio-beat-detector` | One BPM and the offset of the first beat (`guess()`) | Not applicable | Yes, Web Audio API ([README](https://github.com/chrisguttandin/web-audio-beat-detector)) | Default range 90 to 180 BPM; "surprisingly good results especially for electronic music" ([README](https://github.com/chrisguttandin/web-audio-beat-detector)). One constant tempo only. | MIT ([repo](https://github.com/chrisguttandin/web-audio-beat-detector)) |

### 2.2 Notes on accuracy numbers

- Beat F1 counts a beat as correct within ±70 ms (`f_measure_threshold=0.07`) ([mir_eval beat.py](https://github.com/mir-evaluation/mir_eval/blob/main/mir_eval/beat.py)). The Beat Pals hit window is ±250 ms (README decision 1), so a beat error under 70 ms is not visible to the child. [INFERENCE]
- Beat This on GTZAN: CMLt 79.8 and AMLt 89.8 ([paper, Table 2](https://arxiv.org/html/2407.21658)). AMLt also accepts double tempo, half tempo, and the off-beat. The gap of about 10 points shows that the main error is the wrong metrical level, not a small time error. [INFERENCE]
- A half-tempo error gives fewer notes. That is safe for a child. A double-tempo error gives more notes; the game rule "minimum gap between notes" removes them. An off-beat error puts each note between the felt beats. That is the only bad error for the child. [INFERENCE]
- The allin1 numbers come from the Harmonix Set (pop music, in-domain cross-validation). The Beat This numbers come from GTZAN (held out, many genres). Do not compare them directly. ([allin1 paper](https://arxiv.org/html/2307.16425), [Beat This paper](https://arxiv.org/html/2407.21658))

## 3. Assessment: is beat and downbeat detection enough?

Yes. For a 4- or 5-year-old child who taps on strong beats, beat and downbeat detection is enough. Full note transcription is not necessary. The reasons:

1. **The child taps a pulse, not a riff.** A review of the research says that young children cannot synchronize with a metronome or a musical beat before about 4 years of age ([Repp and Su 2013 review](https://link.springer.com/article/10.3758/s13423-012-0371-2); details in `child-rhythm-design.md`). A guitar riff has syncopation and fast runs. A child at this age cannot tap these. [INFERENCE]
2. **The hit window covers a whole beat.** At 120 BPM a beat is 500 ms. A ±250 ms window around each beat covers all time, so a tap at any moment hits. A note on every second beat (1000 ms) or on each downbeat (2000 ms in 4/4) gives the child a real target. So the chart needs correct beats and correct downbeats, and nothing more. [INFERENCE]
3. **Transcription is the least accurate step.** Against human charts, STRUM gets onset F1 65.1% on guitar and 53.9% on vocals, but 83.8% on drums ([STRUM README](https://github.com/opria123/strum)). Beat This gets beat F1 89.1% on held-out music ([paper](https://arxiv.org/html/2407.21658)). Even the onsets in human charts are not always audible: only 89.0% of charted drum events have an audio onset within ±100 ms ([chartgen research notes](https://github.com/ErnestSarna/chartgen/blob/main/docs/charting-lessons-beyond-ch.md), which cite the [STRUM paper](https://arxiv.org/abs/2605.12135)).
4. **The game reduces the chart to beats anyway.** Decision 6 keeps strong beats only, with 3 lanes. A transcribed melody passes through this filter and only the beat positions remain. [INFERENCE]

What a beat grid alone does not give, and cheap fixes:

| Gap | Cheap fix |
|---|---|
| Beats continue through silence (intro, fade, break) | Drop a beat when the loudness (RMS) of the mix, or of the Demucs drum stem, is low around it. SongHero already skips grid points in quiet sections ([analyze.py](https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/analyze.py)). |
| Lanes have no musical meaning | Use a fixed lane pattern for each section, so that each chorus looks the same. allin1 gives section labels ([README](https://github.com/mir-aidj/all-in-one)). With a chart in the folder, take the lane from the fret of the nearest chart note. [INFERENCE] |
| Wrong metrical level (double or half tempo) | Pick beat, every second beat, or downbeat from the beat interval, so that the note gap stays in a range that the child likes. The range comes from `child-rhythm-design.md`. [INFERENCE] |
| Wrong downbeat (downbeat F1 78.3% on GTZAN) | In 4/4, beats 1 and 3 are both strong. A shift of 2 beats does not change a "1 and 3" chart. A shift of 1 beat does. A click preview lets the parent hear this in seconds. [INFERENCE] |

## 4. Recommended path on the Mac

### 4.1 Steps

1. **Song folder with a chart (human or automatic):** the game takes beats and downbeats from the `[SyncTrack]` of `notes.chart` or the tempo map of `notes.mid`. A human tempo map is the best beat grid that exists, and it needs no audio analysis. Chart notes help with lanes and with silent parts. Caution: a chart from SongHero or audio2chart has a constant or fixed BPM, so its ticks do not show the real beats (see the Summary, item 3). For these, use step 2 on the audio. [INFERENCE]
2. **Audio file without a chart, on the Mac:** a short Python script in its own virtual environment.
   - Beat This `final0` through the Python API (`File2Beats`), on CPU or `device="mps"` ([README](https://github.com/CPJKU/beat_this), [PR 14](https://github.com/CPJKU/beat_this/pull/14)).
   - Write `notes.chart` with a `[SyncTrack]` that puts each detected beat on a whole beat tick, and a `TS` event from the gap between downbeats. chartgen adds a new BPM event when the beats drift more than 25 ms from the current tempo ([chartgen tempo.py](https://github.com/ErnestSarna/chartgen/blob/main/chartgen/tempo.py)). Autochart derives tempo anchors from the Beat This grid ([Autochart engine docs](https://github.com/dvar0/autochart/blob/main/docs/engine-integration.md)). Then a beat in the chart is one beat in the audio.
   - Put notes only on strong beats, and drop beats in quiet parts.
   - Write a click track over the song, so that the parent can check the grid by ear before the import.
   - Zip `notes.chart`, `song.ini`, and the audio, in the Clone Hero folder layout.
   - Optional: Demucs `htdemucs` on MPS for a drum stem (loudness gate) or for stems, if the game silences an instrument on a miss (README open question 4).
3. **No-code option:** the Autochart app for Apple Silicon makes a `notes.chart` with a Beat This tempo map ([README](https://github.com/dvar0/autochart)). The game uses its tempo map and ignores its guitar notes. Cost: a model download of about 952 MB ([model card](https://github.com/dvar0/autochart/blob/main/docs/huggingface-model-card.md)). Licenses are acceptable for private play.
4. **Later, optional:** run Beat This inside the PWA with `onnxruntime-web`, so that the parent can import a bare MP3 on the device. Autochart shows that this works in a desktop browser. It needs cross-origin isolation (COOP `same-origin`, COEP `require-corp`) for wasm threads ([engine docs](https://github.com/dvar0/autochart/blob/main/docs/engine-integration.md)). The fp32 core is 82 MB; an export of the 8.1 MB small model would be lighter [UNVERIFIED size after export]. iOS memory limits decide this step (see `ios-pwa-audio.md`).

### 4.2 Why this path

- **Beat This rather than madmom, BeatNet, or librosa:** it gives downbeats, it has MIT weights, its install is PyTorch plus four pip packages, and an ONNX export already runs in a browser ([README](https://github.com/CPJKU/beat_this), [Autochart engine docs](https://github.com/dvar0/autochart/blob/main/docs/engine-integration.md)). madmom models are non-commercial and the PyPI package is old ([LICENSE](https://github.com/CPJKU/madmom/blob/main/LICENSE)). librosa gives no downbeats ([beat.py](https://github.com/librosa/librosa/blob/main/librosa/beat.py)).
- **Beat This rather than allin1:** allin1 adds section labels, but the Mac install is fragile (NATTEN) and it runs Demucs first ([PR 39](https://github.com/mir-aidj/all-in-one/pull/39)). Add allin1 only if section-based lane patterns prove useful.
- **No Basic Pitch or STRUM:** transcription adds install weight (Python 3.10 limit on M1 for Basic Pitch, CUDA for STRUM) and gives notes that the child filter removes ([Basic Pitch README](https://github.com/spotify/basic-pitch), [STRUM README](https://github.com/opria123/strum)).
- **AutoChart.eu stays useful for one case:** its zip has one audio file for each instrument ([guide](https://autochart.eu/guides/make-a-chart-from-any-song)). That supports "silence of the instrument on a miss" with no work on the Mac. The cost is €1 to €3 for each song ([home](https://autochart.eu/)).
- **One place for child rules:** the Mac script writes a normal chart with an honest tempo map. The game simplifier (decision 6) stays the only place for child rules, for human charts and for generated charts alike. [INFERENCE]

## Open questions

1. Does the child tap on beats 1 and 3, or on the backbeat (2 and 4, the snare in rock and pop)? This decides how the game uses downbeats. Test with the child.
2. What note gap does the child like (one beat, two beats, one bar)? `child-rhythm-design.md` should give a range in milliseconds.
3. How fast do Beat This and Demucs run on the M2, on CPU and on MPS? Measure with one 4-minute song.
4. Does AutoChart.eu write a tempo map for each beat, or one BPM? Check with the free first song.
5. Can iOS Safari load an 82 MB (or a smaller) ONNX model and run it in a PWA without a crash? Ask `ios-pwa-audio.md`.
6. Does the game silence an instrument on a miss (README open question 4)? If yes, stems are necessary: Demucs on the Mac, or AutoChart.eu.

## Sources

Finished tools:
- AutoChart.eu home, pricing and FAQ: https://autochart.eu/
- AutoChart.eu guide, make a chart from any song: https://autochart.eu/guides/make-a-chart-from-any-song
- AutoChart.eu guides index: https://autochart.eu/guides
- AutoChart.eu, YARG compared with Clone Hero: https://autochart.eu/guides/yarg-vs-clone-hero
- Autochart (dvar0) repository: https://github.com/dvar0/autochart
- Autochart engine docs: https://github.com/dvar0/autochart/blob/main/docs/engine-integration.md
- Autochart model card: https://github.com/dvar0/autochart/blob/main/docs/huggingface-model-card.md
- Autochart model catalog: https://github.com/dvar0/autochart/blob/main/engine/catalog.json
- Autochart Reddit post: https://www.reddit.com/r/CloneHero/comments/1wr057t/autochart_ai_guitar_charts_for_clone_hero_yarg/
- SongHero repository: https://github.com/jackwallner/any-song-clone-hero-cli
- SongHero `lib/pipeline.js`: https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/lib/pipeline.js
- SongHero `python/sources.py`: https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/sources.py
- SongHero `python/analyze.py`: https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/analyze.py
- SongHero `python/generate_chart.py`: https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/generate_chart.py
- SongHero `python/timeline.py`: https://github.com/jackwallner/any-song-clone-hero-cli/blob/main/python/timeline.py
- SongHero issues: https://github.com/jackwallner/any-song-clone-hero-cli/issues
- chartgen repository: https://github.com/ErnestSarna/chartgen
- chartgen `tempo.py`: https://github.com/ErnestSarna/chartgen/blob/main/chartgen/tempo.py
- chartgen `stems.py`: https://github.com/ErnestSarna/chartgen/blob/main/chartgen/stems.py
- chartgen `lyrics.py`: https://github.com/ErnestSarna/chartgen/blob/main/chartgen/lyrics.py
- chartgen `app.py`: https://github.com/ErnestSarna/chartgen/blob/main/chartgen/app.py
- chartgen `cache.py`: https://github.com/ErnestSarna/chartgen/blob/main/chartgen/cache.py
- chartgen history: https://github.com/ErnestSarna/chartgen/blob/main/docs/history.md
- chartgen research notes: https://github.com/ErnestSarna/chartgen/blob/main/docs/charting-lessons-beyond-ch.md
- PyPI JSON API (wheel check, example): https://pypi.org/pypi/onnxruntime/1.28.0/json
- STRUM repository: https://github.com/opria123/strum
- STRUM paper: https://arxiv.org/abs/2605.12135
- OCTAVE Auto-Chart guide: https://octavestudio.tools/guide/auto-chart
- OCTAVE Reddit post: https://www.reddit.com/r/CloneHero/comments/1tefkaf/octave_chart_editor_autocharter_for_clone_hero
- OCTAVE macOS issue 11: https://github.com/opria123/octave/issues/11
- audio2chart repository: https://github.com/3podi/audio2chart
- audio2chart Reddit post: https://www.reddit.com/r/CloneHero/comments/1oyt4zb/automating_charting_process
- Audio2Hero repository: https://github.com/mb6611/audio2hero
- Audio2Hero Space: https://huggingface.co/spaces/Tim-gubski/Audio2Hero
- Audio2Hero Space `app.py`: https://huggingface.co/spaces/Tim-gubski/Audio2Hero/blob/main/app.py
- Audio2Hero Space runtime API: https://huggingface.co/api/spaces/Tim-gubski/Audio2Hero/runtime
- Audio2Hero model: https://huggingface.co/mb6611/audio2hero
- Tensor Hero repository: https://github.com/elliottwaissbluth/tensor-hero
- Tensor Hero front end: https://rexcheng1997.github.io/tensorhero-frontend/public/about.html
- Tensor Hero capstone paper: https://www.ischool.berkeley.edu/sites/default/files/sproject_attachments/tensorhero_capstone.pdf
- Moonscraper Chart Editor: https://github.com/FireFox2000000/Moonscraper-Chart-Editor
- Onyx readme: https://onyxite.org/toolkit/readme.html
- Music Charts Tools, guitar difficulties: https://cloneherocharts.vercel.app/guitar-difficulties
- charter (drums): https://github.com/Johan-ZeLearner/charter
- clone-hero-chart-ml: https://github.com/axlprz/clone-hero-chart-ml
- tab-hero model: https://huggingface.co/MattGroho/tab-hero

Building blocks:
- Beat This repository: https://github.com/CPJKU/beat_this
- Beat This `cli.py`: https://github.com/CPJKU/beat_this/blob/main/beat_this/cli.py
- Beat This PR 14 (MPS autocast): https://github.com/CPJKU/beat_this/pull/14
- "Beat This! Accurate Beat Tracking Without DBN Postprocessing": https://arxiv.org/html/2407.21658
- madmom license: https://github.com/CPJKU/madmom/blob/main/LICENSE
- madmom issue 547: https://github.com/CPJKU/madmom/issues/547
- librosa repository: https://github.com/librosa/librosa
- librosa `beat.py`: https://github.com/librosa/librosa/blob/main/librosa/beat.py
- Essentia: https://github.com/MTG/essentia
- essentia.js: https://github.com/MTG/essentia.js
- essentia.js API: https://mtg.github.io/essentia.js/docs/api/Essentia.html
- BeatNet: https://github.com/mjhydri/BeatNet
- All-In-One repository: https://github.com/mir-aidj/all-in-one
- All-In-One paper: https://arxiv.org/html/2307.16425
- All-In-One PyPI: https://pypi.org/project/allin1/
- All-In-One issue 17: https://github.com/mir-aidj/all-in-one/issues/17
- All-In-One PR 39: https://github.com/mir-aidj/all-in-one/pull/39
- Demucs (maintained): https://github.com/adefossez/demucs
- Demucs `separate.py`: https://github.com/adefossez/demucs/blob/main/demucs/separate.py
- Demucs (Meta, archived): https://github.com/facebookresearch/demucs
- Basic Pitch: https://github.com/spotify/basic-pitch
- basic-pitch-ts: https://github.com/spotify/basic-pitch-ts
- web-audio-beat-detector: https://github.com/chrisguttandin/web-audio-beat-detector
- mir_eval `beat.py`: https://github.com/mir-evaluation/mir_eval/blob/main/mir_eval/beat.py

Child timing:
- Repp and Su 2013, "Sensorimotor synchronization: A review of recent research (2006–2012)": https://link.springer.com/article/10.3758/s13423-012-0371-2
