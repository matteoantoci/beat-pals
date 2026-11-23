# Chart formats: `notes.chart`, `notes.mid`, `song.ini`, audio

## Summary for Beat Pals

1. Both formats store notes in ticks. One tick-to-seconds function, built from the tempo map, serves both parsers. A `.chart` tempo is BPM x 1000. A `.mid` tempo is microseconds per quarter note.
2. Do not use `@tonejs/midi` for charts. It gives `note.time` in seconds with the tempo map applied, but it drops the text events of the `EVENTS` track and all SysEx events (open notes, tap notes). It can also split one instrument track into unnamed tracks. Use its parser dependency `midi-file` and the shared tick-to-seconds function.
3. Chart time and audio time differ by `delay` (`song.ini`, milliseconds) or `Offset` (`.chart`, seconds): audio position = chart time + delay. Higher `delay` makes notes later.
4. Child mode can get downbeats from the `BEAT` track (note 12 = first beat of a measure) when it exists. Each `.chart` file and each `.mid` file without `BEAT` gives downbeats from its time signatures and tempo map.
5. Play every audio stem in the folder at the same time from one start time. `song.ogg` alone is enough for one-stem charts.

## 1. Song folder

A `.mid` chart folder contains at minimum `notes.mid`, `song.ini`, and one audio file ([mid Format-Overview][mid-ov]). A `.chart` folder contains `notes.chart` and audio, and usually also `song.ini` ([chart Format-Overview][chart-ov]).

File selection rules:

- If more than one `.chart` file exists, prefer `notes.chart`. Then prefer names with the suffix `[Y]` or `[F]` over `[N]` or no suffix ([chart Format-Overview][chart-ov]).
- The `.mid` file must be MIDI type 1 with ticks-per-quarter resolution. Type 0, type 2, and SMPTE time are not supported ([mid Format-Overview][mid-ov]).
- Recommendation for Beat Pals: if a folder has both `notes.mid` and `notes.chart`, use `notes.mid` [UNVERIFIED: priority order in Clone Hero; the docs do not state it].

## 2. `notes.chart`

### 2.1 Syntax

Text file, similar to INI. Named sections in square brackets, each followed by a body in curly brackets ([chart Format-Overview][chart-ov]):

```
[SectionName]
{
  Key = Value1 Value2
}
```

- Each line is `<Key> = <Value[]>`. Values are separated by spaces.
- A quoted value can contain spaces. There are no escape characters. Strip only the first and the last quotation mark of a quoted value.
- Comments are not allowed in real files.
- Sections can be in any order. Ignore unknown sections. Only `[Song]` (for `Resolution`) and `[SyncTrack]` are required. A missing section equals an empty section.
- Events in one section should be in increasing tick order. Sort them anyway: out-of-order files exist ([chart Format-Overview][chart-ov]).
- Practical parser notes [UNVERIFIED: common practice, not in the spec]: files can start with a UTF-8 BOM, use CRLF line ends, and use tabs or spaces for indent. Trim each line.

### 2.2 Track events

Format: `<Position> = <TypeCode> <Value[]>`. `Position` is a tick (integer). Type codes ([chart Format-Overview][chart-ov]):

| Code | Meaning | Values |
|---|---|---|
| `B` | Tempo change | `<tempo>`: BPM x 1000, integer (`120000` = 120 BPM, `150325` = 150.325 BPM) |
| `TS` | Time signature | `<numerator> [<denominator exponent>]`; denominator = 2^exponent; default exponent 2 (x/4) |
| `A` | Tempo anchor | microseconds. Editor data only. Ignore it in a game. |
| `E` | Text event | text (global in `[Events]`, local in instrument sections) |
| `N` | Note or modifier | `<type> <length in ticks>` |
| `S` | Special phrase | `<type> <length in ticks>` (2 = Star Power) |
| `H` | Legacy hand position | ignore |

More than one event can be on the same tick.

### 2.3 `[Song]`

Named entries `Name = Value`. Important keys ([chart Format-Overview][chart-ov]):

