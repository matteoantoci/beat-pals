# Encrypted songs on a static host

The songs ship with the app on GitHub Pages, but each song file is encrypted with a family key (AES-GCM) on the Mac, and the parent enters the key one time on the iPhone. The song audio is for family use only, so it must not be published, but the parent wants the game to play on the iPhone with no Mac and no network. With encryption, the public files are random data, and the host needs no server code. A future reader can expect a plain asset folder or a login; this design is deliberate.

## Considered Options

- Mac dev server on home Wi-Fi: no publication, but the game plays only when the Mac is on and near.
- Import of a zip on the iPhone: no publication, but the parent repeats a manual import for each new song.
- Private Wasabi bucket with a read-only key (decision 14): automatic, but more setup. It can come later.
- Cloudflare Worker with a key check: the Worker does not run for a static asset unless `run_worker_first` covers the songs, so one wrong setting makes the songs public. It also needs a second provider.
- Public songs with no lock: the simplest, but it publishes the song audio.

## Consequences

- The songs never go into git, so a GitHub Action cannot build the site. The parent deploys from the Mac, and a gate checks the build for plain media before the push. The gate does not search for song titles, because a text match is too fragile (parent decision of 2026-11-23).
- One public repository holds the source on `master` and the built site on an orphan `gh-pages` branch. `deploy` force-pushes that branch as one commit. No file in git names a song: the song list, the song notes, and the prototypes stay in `.scratch/`, which git ignores.
- File names come from a hash keyed with the family key, so a public name does not confirm a known song, and a new key renames every file.
- The songs stay out of the service worker precache and download in a separate step with progress, because one large install on iOS has no progress and fails as a whole.
- A lost family key means a new key, a new deploy, and a new key entry on the iPhone.
