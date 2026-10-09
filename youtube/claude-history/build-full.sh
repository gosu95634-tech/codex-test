#!/usr/bin/env bash
# Full film: cues -> score -> parallel frame render -> concat -> two-pass loudnorm mux.
# usage: ./build-full.sh [out/amodei.mp4] [chunks=3]
set -euo pipefail
cd "$(dirname "$0")"
out=${1:-out/amodei.mp4}; chunks=${2:-3}; base=${out%.mp4}
mkdir -p "$(dirname "$out")"
export NODE_PATH=${NODE_PATH:-$(npm root -g)}
./assets/fonts/fetch.sh >/dev/null
python3 film/make_cues.py
python3 audio/synth.py film/cues-full.json "$base.wav"

fps=60
frames=$(python3 -c "import json;c=json.load(open('film/cues-full.json'));print(round(c['beats']*60/c['bpm']*$fps))")
per=$(( (frames + chunks - 1) / chunks ))
pids=()
for ((i=0; i<chunks; i++)); do
  f0=$(( i * per )); f1=$(( (i + 1) * per < frames ? (i + 1) * per : frames ))
  node film/render.js film/cues-full.json "$base.part$i.mp4" --from "$(python3 -c "print($f0/$fps)")" --to "$(python3 -c "print($f1/$fps)")" > "$base.part$i.log" 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
: > "$base.parts.txt"
for ((i=0; i<chunks; i++)); do echo "file '$(realpath "$base.part$i.mp4")'" >> "$base.parts.txt"; done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$base.parts.txt" -c copy "$base.video.mp4"

./mux.sh "$out"
echo "built $out"