| Key | Meaning | Type |
|---|---|---|
| `Resolution` | Ticks per quarter note. Required. Usually 192. | number |
| `Offset` | Start time of the audio, in seconds. A higher value makes the audio start sooner. | decimal |
| `Name`, `Artist`, `Charter` | Metadata | string |
| `PreviewStart`, `PreviewEnd` | Preview, in seconds | decimal |
| `MusicStream`, `GuitarStream`, `DrumStream`... | Audio file paths | quoted path |

The `song.ini` metadata has priority over the `[Song]` metadata ([chart Format-Overview][chart-ov]). Use `[Song]` for `Resolution` always.

### 2.4 `[SyncTrack]`

Contains `B` and `TS` (and `A`) events.

- If no `B` event is at tick 0, assume 120 BPM. If no `TS` event is at tick 0, assume 4/4 ([chart Format-Overview][chart-ov]).

### 2.5 `[Events]`

Global `E` events, for example `E "section Verse 1"`, `E "prc_chorus"`, `E "end"`. `end` marks the end of the song ([chart Format-Overview][chart-ov]).

### 2.6 Instrument sections

Name = `<Difficulty><Instrument>` ([chart 5-Fret Guitar][chart-gtr], [chart Drums][chart-drums]):

- Difficulties: `Easy`, `Medium`, `Hard`, `Expert`.
- Instruments: `Single` (lead guitar), `DoubleGuitar` (co-op), `DoubleBass` (bass), `DoubleRhythm` (rhythm), `Keyboard` (5-lane keys), `Drums`.
- Examples: `[EasySingle]`, `[ExpertSingle]`, `[HardDoubleBass]`, `[MediumDrums]`.

5-fret guitar `N` types ([chart 5-Fret Guitar][chart-gtr]):

| `N` type | Meaning |
|---|---|
| 0 | Green (lane 1) |
| 1 | Red (lane 2) |
| 2 | Yellow (lane 3) |
| 3 | Blue (lane 4) |
| 4 | Orange (lane 5) |
| 5 | Modifier: strum/HOPO flip (force). Not a note. |
| 6 | Modifier: tap. Not a note. |
| 7 | Open note (no fret) |

- A modifier applies to all notes on the same tick ([chart Format-Overview][chart-ov]).
- Notes on the same tick form a chord. Each note can have a different length.
- `<length>` 0 = no sustain.
- For Beat Pals: keep types 0 to 4 and 7, and drop 5 and 6. At bronze, silver, and gold, merge each chord into one hit. From platinum up, a chord becomes a double on 2 adjacent lanes; a chord on lanes 1 and 3 becomes 1 + 2 (README P12, open question 9).

Drums `N` types: 0 kick, 1 red, 2 yellow, 3 blue, 4 orange (5-lane) or green (4-lane), 5 green (5-lane) ([chart Drums][chart-drums]).

### 2.7 Tick to seconds (both formats)

Inputs: `resolution` (ticks per quarter note), and tempo events sorted by tick, each with `tick` and `bpm`. A tempo at tick 0 always exists (insert 120 BPM if it is missing).

Precompute the start time in seconds of each tempo segment:

$$t_0 = 0,\qquad t_k = t_{k-1} + \frac{\text{tick}_k - \text{tick}_{k-1}}{\text{resolution}} \cdot \frac{60}{\text{bpm}_{k-1}}$$

Then, for a tick in segment k (the last tempo with `tick_k <= tick`):

$$\text{seconds}(\text{tick}) = t_k + \frac{\text{tick} - \text{tick}_k}{\text{resolution}} \cdot \frac{60}{\text{bpm}_k}$$

This equals the method in `@tonejs/midi` `Header.update()` and `Header.ticksToSeconds()` ([Header.ts][tone-header]) and in YARG `TempoChange.TickToTime` ([TempoChange.cs][yarg-tempo]).

```ts
type Tempo = { tick: number; bpm: number; sec: number };

function buildTempoMap(raw: { tick: number; bpm: number }[], resolution: number): Tempo[] {
  const sorted = [...raw].sort((a, b) => a.tick - b.tick);
  if (sorted.length === 0 || sorted[0].tick !== 0) sorted.unshift({ tick: 0, bpm: 120 });
  const map: Tempo[] = [];
  for (const t of sorted) {
    const prev = map[map.length - 1];
    const sec = prev ? prev.sec + ((t.tick - prev.tick) / resolution) * (60 / prev.bpm) : 0;
    map.push({ ...t, sec });
  }
  return map;
}

function tickToSeconds(map: Tempo[], resolution: number, tick: number): number {
  let lo = 0, hi = map.length - 1;           // binary search: last tempo with tick <= tick
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (map[mid].tick <= tick) lo = mid; else hi = mid - 1;
  }
  const t = map[lo];
  return t.sec + ((tick - t.tick) / resolution) * (60 / t.bpm);
}
```

