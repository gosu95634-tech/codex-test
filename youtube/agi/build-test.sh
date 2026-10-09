#!/usr/bin/env bash
# 40 s cold-open test: organ score + two parallel render chunks + two-pass loudnorm mux.
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH=${NODE_PATH:-$(npm root -g)}
mkdir -p out
python3 audio/organ.py coldopen_soft out/coldopen.wav
node film/render.js out/co.part0.mp4 --from 0 --to 20 > out/co.part0.log 2>&1 &
p0=$!
node film/render.js out/co.part1.mp4 --from 20 --to 40 > out/co.part1.log 2>&1 &
p1=$!
wait $p0; wait $p1
printf "file '%s'\nfile '%s'\n" "$(realpath out/co.part0.mp4)" "$(realpath out/co.part1.mp4)" > out/co.parts.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i out/co.parts.txt -c copy out/co.video.mp4
st=$(ffmpeg -hide_banner -nostats -i out/coldopen.wav -af "loudnorm=I=-15:TP=-1.5:LRA=14:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$st" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -y -loglevel error -i out/co.video.mp4 -i out/coldopen.wav -filter_complex \
  "[1:a]loudnorm=I=-15:TP=-1.5:LRA=14:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 320k -shortest -movflags +faststart out/coldopen-test.mp4
echo "built out/coldopen-test.mp4"
