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

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$base.video.mp4")
stats=$(ffmpeg -hide_banner -nostats -i "$base.wav" -af "atrim=0:${dur},loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$stats" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_i'])")
mtp=$(echo "$stats" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_tp'])")
mlra=$(echo "$stats" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_lra'])")
mth=$(echo "$stats" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_thresh'])")
off=$(echo "$stats" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['target_offset'])")
ffmpeg -y -loglevel error -i "$base.video.mp4" -i "$base.wav" \
  -filter_complex "[1:a]atrim=0:${dur},afade=t=out:st=$(python3 -c "print($dur-0.6)"):d=0.6,loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true,aresample=48000[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 320k -movflags +faststart "$out"
echo "built $out"