For `.chart`: `bpm = B value / 1000`. For `.mid`: `bpm = 60_000_000 / microsecondsPerBeat`, `resolution = ticksPerBeat` from the MIDI header.

A sustain end in seconds is `tickToSeconds(tick + length)`, not `length` converted alone, because a tempo can change inside the sustain.

### 2.8 Downbeats from time signatures

A `TS <n> <e>` event at tick `T` gives a beat length of `resolution * 4 / 2^e` ticks and a measure length of `n` beats. Measures start at `T`, `T + measureTicks`, and so on, until the next `TS` event. Convert each measure start with `tickToSeconds`. This is the fallback for strong beats when there is no `BEAT` track. [INFERENCE: from the `TS` definition in [chart Format-Overview][chart-ov]; the same rule applies to MIDI time signature meta events.]

### 2.9 Example `notes.chart`

```
[Song]
{
  Name = "Example Song"
  Artist = "Example Artist"
  Charter = "AutoChart"
  Resolution = 192
  Offset = 0
  MusicStream = "song.ogg"
}
[SyncTrack]
{
  0 = TS 4
  0 = B 120000
  768 = B 60000
}
[Events]
{
  0 = E "section Intro"
  3072 = E "end"
}
[EasySingle]
{
  768 = N 0 0
  960 = N 2 192
  1152 = N 1 0
  1152 = N 3 0
  1344 = N 7 0
}
[ExpertSingle]
{
  768 = N 0 0
  864 = N 1 0
  864 = N 5 0
  960 = N 2 0
  960 = N 6 0
  1056 = S 2 192
}
```

Worked times for `[EasySingle]` (resolution 192): tick 768 is at 768/192 x 60/120 = 2.0 s. The tempo changes to 60 BPM at 768. Tick 960 = 2.0 + 1 x 1.0 = 3.0 s. Its sustain ends at tick 1152 = 4.0 s. Tick 1152 is a chord (red + blue) at 4.0 s. Tick 1344 is an open note at 5.0 s.

## 3. `notes.mid`

### 3.1 File and tracks

- Standard MIDI File, type 1 ([mid Format-Overview][mid-ov]). Header field `ticksPerBeat` (division) is the resolution, usually 480 [UNVERIFIED: typical value].
- The first track holds the tempo map (set tempo meta `0xFF 0x51`, microseconds per quarter note) and time signatures (`0xFF 0x58`). This is the type 1 convention of the Standard MIDI File specification ([SMF spec][smf]). A safe parser reads tempo and time signature events from all tracks, as `@tonejs/midi` does ([Header.ts][tone-header]).
- Each track has a name in its track name meta event (`0xFF 0x03`), the first event of the track. Ignore unknown tracks ([mid Format-Overview][mid-ov]).

Track names:

| Track name | Content | Source |
|---|---|---|
| `PART GUITAR` | Lead guitar | [mid 5-Fret Guitar][mid-gtr] |
| `PART BASS` | Bass | [mid 5-Fret Guitar][mid-gtr] |
| `PART RHYTHM` | Rhythm guitar | [mid 5-Fret Guitar][mid-gtr] |
| `PART GUITAR COOP` | Co-op guitar | [mid 5-Fret Guitar][mid-gtr] |
| `PART KEYS` | 5-lane keys | [mid 5-Fret Guitar][mid-gtr] |
| `T1 GEMS` | Old GH1 lead guitar, same notes | [mid 5-Fret Guitar][mid-gtr] |
| `PART DRUMS` | Drums | [mid Drums][mid-drums] |
| `PART VOCALS` | Vocals and lyrics | [mid Vocals][mid-vox] |
| `EVENTS` | Global text events: `[section ...]`, `[end]`, `[coda]` | [mid Format-Overview][mid-ov] |
| `BEAT` | Beat markers | [mid Beats][mid-beat] |

### 3.2 5-fret notes per difficulty

