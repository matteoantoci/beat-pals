# prepare-song in TypeScript

The Mac script `prepare-song` is TypeScript on Node, not Python, and it imports the chart reader from the game model. The game and the script then share one chart reader with one set of tests, and a later import of songs on the device needs no second reader. Beat This, the beat tracker in Python, is not in the MVP; if it comes back, it runs as a separate step that `prepare-song` calls.
