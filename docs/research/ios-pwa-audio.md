# iOS Safari and Home Screen web app limits for Beat Pals

## Summary for Beat Pals

- AirPods add about 45 to 190 ms of delay, and the browser cannot detect them. The game needs a tap-along calibration that the parent can do, and it must judge taps against the heard time, not the clock time ([Coyle 2019](https://stephencoyle.net/airpods-pro), [Coyle 2022](https://stephencoyle.net/airpods-pro-2), [Rhythm Quest devlog 10](https://rhythmquestgame.com/devlog/10.html)).
- Play the song from a decoded `AudioBuffer` (one mix, or a mix plus one lead stem), not from an `<audio>` element. A 4-minute stereo song is 81 to 88 MiB, and the iPhone WebContent limit is about 1.5 GB. WebKit has open bugs on the time accuracy of an `<audio>` element that goes through Web Audio ([WebKit 268816 c10](https://bugs.webkit.org/show_bug.cgi?id=268816#c10), [WebKit 204228](https://bugs.webkit.org/show_bug.cgi?id=204228)).
- Decode stems one at a time. Parallel decodes kill the tab on iOS ([WebKit 227636](https://bugs.webkit.org/show_bug.cgi?id=227636)).
- Require iOS 18.4 or later. It adds Ogg Vorbis and Ogg Opus (the `.ogg` and `.opus` files of Clone Hero) and `webkitdirectory` (pick a song folder, no zip) ([WebKit, Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)). For older iOS, a WASM decoder works ([wasm-audio-decoders](https://github.com/eshaz/wasm-audio-decoders)).
- Import songs inside the installed Home Screen app. Its storage is separate from Safari, it has no 7-day deletion, and it can store up to about 60% of the disk ([firt.dev](https://firt.dev/notes/pwa-ios/), [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/), [WebKit ITP 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)).

## 0. Lessons from Pile Pals that apply here

Version note: from iOS 18 on, the Safari version number is equal to the iOS version number (Safari 18.4 is in iOS 18.4, Safari 26 in iOS 26) ([WebKit, Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/), [WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)). Safari 27 is the current release in November 2026 ([WebKit 327697](https://bugs.webkit.org/show_bug.cgi?id=327697)).

These facts come from the sister project. The Parent confirmed them on the iPhone.

- Audio starts only in a tap. For a touch, `pointerup` and `touchend` are user activation, but `pointerdown` is not. The HTML standard lists "`pointerdown`, provided the event's pointerType is `mouse`; `pointerup`, provided the event's pointerType is not `mouse`; or `touchend`" ([HTML, activation triggering input event](https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event)). Pile Pals unlocks on both `pointerdown` and `pointerup` (`pile-pals/src/sound/engine.ts`, `installAudio`). Beat Pals needs a "Go" button before each song, so that the `AudioContext` is `running` before the first note.
- After a return from the background, iOS can report `running` and play nothing. The next tap must close the old `AudioContext` and make a new one (`pile-pals/docs/agents/ios-device.md`, `stale` in `engine.ts`). An open WebKit bug shows a worse state: a tab can lose all audio while each API reports success, and no page signal shows it ([WebKit 323104](https://bugs.webkit.org/show_bug.cgi?id=323104), iOS 18.7 and iOS 27 beta). Risk for Beat Pals: a silent song after a pause. Give the parent a "no sound? close the app and open it again" hint.
- `navigator.audioSession.type = 'playback'` plays with the silent switch on (Pile Pals choice). The Audio Session API `type` is in Safari 16.4 and later; `state` is not available ([MDN BCD `api.AudioSession`](https://github.com/mdn/browser-compat-data/blob/main/api/AudioSession.json)).
- Pile Pals decodes with an `OfflineAudioContext(1, 1, 44_100)` before the first touch, because an `AudioBuffer` works in each `AudioContext` (`engine.ts`, `decode`). Note: the decode resamples to the sample rate of the context that decodes ([Web Audio API, `decodeAudioData`](https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-decodeaudiodata): "resample it to the sample-rate of the BaseAudioContext"). So the sample rate of the decoder context sets the memory size of the song (section 3).

## 1. Audio clock and latency

### 1.1 What WebKit supports

| API | Safari / iOS | WebKit behaviour |
|---|---|---|
| `AudioContext.currentTime` | 6 | Time of the sample after the last rendered block ([spec](https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-currenttime)). It moves in steps of one render block, so it is coarse for animation. |
| `AudioContext.getOutputTimestamp()` | 14.1 ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/AudioContext.json)) | Gives `contextTime` (the sample that the output device plays now) and `performanceTime` (the same moment on the `performance.now()` clock) ([spec](https://webaudio.github.io/web-audio-api/#dom-audiocontext-getoutputtimestamp)). WebKit takes both values from the Core Audio render callback (`sampleTime`, `hostTime`) and clamps `contextTime` to `currentTime` ([AudioContext.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webaudio/AudioContext.cpp), [AudioDestinationCocoa.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/cocoa/AudioDestinationCocoa.cpp)). [INFERENCE] I found no addition of `outputLatency` in that path, so `contextTime` does not include the Bluetooth delay. |
| `AudioContext.baseLatency` | 14.1 ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/AudioContext.json)) | WebKit returns `framesPerBuffer / sampleRate` ([AudioContext.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webaudio/AudioContext.cpp)). When Web Audio is active, WebKit asks iOS for an I/O buffer of one render quantum, 128 frames ([MediaSessionManagerCocoa.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/cocoa/MediaSessionManagerCocoa.mm)). That is 2.7 ms at 48 kHz. |
| `AudioContext.outputLatency` | 18.4 ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/AudioContext.json), [web.dev](https://web.dev/articles/audio-output-latency)) | On iOS: the latency of the output audio unit plus `AVAudioSession.outputLatency` ([AudioDestinationCocoa.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/cocoa/AudioDestinationCocoa.cpp), [AudioSessionIOS.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/ios/AudioSessionIOS.mm)). It returns `0` when the context does not play. When a noise injection policy is on (fingerprint protection), it returns a fixed `512 / sampleRate` (10.7 ms at 48 kHz) ([AudioContext.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webaudio/AudioContext.cpp)). |
| `latencyHint` option | 14.1 accepts it ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/AudioContext.json)) | [INFERENCE] It has no effect: the bug "Add in latencyHint support for AudioContext" is open ([WebKit 214258](https://bugs.webkit.org/show_bug.cgi?id=214258)), and WebKit sets 128 frames for each Web Audio page ([MediaSessionManagerCocoa.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/cocoa/MediaSessionManagerCocoa.mm)). |
| `sampleRate` option | 14.1 ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/AudioContext.json)) | WebKit accepts 3,000 to 384,000 Hz ([BaseAudioContext.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webaudio/BaseAudioContext.cpp)). |
| `performance.now()` | all | WebKit rounds it to 1 ms unless the page is cross-origin isolated ([Performance.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/Performance.cpp)). 1 ms is enough for a ±250 ms window. |

Fingerprint protection: Safari applies noise and fixed values to some APIs when "Advanced Tracking and Fingerprinting Protection" is on ([WebKit, Private Browsing 2.0](https://webkit.org/blog/15697/private-browsing-2-0/)). Safari 26 applies protections to "known fingerprinting scripts" ([WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)). Press reports say that iOS 26 turns the protection on for all browsing ([9to5Mac](https://9to5mac.com/2025/07/29/with-ios-26-safari-will-counter-one-of-the-webs-most-invasive-tracking-methods)). [UNVERIFIED] whether a Home Screen web app gets the fixed `outputLatency` value by default.

### 1.2 Typical output latency

Stephen Coyle measured the time from a screen tap to the sound, with the iOS keyboard click, on an iPad Pro. The values include touch latency and are for native code, not Web Audio.

| Output | Tap to sound | Source |
|---|---|---|
| Built-in speaker | 83 ms | [Coyle 2022](https://stephencoyle.net/airpods-pro-2) |
| AirPods Pro 2 | 126 ms | [Coyle 2022](https://stephencoyle.net/airpods-pro-2) |
| AirPods Pro (1st gen.) | 144 to 167 ms | [Coyle 2019](https://stephencoyle.net/airpods-pro), [Coyle 2022](https://stephencoyle.net/airpods-pro-2) |
| AirPods (2nd gen.) | 178 ms | [Coyle 2019](https://stephencoyle.net/airpods-pro) |
| AirPods (1st gen.) | 274 ms | [Coyle 2019](https://stephencoyle.net/airpods-pro) |

So Bluetooth adds about 43 ms (AirPods Pro 2) to about 190 ms (AirPods 1st gen.) over the speaker. Coyle also found that the first sound after a pause is later, because "the audio engine needs to wake up first", and that an app that keeps its audio session open avoids this ([Coyle 2019](https://stephencoyle.net/airpods-pro)). [INFERENCE] For Beat Pals, the song keeps the session open, so only the delay before the first note changes.

A route change while a context plays can damage the output: on iOS 26, a context that starts on the speaker and then moves to AirPlay stays distorted until a new `AudioContext` is made ([WebKit 325501](https://bugs.webkit.org/show_bug.cgi?id=325501), open). [UNVERIFIED] whether a Bluetooth route change has the same effect.

### 1.3 How rhythm games calibrate

- Three latencies add up: audio, visual, and input. "Usually, audio latency is the largest of the three latencies." A tap test to an audio signal measures audio plus input latency. A tap test to a visual signal measures video plus input latency ([Rhythm Quest devlog 10](https://rhythmquestgame.com/devlog/10.html)).
- Rhythm Quest shows one screen that combines a tap test with a manual audio offset. The tap must not play a sound, because that sound has the latency too ([Rhythm Quest devlog 10](https://rhythmquestgame.com/devlog/10.html)).
- Rhythm Quest schedules hit sounds in advance at the correct times, so they are on time with a large audio latency ([Rhythm Quest devlog 10](https://rhythmquestgame.com/devlog/10.html)).
- osu! has a "Universal offset" in milliseconds and an "Offset wizard": a metronome, a song, and ticks that cross a line; the user moves the offset until the ticks match ([osu! wiki, Options](https://github.com/ppy/osu-wiki/blob/master/wiki/Client/Options/en.md), [osu! wiki, Offset Wizard](https://github.com/ppy/osu-wiki/blob/master/wiki/Client/Options/Offset_Wizard/en.md)).
- A web recipe: schedule 16 clicks with `source.start(t)`, record each tap on the same clock, drop the first taps, take the median of tap minus click, store it, and give a manual slider and a reset button, because people change headphones. `outputLatency` "is only a hint" ([Cotorano Audio](https://bgm.cotorano.com/blog/bluetooth-delay-web-rhythm-game-calibrate-offset/), a secondary source).

### Risk for Beat Pals

- High: with AirPods and no calibration, a tap that is on the heard beat is 45 to 190 ms late on the clock. That uses most of the ±250 ms window of decision 1 in `README.md`. Mitigation: one stored offset in ms, set by the parent with a tap test or a slider (the child cannot do a tap test reliably). Show "change this if you change headphones".
- Medium: hit sounds that play on the tap are late by the full Bluetooth delay. Mitigation: no tap sound, a sound scheduled at the note time (Rhythm Quest), or a visual reward only.
- Low: `outputLatency` can be `0`, a fixed fake value, or a real value. Use it at most as a start value for the calibration, never as the truth.

## 2. Visual sync with the audio clock

### Method

1. Start the song with `source.start(t0)`, where `t0 = ctx.currentTime + 0.1`. `start(when)` puts the start on the audio clock, not on the main thread ([spec, `AudioBufferSourceNode.start`](https://webaudio.github.io/web-audio-api/#dom-audiobuffersourcenode-start)).
2. In each `requestAnimationFrame` callback, read `const ts = ctx.getOutputTimestamp()`. The song time that the child hears now is `ts.contextTime - t0 + (performance.now() - ts.performanceTime) / 1000 - offset`. The spec defines `performanceTime` as the `performance.now()` time of the sample at `contextTime` ([spec](https://webaudio.github.io/web-audio-api/#dom-audiocontext-getoutputtimestamp)), so the second term moves the value from the last audio callback to now.
3. Draw the notes at that song time. Judge a tap with the same formula, with the event time in place of `performance.now()`.
4. If `ts.performanceTime` is `0` (no audio block yet), wait. The spec returns zeros in that case ([spec](https://webaudio.github.io/web-audio-api/#dom-audiocontext-getoutputtimestamp)).

Do not use `ctx.currentTime` alone for the note position. It is the time of the next block to render, not of the sound that plays now ([spec](https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-currenttime)).

### Frame rate on iPhone and iPad

- Safari draws at 60 Hz by default, also on ProMotion screens. The feature flag "Prefer Page Rendering Updates near 60fps" is on by default. When a user turns it off, iPad Pro and iPhone Pro get 120 Hz `requestAnimationFrame` ([WebKit 272165](https://bugs.webkit.org/show_bug.cgi?id=272165), fixed in iOS 18 for iPhone 13 to 15 Pro; [WebKit 280183](https://bugs.webkit.org/show_bug.cgi?id=280183) for iPhone 16 Pro; [heise, February 2026](https://www.heise.de/en/news/Safari-browsing-with-ProMotion-Initially-deactivated-on-iPhone-Mac-Co-11174983.html)).
- The reporter of WebKit 272165 says in comment 16 that the flag "does not affect PWAs", and a separate bug is open for web apps on macOS ([WebKit 272165](https://bugs.webkit.org/show_bug.cgi?id=272165), [WebKit 272226](https://bugs.webkit.org/show_bug.cgi?id=272226)). Plan for 60 Hz.
- In Low Power Mode, iOS throttles `requestAnimationFrame` to 30 fps ([WebKit 168837](https://bugs.webkit.org/show_bug.cgi?id=168837)).
- An open bug reports short `requestAnimationFrame` hitches on `touchstart`, `touchend`, `pointerdown`, and `pointerup` on iOS 17 ([WebKit 273336](https://bugs.webkit.org/show_bug.cgi?id=273336)).

### Risk for Beat Pals

Low. At 60 Hz a frame is 16.7 ms, and at 30 Hz it is 33 ms. Both are small compared with ±250 ms. Because the note position comes from the audio clock on each frame, a dropped frame moves no note off time. Keep note motion slow and the notes large, so 30 fps still looks smooth to the child.

## 3. Memory

### Limits

- "On iPhones, for most devices, the limit is 1.5GB" for the WebContent process. On iPad the limit is higher; "For an 8GB device, the limit will be in the 4GB+ range." Typed arrays and WASM memory also have a 2 GB "Gigacage" limit (Ben Nham, WebKit, [WebKit 268816 comment 10](https://bugs.webkit.org/show_bug.cgi?id=268816#c10), March 2024).
- When the process goes above the limit, iOS kills it (jetsam). The page reloads and no `pagehide` runs ([WebKit 199854](https://bugs.webkit.org/show_bug.cgi?id=199854), quoted in `pile-pals/research/native-feel/shell.md`). A field report shows the log line "killed by jetsam reason per-process-limit" on iOS 18.7 ([EmulatorJS 1220](https://github.com/EmulatorJS/EmulatorJS/issues/1220)).
- Parallel `decodeAudioData()` calls on many files crash the tab on iOS. A WebKit engineer saw "a Jetsam happening (over 1.5GB of memory used)" and said that JavaScript cannot read the limit ([WebKit 227636](https://bugs.webkit.org/show_bug.cgi?id=227636), open).
- Memory from `decodeAudioData` can stay allocated for about a minute after the page drops the buffer ([WebKit 189337](https://bugs.webkit.org/show_bug.cgi?id=189337), open).
- WebKit limits one `AudioBuffer` channel to 4 GiB of samples ([AudioBuffer.h](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webaudio/AudioBuffer.h)). This limit is far above the process limit, so it does not apply.

### Size of a decoded song

An `AudioBuffer` holds float32 samples (4 bytes). 4 minutes = 240 s.

| Format of the decoded buffer | Bytes | MiB |
|---|---|---|
| Stereo, 48 kHz | 240 × 48,000 × 2 × 4 = 92,160,000 | 87.9 |
| Stereo, 44.1 kHz | 240 × 44,100 × 2 × 4 = 84,672,000 | 80.7 |
| Stereo, 24 kHz | 240 × 24,000 × 2 × 4 = 46,080,000 | 43.9 |
| 5 stems, stereo, 48 kHz | 5 × 92,160,000 = 460,800,000 | 439.5 |

The decode resamples to the rate of the decoder context ([spec](https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-decodeaudiodata)), so an `OfflineAudioContext` at 24 kHz halves the size. The `AudioContext` itself accepts a `sampleRate` option since Safari 14.1 ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/AudioContext.json)).

### Options

| Option | Memory | Time accuracy | Notes |
|---|---|---|---|
| A. Decode each stem, one at a time, and add it into one mix `AudioBuffer` with `getChannelData()` | Peak about 2 × song (mix + one stem) + compressed file | Sample accurate with `AudioBufferSourceNode.start()` | Recommended. Keep one lead stem (for example `guitar.ogg`) as a second buffer if a missed note must mute the instrument (README open question 4): about 176 MiB at 48 kHz. |
| B. `OfflineAudioContext` mix-down: all stems as sources, one `startRendering()` | Peak = all stems + output (about 6 × song for 5 stems) | Same as A after the mix | Simple, but all stems are in memory at the same time. Safe for 2 or 3 stems only. |
| C. `<audio>` element with `MediaElementAudioSourceNode` | Small (the element streams from the `Blob`) | Poor in WebKit: `currentTime` does not match the audio when the element goes through an `AudioContext` ([WebKit 204228](https://bugs.webkit.org/show_bug.cgi?id=204228), open since Safari 13, seen on iOS 15; [WebKit 240568](https://bugs.webkit.org/show_bug.cgi?id=240568), open); after a seek or resume, the node plays the start of the file for about 1 s ([WebKit 328316](https://bugs.webkit.org/show_bug.cgi?id=328316), Safari 27, open). `play()` cannot start at an exact audio time. | Fallback only, for a song that is too long for A. A 4-year-old does not need seek. |
| D. Plain `<audio>` element without Web Audio | Small | Clock is `audio.currentTime`; no link to the Web Audio clock | Then the hit sounds and the song are on two clocks. Not recommended. |
| E. Mix down at import and store the mix compressed | Small at play time | Same as A | [INFERENCE] Safari 26 adds WebCodecs `AudioEncoder` ([WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)), so the import could encode the mix one time. Not tested. |

When fingerprint protection is on, `getChannelData()` returns samples with "a tiny amount of noise" ([WebKit, Private Browsing 2.0](https://webkit.org/blog/15697/private-browsing-2-0/)). For a mix of music, this noise is not audible [INFERENCE].

### Risk for Beat Pals

- Medium: a song folder with 5 to 7 stems that the game decodes in parallel can kill the app on an iPhone. Mitigation: option A, one decode at a time, and an `await` between decodes.
- Low: one or two decoded buffers (90 to 180 MiB) are far below 1.5 GB. Keep only the current song decoded. Release the buffer of the last song before the next decode.

## 4. Decode: Ogg Vorbis and Opus

### Support in Safari

| Format | Container | iOS | Source |
|---|---|---|---|
| Vorbis | Ogg (`.ogg`) | 18.4 and later | "adding Ogg container support for both Opus and Vorbis audio on macOS Sequoia 15.4, iOS 18.4, iPadOS 18.4" ([WebKit, Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)); caniuse shows no Ogg container on iOS before 18.4 ([caniuse data, ogg-vorbis](https://github.com/Fyrd/caniuse/blob/main/features-json/ogg-vorbis.json)) |
| Opus | Ogg (`.opus`) | 18.4 and later | same Safari 18.4 note; caniuse marks iOS 18.4 as full support ([caniuse data, opus](https://github.com/Fyrd/caniuse/blob/main/features-json/opus.json)) |
| Opus | WebM | 17.4 and later (17.5 for all bit rates) | [caniuse data, opus](https://github.com/Fyrd/caniuse/blob/main/features-json/opus.json) |
| Opus | CAF | 11 and later (constant bit rate only) | [caniuse data, opus](https://github.com/Fyrd/caniuse/blob/main/features-json/opus.json) |

caniuse data is for the `<audio>` element. For `decodeAudioData`:

- WebKit maps the Ogg file type (`'Oggf'`) to `audio/ogg` and decodes it with the system decoders ([AudioFileReaderCocoa.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/cocoa/AudioFileReaderCocoa.mm)).
- In 2026 WebKit moved `decodeAudioData` from AudioToolbox `AudioFile` to an AVFoundation asset reader. That change broke Ogg decode in a nightly build (the Spotify 20-year summary failed), and the fix added the tests `decode-audio-data-ogg-opus.html` and `decode-audio-data-ogg-vorbis.html` ([WebKit 316172](https://bugs.webkit.org/show_bug.cgi?id=316172), commit [314462@main](https://commits.webkit.org/314462@main), June 2026).
- [INFERENCE] Ogg Vorbis and Ogg Opus decode with `decodeAudioData` on iOS 18.4 to 26 too, because a production site used it before the regression. I found no WebKit release note that names `decodeAudioData` for Ogg.

Known decode bugs:

- Ogg Vorbis: Safari 27 trims the first frames instead of the last frames, so the decoded audio starts a little late (300 frames in the report, 12 to 18 ms) ([WebKit 328809](https://bugs.webkit.org/show_bug.cgi?id=328809), open).
- WebM Opus: `decodeAudioData` refuses each Opus "mapping family" (a header byte) except 0, also for mono and stereo, and calls the error callback with `null` (Safari 26.6 and 27) ([WebKit 327697](https://bugs.webkit.org/show_bug.cgi?id=327697), open). Normal stereo Opus files use family 0 [UNVERIFIED for Clone Hero files].
- ALAC above about 32 MB of input decodes only in part, with no error, in Safari 27 ([WebKit 325481](https://bugs.webkit.org/show_bug.cgi?id=325481), open). Clone Hero does not use ALAC [UNVERIFIED].
- AAC/M4A with an edit list failed in the iOS 27 beta; fixed ([WebKit 320198](https://bugs.webkit.org/show_bug.cgi?id=320198)).

### WASM decoders for iOS before 18.4 or for a failed decode

From the `wasm-audio-decoders` project by Ethan Halsall (MIT). Each one decodes on the main thread or in its own Web Worker ([README](https://github.com/eshaz/wasm-audio-decoders)):

| Package | Format | Size (minified) | Latest |
|---|---|---|---|
| `@wasm-audio-decoders/ogg-vorbis` | Ogg Vorbis | 99.3 KiB | 0.1.20 ([npm](https://www.npmjs.com/package/@wasm-audio-decoders/ogg-vorbis)) |
| `ogg-opus-decoder` | Ogg Opus | 114.9 KiB | 1.7.5, August 2026 ([npm](https://www.npmjs.com/package/ogg-opus-decoder)) |
| `mpg123-decoder` | MP3 | 77.0 KiB | ([README](https://github.com/eshaz/wasm-audio-decoders)) |
| `@wasm-audio-decoders/flac` | FLAC, Ogg FLAC | 67.2 KiB | ([README](https://github.com/eshaz/wasm-audio-decoders)) |

A WebKit bug reporter decoded 16-channel Opus with `opus-decoder` 0.7.12 in Safari 27, where `decodeAudioData` failed ([WebKit 327697](https://bugs.webkit.org/show_bug.cgi?id=327697)). The output is float32 PCM, which goes into an `AudioBuffer` with `copyToChannel()` (Safari 14.1, [BCD](https://github.com/mdn/browser-compat-data/blob/main/api/AudioBuffer.json)). The WASM heap counts against the 2 GB Gigacage ([WebKit 268816 c10](https://bugs.webkit.org/show_bug.cgi?id=268816#c10)). [INFERENCE] Decode in chunks and copy each chunk out, so the WASM heap stays small.

### Risk for Beat Pals

- High on iOS below 18.4: `.ogg` and `.opus` do not decode natively. Mitigation: require iOS 18.4 or later (check the iPhone or iPad of the family), or ship the WASM decoders as a fallback after a native decode error. They add about 215 KiB to the app.
- Low: a start offset of 10 to 20 ms on Ogg Vorbis in Safari 27. The calibration offset absorbs it.

## 5. Storage

### Quota

- From iOS 17, "For a browser app, the origin quota is up to 60% of the total disk space", and the overall quota is up to 80%. "When a web app is running standalone (as Home Screen Web App on iOS...), it has the same origin quota and overall quota as when it is opened in a browser app" ([WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/), August 2023; [MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria#safari)).
- The quota covers `localStorage`, Cache API, IndexedDB, Service Worker, and the File System API (OPFS) ([WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/)).
- `navigator.storage.estimate()` is in Safari 17; `persist()`, `persisted()`, and OPFS `getDirectory()` are in Safari 15.2 ([BCD StorageManager](https://github.com/mdn/browser-compat-data/blob/main/api/StorageManager.json)).
- A Home Screen web app does not share its storage with Safari ("Storage shared with Browser ❌", [firt.dev](https://firt.dev/notes/pwa-ios/), updated October 2026).

### Eviction

- Safari deletes script-written data of an origin with no user interaction in the last seven days of browser use ([MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)). For Home Screen apps: "Web applications added to the home screen are not part of Safari and thus have their own counter of days of use... We do not expect the first-party in such a web application to have its website data deleted" ([WebKit ITP 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)).
- WebKit also evicts whole origins, least recently used first, when the overall quota is full or the disk is low. An origin in persistent mode can be excluded ([WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/)).
- `persist()`: "WebKit currently grants a request based on heuristics like whether the website is opened as a Home Screen Web App" ([WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/)). There is no prompt ([MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).

### Blobs and OPFS

- IndexedDB stores `Blob` and `File` objects on iOS. Older iOS versions had failures ([WebKit 188438](https://bugs.webkit.org/show_bug.cgi?id=188438), fixed 2018; [Dexie 1227](https://github.com/dexie/Dexie.js/issues/1227), iOS 14.5 beta). An open regression sends an empty body when a page uploads a disk-backed `File` read back from IndexedDB ([WebKit 319985](https://bugs.webkit.org/show_bug.cgi?id=319985)). Beat Pals uploads nothing, so this does not apply.
- OPFS: `createSyncAccessHandle()` (worker only) is in Safari 15.2; `createWritable()` (main thread) is in Safari 26 ([BCD FileSystemFileHandle](https://github.com/mdn/browser-compat-data/blob/main/api/FileSystemFileHandle.json)).

### Size for Beat Pals

Store the compressed files (for example 5 stems of Ogg at about 4 to 8 MB each [UNVERIFIED]), not decoded PCM. 50 songs at 40 MB is 2 GB, far below 60% of a 128 GB device.

### Risk for Beat Pals

- High: if the parent imports songs in a Safari tab, the installed app does not see them. Mitigation: import only in the installed app; show a "Add to Home Screen first" screen when `display-mode: standalone` does not match.
- Medium: removal of the app from the Home Screen or "Clear History and Website Data" deletes the songs [UNVERIFIED for the app removal]. Mitigation: the parent keeps the zips in the Files app.
- Low: eviction under disk pressure. Mitigation: call `navigator.storage.persist()` at the first import and show the result in the parent area.

## 6. File import

### `<input type=file>` on iOS

- The input opens the Files document picker. iOS maps each extension in `accept` to a system type. It ignores extensions that iOS does not know, and "If no extension is supported, no file can be selected" ([BCD issue 26043](https://github.com/mdn/browser-compat-data/issues/26043), with [WebKit 279606](https://bugs.webkit.org/show_bug.cgi?id=279606)). `.zip` is a system type (`public.zip-archive`) [INFERENCE: so `accept=".zip,application/zip"` works]. Do not put `.sng`, `.chart`, or `.mid` alone in `accept`; leave `accept` out for those.
- Files in third-party cloud providers (for example OneDrive) cannot be selected on iOS 26.2; files in "On My iPhone" can ([WebKit 306211](https://bugs.webkit.org/show_bug.cgi?id=306211), open).
- A Home Screen web app has no Share Target, so "Share > Beat Pals" from the Files app is not possible ("share_target ❌", [firt.dev](https://firt.dev/notes/pwa-ios/)).
- [UNVERIFIED] The picker returns the `.zip` as one file and does not expand it.

### `webkitdirectory`

- iOS 18.4 adds `webkitdirectory`: "the document picker is immediately displayed with non-directory items grayed out... a directory can be uploaded by navigating into the target directory and pressing 'Open'" ([WebKit, Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)). Before iOS 18.4, "The property can be set, but has no effect" ([BCD HTMLInputElement](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLInputElement.json), [WebKit 271705](https://bugs.webkit.org/show_bug.cgi?id=271705)).
- For Beat Pals: on iOS 18.4 or later, the parent can pick an unzipped Clone Hero song folder. The game then needs no unzip step.

### Unzip libraries

| Library | How it reads | Memory | Source |
|---|---|---|---|
| `fflate` | `unzipSync(data, { filter })` takes the whole zip as a `Uint8Array`; `filter` skips entries; the `Unzip` class takes the zip in chunks | Whole zip + all extracted entries with `unzipSync` | [fflate README](https://github.com/101arrowz/fflate) (8 kB, 3 kB for inflate only) |
| `zip.js` (`@zip.js/zip.js`) | `BlobReader` reads slices of the `Blob` with `blob.slice(offset, offset + size)`; `getEntries()` reads the central directory | One entry at a time; "Writers which deliver the content progressively, e.g. `BlobWriter`... grow with the data actually produced" | [zip.js README](https://github.com/gildas-lormeau/zip.js), [io.js](https://github.com/gildas-lormeau/zip.js/blob/master/lib/core/io.js) |

- `zip.js` uses native `DecompressionStream` with `deflate-raw` and Web Workers ([zip.js README](https://github.com/gildas-lormeau/zip.js)). Safari has `DecompressionStream` with `deflate-raw` since 16.4 ([BCD DecompressionStream](https://github.com/mdn/browser-compat-data/blob/main/api/DecompressionStream.json)).
- zip.js warns that deflate data "can expand up to 1032 times its compressed size". Check `entry.uncompressedSize` before an extract, and do not extract all entries at the same time ([zip.js README](https://github.com/gildas-lormeau/zip.js)).
- `Blob.slice` is in Safari 7; `Blob.stream()` is in Safari 14.1 ([BCD Blob](https://github.com/mdn/browser-compat-data/blob/main/api/Blob.json)).

### Risk for Beat Pals

- Medium: a 50 to 150 MB zip read with `file.arrayBuffer()` and `unzipSync` puts the zip and all stems in memory at the same time. Mitigation: `zip.js` with `BlobReader` and `BlobWriter`, one entry at a time, then store each entry `Blob` in IndexedDB.
- Low: a wrong `accept` value makes all files grey. Mitigation: `accept=".zip,application/zip"` or no `accept`.

## 7. Touch input

### Events

- The 350 ms tap delay of iOS applies to `click`, because WebKit waits for a possible double tap. `touch-action: manipulation` on the element or an ancestor removes it ([WebKit, More Responsive Tapping](https://webkit.org/blog/5610/more-responsive-tapping-on-ios/)). [INFERENCE] `touchstart` and `pointerdown` are not part of that delay; judge hits on `pointerdown`.
- `pointerdown` is in Safari 13 ([BCD Element](https://github.com/mdn/browser-compat-data/blob/main/api/Element.json)). `getCoalescedEvents()` and `getPredictedEvents()` are in Safari 18.2 ([BCD PointerEvent](https://github.com/mdn/browser-compat-data/blob/main/api/PointerEvent.json)).
- A field report: "iOS fires `touchstart` before `pointerdown`", and rapid taps on a `pointerdown` button flashed the text selection loupe. The fix was a `touchstart` listener with `preventDefault()` and `{ passive: false }` ([Leland Fiegel, February 2026](http://le.land/blog/ios-mobile-web-meta/), secondary source).
- `touchstart` and `touchmove` listeners on `window`, `document`, `documentElement`, and `body` are passive by default, so `preventDefault()` there does nothing unless the listener sets `passive: false` ([MDN `addEventListener`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)).
- iOS 27 beta regression: when a double tap starts native text selection, the page gets no `pointerup` and no `pointercancel` for that tap. Fixed ([WebKit 322561](https://bugs.webkit.org/show_bug.cgi?id=322561)). [INFERENCE] Judge a hit on `pointerdown` only, and keep no state that waits for `pointerup`.
- WebKit rounds `event.timeStamp` and `performance.now()` to 1 ms ([Performance.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/Performance.cpp)). [UNVERIFIED] whether WebKit sets `event.timeStamp` of a touch to the hardware touch time or to the dispatch time. Input latency is part of the tap calibration value anyway ([Rhythm Quest devlog 10](https://rhythmquestgame.com/devlog/10.html)).

### Stop zoom, double-tap zoom, and long-press callouts

| Problem | Fix | Support | Source |
|---|---|---|---|
| Double-tap zoom | `touch-action: manipulation` | iOS 9.3 | [WebKit blog 5610](https://webkit.org/blog/5610/more-responsive-tapping-on-ios/), [BCD touch-action](https://github.com/mdn/browser-compat-data/blob/main/css/properties/touch-action.json) |
| Pinch zoom with two fingers | `touch-action: none` on the play field (iOS 13); also `preventDefault()` on `gesturestart`, `gesturechange`, `gestureend` (Safari-only `GestureEvent`, iOS 2) | iOS 13 / iOS 2 | [BCD touch-action](https://github.com/mdn/browser-compat-data/blob/main/css/properties/touch-action.json), [BCD GestureEvent](https://github.com/mdn/browser-compat-data/blob/main/api/GestureEvent.json), [Fiegel](http://le.land/blog/ios-mobile-web-meta/) |
| `user-scalable=no` and `maximum-scale` | Safari ignores them since iOS 10 | iOS 10 | "Now, we ignore the user-scalable, min-scale and max-scale settings" ([WebKit, iOS 10 interaction](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/)) |
| Long-press callout menu | `-webkit-touch-callout: none` | iOS 2 | [BCD -webkit-touch-callout](https://github.com/mdn/browser-compat-data/blob/main/css/properties/-webkit-touch-callout.json) |
| Text selection and loupe | `-webkit-user-select: none` (iOS needs the prefix) on the root; `contextmenu` `preventDefault()` | iOS 3 | [BCD user-select](https://github.com/mdn/browser-compat-data/blob/main/css/properties/user-select.json), [WebKit 231161](https://bugs.webkit.org/show_bug.cgi?id=231161), [Fiegel](http://le.land/blog/ios-mobile-web-meta/) |
| Tap highlight | `-webkit-tap-highlight-color: transparent` | iOS | `smart-games/.scratch/minigame-collection/research/pwa-route.md` |

Two thumbs on the glass "is exactly the gesture iOS interprets as pinch-to-zoom", and `touch-action: none` alone did not stop it in the reporter's game ([Fiegel](http://le.land/blog/ios-mobile-web-meta/)). A child taps with many fingers and the palm, so Beat Pals needs all rows of the table above.

### Risk for Beat Pals

- High: a zoom, a callout, or a selection loupe in the middle of a song stops the game for a 4-year-old. Mitigation: all fixes in the table, and a test on the device with fast taps of several fingers.
- Low: input latency. It is in the tens of ms and the tap calibration includes it.

## Open questions

1. Which iOS version do the family iPhone and iPad have? 18.4 or later removes the need for WASM decoders and allows folder import.
2. Does `outputLatency` on iOS report the AirPods delay, or a fixed value of fingerprint protection, in a Home Screen web app? Test on the device with AirPods and with the speaker.
3. Does `navigator.storage.persist()` return `true` in the installed app?
4. Does the Files picker return a `.zip` as one file, and does `accept=".zip"` let the parent select it?
5. What is the real peak memory of one `decodeAudioData` call for a 4-minute Ogg file (decode plus resample)? Measure with the Web Inspector Timelines memory track on the iPhone.
6. Do Clone Hero `.opus` files use "mapping family" 0 (needed for WebKit 327697)?
7. Does a Bluetooth route change in the middle of a song damage the output, as AirPlay does in WebKit 325501?

## Sources

- https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event
- https://webaudio.github.io/web-audio-api/
- https://github.com/mdn/browser-compat-data (files `api/AudioContext.json`, `api/BaseAudioContext.json`, `api/AudioBuffer.json`, `api/AudioSession.json`, `api/StorageManager.json`, `api/FileSystemFileHandle.json`, `api/HTMLInputElement.json`, `api/PointerEvent.json`, `api/Element.json`, `api/Blob.json`, `api/DecompressionStream.json`, `api/GestureEvent.json`, `css/properties/touch-action.json`, `css/properties/-webkit-touch-callout.json`, `css/properties/user-select.json`)
- https://github.com/mdn/browser-compat-data/issues/26043
- https://github.com/Fyrd/caniuse/blob/main/features-json/ogg-vorbis.json
- https://github.com/Fyrd/caniuse/blob/main/features-json/opus.json
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
- https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
- https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- https://webkit.org/blog/15697/private-browsing-2-0/
- https://webkit.org/blog/14403/updates-to-storage-policy/
- https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- https://webkit.org/blog/5610/more-responsive-tapping-on-ios/
- https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webaudio/AudioContext.cpp
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webaudio/BaseAudioContext.cpp
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webaudio/AudioBuffer.h
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/cocoa/AudioDestinationCocoa.cpp
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/cocoa/MediaSessionManagerCocoa.mm
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/ios/AudioSessionIOS.mm
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/audio/cocoa/AudioFileReaderCocoa.mm
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/Performance.cpp
- https://commits.webkit.org/314462@main
- WebKit bugs: [168837](https://bugs.webkit.org/show_bug.cgi?id=168837), [188438](https://bugs.webkit.org/show_bug.cgi?id=188438), [189337](https://bugs.webkit.org/show_bug.cgi?id=189337), [199854](https://bugs.webkit.org/show_bug.cgi?id=199854), [204228](https://bugs.webkit.org/show_bug.cgi?id=204228), [214258](https://bugs.webkit.org/show_bug.cgi?id=214258), [227636](https://bugs.webkit.org/show_bug.cgi?id=227636), [231161](https://bugs.webkit.org/show_bug.cgi?id=231161), [240568](https://bugs.webkit.org/show_bug.cgi?id=240568), [268816](https://bugs.webkit.org/show_bug.cgi?id=268816), [271705](https://bugs.webkit.org/show_bug.cgi?id=271705), [272165](https://bugs.webkit.org/show_bug.cgi?id=272165), [272226](https://bugs.webkit.org/show_bug.cgi?id=272226), [273336](https://bugs.webkit.org/show_bug.cgi?id=273336), [279606](https://bugs.webkit.org/show_bug.cgi?id=279606), [280183](https://bugs.webkit.org/show_bug.cgi?id=280183), [306211](https://bugs.webkit.org/show_bug.cgi?id=306211), [316172](https://bugs.webkit.org/show_bug.cgi?id=316172), [319985](https://bugs.webkit.org/show_bug.cgi?id=319985), [320198](https://bugs.webkit.org/show_bug.cgi?id=320198), [322561](https://bugs.webkit.org/show_bug.cgi?id=322561), [323104](https://bugs.webkit.org/show_bug.cgi?id=323104), [325481](https://bugs.webkit.org/show_bug.cgi?id=325481), [325501](https://bugs.webkit.org/show_bug.cgi?id=325501), [327697](https://bugs.webkit.org/show_bug.cgi?id=327697), [328316](https://bugs.webkit.org/show_bug.cgi?id=328316), [328809](https://bugs.webkit.org/show_bug.cgi?id=328809)
- https://web.dev/articles/audio-output-latency
- https://stephencoyle.net/airpods-pro
- https://stephencoyle.net/airpods-pro-2
- https://rhythmquestgame.com/devlog/10.html
- https://github.com/ppy/osu-wiki/blob/master/wiki/Client/Options/en.md
- https://github.com/ppy/osu-wiki/blob/master/wiki/Client/Options/Offset_Wizard/en.md
- https://bgm.cotorano.com/blog/bluetooth-delay-web-rhythm-game-calibrate-offset/
- https://www.heise.de/en/news/Safari-browsing-with-ProMotion-Initially-deactivated-on-iPhone-Mac-Co-11174983.html
- https://9to5mac.com/2025/07/29/with-ios-26-safari-will-counter-one-of-the-webs-most-invasive-tracking-methods
- https://firt.dev/notes/pwa-ios/
- https://github.com/eshaz/wasm-audio-decoders
- https://www.npmjs.com/package/ogg-opus-decoder
- https://www.npmjs.com/package/@wasm-audio-decoders/ogg-vorbis
- https://github.com/101arrowz/fflate
- https://github.com/gildas-lormeau/zip.js
- https://github.com/dexie/Dexie.js/issues/1227
- https://github.com/EmulatorJS/EmulatorJS/issues/1220
- http://le.land/blog/ios-mobile-web-meta/
- Sister project (read only): `pile-pals/docs/agents/ios-device.md`, `pile-pals/src/sound/engine.ts`, `pile-pals/research/native-feel/shell.md`, `smart-games/.scratch/minigame-collection/research/pwa-route.md`, `smart-games/.scratch/minigame-collection/research/web-input-latency.md`