Each difficulty uses one octave. The lowest note of the octave is lane 1 ([mid Format-Overview][mid-ov], [mid 5-Fret Guitar][mid-gtr]).

| Difficulty | Open* | Green | Red | Yellow | Blue | Orange | Force HOPO | Force strum |
|---|---|---|---|---|---|---|---|---|
| Easy | 59 | 60 | 61 | 62 | 63 | 64 | 65 | 66 |
| Medium | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 |
| Hard | 83 | 84 | 85 | 86 | 87 | 88 | 89 | 90 |
| Expert | 95 | 96 | 97 | 98 | 99 | 100 | 101 | 102 |

\* Notes 59/71/83/95 are open notes only when the track has the text event `[ENHANCED_OPENS]` (with or without brackets). Without it, these notes are animation data. Ignore them ([mid 5-Fret Guitar][mid-gtr]).

Special notes for all difficulties ([mid 5-Fret Guitar][mid-gtr]):

| Note | Meaning |
|---|---|
| 103 | Solo marker (old charts: Star Power) |
| 104 | Tap note marker |
| 105 / 106 | Player 1 / player 2 versus phrase |
| 116 | Star Power phrase |
| 120 to 124 | Big Rock Ending markers |
| 126 / 127 | Tremolo / trill lane |

Other mechanics ([mid 5-Fret Guitar][mid-gtr]):

- A note is a Note On / Note Off pair. A Note On with velocity 0 is a Note Off ([SMF spec][smf]); `midi-file` does this conversion ([midi-parser.js][midifile-parser]).
- A sustain shorter than a 1/12 step is cut off and becomes a normal note. `song.ini` `sustain_cutoff_threshold` can change this.
- Notes that are 10 ticks apart or less snap together into one chord in GH1/2 and Rock Band.
- Open notes and tap notes can also come from Phase Shift SysEx events: payload `'P' 'S' 0x00 <type=0x00> <difficulty 0..3 or 0xFF> <modifier 0x01 open | 0x04 tap> <value 1 start | 0 end>` ([mid Format-Overview][mid-ov]). For Beat Pals, an open note can become the middle lane, so read SysEx `0x01` if `[ENHANCED_OPENS]` is absent.

Drums (`PART DRUMS`), Expert: 96 kick, 97 red, 98 yellow, 99 blue, 100 green (4-lane) or orange (5-lane), 101 green (5-lane). Other difficulties are 12 lower for each step (Hard 84.., Medium 72.., Easy 60..). 110 to 112 are tom markers. 95 is Expert+ kick ([mid Drums][mid-drums], [mid Format-Overview][mid-ov]).

### 3.3 `BEAT` track and strong beats

The generic doc lists these notes ([mid Beats][mid-beat]):

| Note | Meaning |
|---|---|
| 12 | Measure beat |
| 13 | Strong beat |
| 14 | Weak beat |

The Rock Band doc lists ([RB Beat][rb-beat]):

| Note | Meaning |
|---|---|
| 12 | Strong beat: the first beat of a measure (downbeat) |
| 13 | Weak beat: other beats |

Answer for child mode: yes. Each note 12 in `BEAT` is a downbeat. Use note 12 as the downbeat, notes 12 and 13 as all beats, and ignore 14. The `BEAT` track is separate from the tempo and time signature, so it follows the song even when the time signatures are wrong ([mid Beats][mid-beat]).

Limits:

- `BEAT` is optional. Not all charts have it. AutoChart output contents of `BEAT` are [UNVERIFIED].
- A `BEAT` track from an automatic tool is only as good as that tool's beat tracking.
- Fallback: downbeats from time signatures (section 2.8), or every quarter note (beat = `resolution` ticks) when the time signature is unknown.
- Child mode idea [INFERENCE]: keep only chart notes that are within a small window (for example ±1/8 beat) of a beat from `BEAT`, then enforce the minimum gap.

### 3.4 `@tonejs/midi` evaluation

Facts from the source (version 2.0.0):

- `note.time` and `note.duration` are in seconds with the full tempo map applied: `time` calls `header.ticksToSeconds(this.ticks)`; `duration` subtracts two `ticksToSeconds` values ([Note.ts][tone-note], [Header.ts][tone-header]). `note.ticks`, `note.durationTicks`, and `note.midi` are also available ([README][tone-readme]).
- The tempo map: tempo and time signature events come from all tracks. `bpm = 60000000 / microsecondsPerBeat` ([Header.ts][tone-header]).
- `header.ppq` gives the resolution ([Header.ts][tone-header]).
- `track.name` comes from the track name meta event ([Track.ts][tone-track]).

Problems for chart files:

- Text events: `header.meta` collects `marker` and `lyrics` from all tracks, but `text` and `cuePoint` only from the first track ([Header.ts][tone-header]). Text events on `EVENTS` (`[section ...]`, `[end]`) and on instrument tracks (`[ENHANCED_OPENS]`) are lost.
- SysEx events are not exposed, so Phase Shift open/tap phrases are lost ([Track.ts][tone-track]).
- `splitTracks()` splits a track by MIDI channel and program. The track name event has no channel, so it stays in the first part. Other parts get the name `""` ([Midi.ts][tone-midi]). A `PART GUITAR` track with notes on more than one channel then loses notes under its name.
- The first track is removed when it has no notes ([Midi.ts][tone-midi]). This is harmless, because the tempo is already in `header`.

Recommendation: parse with `midi-file` (`parseMidi(bytes)`, the parser that `@tonejs/midi` uses; [README][tone-readme]). It gives each event with `deltaTime` and `type`, including `trackName`, `text`, `setTempo`, `timeSignature`, `noteOn`, `noteOff`, and `sysEx` ([midi-parser.js][midifile-parser]). Sum `deltaTime` for absolute ticks, then use the function in section 2.7. If the team uses `@tonejs/midi` anyway, read notes by track name and accept the losses above.

### 3.5 Example `notes.mid` (event listing)

MIDI is binary. This listing shows the events of a small type 1 file, resolution 480:

```
Header: format 1, 4 tracks, ticksPerBeat 480

Track 0 (tempo map)
  tick 0     trackName "Example Song"
  tick 0     timeSignature 4/4
  tick 0     setTempo 500000          // 120 BPM
  tick 1920  setTempo 1000000         // 60 BPM

Track 1
  tick 0     trackName "PART GUITAR"
  tick 0     text "[ENHANCED_OPENS]"
  tick 1920  noteOn 60 vel 100        // Easy green at 2.0 s
  tick 1930  noteOff 60
  tick 1920  noteOn 96 vel 100        // Expert green at 2.0 s
  tick 1930  noteOff 96
  tick 2400  noteOn 62 vel 100        // Easy yellow at 3.0 s
  tick 2880  noteOff 62               // sustain, ends at 4.0 s
  tick 2880  noteOn 59 vel 100        // Easy open (ENHANCED_OPENS present)
  tick 2890  noteOff 59

Track 2
  tick 0     trackName "EVENTS"
  tick 0     text "[section intro]"
  tick 7680  text "[end]"

Track 3
  tick 0     trackName "BEAT"
  tick 0     noteOn 12 / tick 120 noteOff 12   // downbeat, measure 1
  tick 480   noteOn 13 / tick 600 noteOff 13   // beat 2
  tick 960   noteOn 13 ...                      // beat 3
  tick 1440  noteOn 13 ...                      // beat 4
  tick 1920  noteOn 12 ...                      // downbeat, measure 2
```

Note: in a real file, events of one track are in tick order. The listing groups each note pair for clarity.

Times: tick 1920 at 120 BPM = 1920/480 x 0.5 = 2.0 s. The tempo is 60 BPM from tick 1920, so tick 2400 = 2.0 + 480/480 x 1.0 = 3.0 s, and tick 2880 = 4.0 s.

## 4. `song.ini`

### 4.1 Syntax

INI file with one section, `[song]` (often `[Song]`). Lines `key = value`. Keys are lowercase with underscores ([song.ini Standard Tags][ini-tags]). [UNVERIFIED: section-name case and file encoding rules; see [song.ini Format Overview][ini-ov]. Parse keys and the section name without case.]

### 4.2 Keys that matter

| Key | Meaning | Unit |
|---|---|---|
| `name` | Song title | string |
| `artist` | Artist | string |
| `charter` (`frets` = same, ignore it) | Chart author | string |
| `song_length` | Audio length. Metadata only; do not rely on it. | ms |
| `preview_start_time` / `preview_end_time` | Preview range | ms |
| `diff_guitar`, `diff_bass`, `diff_drums`, `diff_band`... | Difficulty of the track. `-1` = no track [UNVERIFIED: common convention]. | number |
| `delay` | Delays the chart relative to the audio. Higher = later notes. Can be negative. | ms |
| `sustain_cutoff_threshold` | `.mid` sustain cutoff | ticks |
| `hopo_frequency` | HOPO threshold | ticks |
| `album_track`, `genre`, `year`, `album` | Metadata | |
| `icon`, `background`, `cover` | Image file names | |

Source: [song.ini Standard Tags][ini-tags].

### 4.3 `delay` and `Offset`: sync

- `song.ini` `delay` (ms): "Higher = later notes" ([song.ini Standard Tags][ini-tags]).
- `.chart` `[Song] Offset` (seconds): "A higher value makes the audio start sooner" ([chart Format-Overview][chart-ov]). This is the same direction: the audio is ahead of the chart by `Offset`.
- YARG reads `Offset` from the `.chart` as the tag `delay_seconds` ([YARGChartFileReader.cs][yarg-chartreader]). It uses `delay` (ms) if it is present and not zero, else `delay_seconds` ([SongMetadata.cs][yarg-meta]).
- YARG sets `SongOffset = -delay` and computes chart time as `AudioTime = AudioPlaybackTime + SongOffset` ([SongRunner.cs][yarg-runner]).

Formula for Beat Pals:

```
delaySec = (ini.delay != 0 ? ini.delay / 1000 : chart.Offset ?? 0)
audioPosition = chartSeconds + delaySec
chartSeconds  = audioPosition - delaySec
```

Example: `delay = 500`. A note at chart time 2.0 s sounds at audio position 2.5 s. If `delay` is negative and a note maps to a negative audio position, start the audio late (silence before it) [INFERENCE].

In the game loop, compute the current chart time from the audio clock (`AudioContext.currentTime` minus the start time) minus `delaySec`, then compare it with the note times.

## 5. Audio files

Reserved file names. The extension can be `.ogg`, `.opus`, or `.mp3` ([Supported Audio Files][audio]):

| Name | Content |
|---|---|
| `song` | Background audio, or the main audio if it is the only file |
| `guitar` | Lead guitar, or the main audio if it is the only file |
| `rhythm` | Rhythm guitar, or bass if no rhythm track exists |
| `bass` | Bass |
| `keys` | Keys |
| `drums` | Drums as one stem. Ignore it if `drums_1`...`drums_4` exist. |
| `drums_1` ... `drums_4` | Kick, snare, toms, cymbals (lower numbers include the higher parts if those are absent) |
| `vocals` | Vocals as one stem. Ignore it if `vocals_1`/`vocals_2` exist. |
| `vocals_1`, `vocals_2` | Main and secondary vocals |
| `crowd` | Crowd noise |
| `preview` | Song select preview only. Do not mix it into the game. |
| `vocals_explicit*` | Explicit-lyric parts. Mix only when explicit lyrics are allowed. |

Formats: `.opus` (80 kbps, recommended), `.ogg` (Vorbis), `.mp3` ([Supported Audio Files][audio]). A `.chart` file can also name its files with `MusicStream`, `GuitarStream`, and others. Check the reserved names first, then the `[Song]` paths ([chart Format-Overview][chart-ov]).

Mix rule for Beat Pals [INFERENCE: from the stem definitions above]: start all stems except `preview` (and except the stems that a numbered set replaces) at the same audio time, at full volume. The stems together form the full song. The instrument stem of the played part (for example `guitar` for `PART GUITAR`) can be muted on a miss. Clone Hero and YARG do this for the played instrument [UNVERIFIED].

iOS note for the audio topic owner: Safari support for Ogg Vorbis and Opus in `decodeAudioData` is [UNVERIFIED] here; see `ios-pwa-audio.md`.

## Open questions

1. Does AutoChart.eu write a `BEAT` track, and do its downbeats match the music?
2. Which file wins in Clone Hero when a folder has both `notes.mid` and `notes.chart`?
3. Does iOS Safari decode `.ogg` (Vorbis) and `.opus` from the zip? If not, the import step must convert audio.
4. Does Clone Hero mute only the played instrument stem on a miss, or does it also lower other stems?
5. The two `BEAT` note maps (12/13 versus 12/13/14) differ. Real Clone Hero files must confirm note 12 = downbeat.

## Sources

- [chart-ov]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/chart-format/Format-Overview.md
- [chart-gtr]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/chart-format/Tracks/5-Fret-Guitar.md
- [chart-drums]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/chart-format/Tracks/Drums.md
- [mid-ov]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Format-Overview.md
- [mid-gtr]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Tracks/5-Fret-Guitar.md
- [mid-drums]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Tracks/Drums.md
- [mid-vox]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Tracks/Vocals.md
- [mid-beat]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Tracks/Beats.md
- [rb-beat]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Implementation-Specific/Rock-Band/MIDI-Tracks/Beat.md
- [ini-ov]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/song-ini/Format-Overview.md
- [ini-tags]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/song-ini/Standard-Tags.md
- [audio]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/Supported-Audio-Files.md
- [smf]: https://www.midi.org/specifications/file-format-specifications/standard-midi-files
- [tone-readme]: https://github.com/Tonejs/Midi/blob/master/README.md
- [tone-header]: https://github.com/Tonejs/Midi/blob/master/src/Header.ts
- [tone-note]: https://github.com/Tonejs/Midi/blob/master/src/Note.ts
- [tone-track]: https://github.com/Tonejs/Midi/blob/master/src/Track.ts
- [tone-midi]: https://github.com/Tonejs/Midi/blob/master/src/Midi.ts
- [midifile-parser]: https://github.com/carter-thaxton/midi-file/blob/master/lib/midi-parser.js
- [yarg-tempo]: https://github.com/YARC-Official/YARG.Core/blob/master/YARG.Core/Chart/Sync/TempoChange.cs
- [yarg-meta]: https://github.com/YARC-Official/YARG.Core/blob/master/YARG.Core/Song/Entries/Types/SongMetadata.cs
- [yarg-chartreader]: https://github.com/YARC-Official/YARG.Core/blob/master/YARG.Core/IO/YARGChartFileReader.cs
- [yarg-runner]: https://github.com/YARC-Official/YARG/blob/master/Assets/Script/Playback/SongRunner.cs

[chart-ov]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/chart-format/Format-Overview.md
[chart-gtr]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/chart-format/Tracks/5-Fret-Guitar.md
[chart-drums]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/chart-format/Tracks/Drums.md
[mid-ov]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Format-Overview.md
[mid-gtr]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Tracks/5-Fret-Guitar.md
[mid-drums]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Tracks/Drums.md
[mid-vox]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Tracks/Vocals.md
[mid-beat]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Tracks/Beats.md
[rb-beat]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Implementation-Specific/Rock-Band/MIDI-Tracks/Beat.md
[ini-ov]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/song-ini/Format-Overview.md
[ini-tags]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/song-ini/Standard-Tags.md
[audio]: https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/Supported-Audio-Files.md
[smf]: https://www.midi.org/specifications/file-format-specifications/standard-midi-files
[tone-readme]: https://github.com/Tonejs/Midi/blob/master/README.md
[tone-header]: https://github.com/Tonejs/Midi/blob/master/src/Header.ts
[tone-note]: https://github.com/Tonejs/Midi/blob/master/src/Note.ts
[tone-track]: https://github.com/Tonejs/Midi/blob/master/src/Track.ts
[tone-midi]: https://github.com/Tonejs/Midi/blob/master/src/Midi.ts
[midifile-parser]: https://github.com/carter-thaxton/midi-file/blob/master/lib/midi-parser.js
[yarg-tempo]: https://github.com/YARC-Official/YARG.Core/blob/master/YARG.Core/Chart/Sync/TempoChange.cs
[yarg-meta]: https://github.com/YARC-Official/YARG.Core/blob/master/YARG.Core/Song/Entries/Types/SongMetadata.cs
[yarg-chartreader]: https://github.com/YARC-Official/YARG.Core/blob/master/YARG.Core/IO/YARGChartFileReader.cs
[yarg-runner]: https://github.com/YARC-Official/YARG/blob/master/Assets/Script/Playback/SongRunner.cs
