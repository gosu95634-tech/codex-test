#!/usr/bin/env bash
# usage: ./build.sh film/cues-test.json out/test.mp4
set -euo pipefail
cd "$(dirname "$0")"
cues=$1; out=$2; base=${out%.mp4}
mkdir -p "$(dirname "$out")"
./assets/fonts/fetch.sh >/dev/null
python3 audio/synth.py "$cues" "$base.wav"
NODE_PATH=${NODE_PATH:-$(npm root -g)} node film/render.js "$cues" "$base.video.mp4"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$base.video.mp4")
ffmpeg -y -loglevel error -i "$base.video.mp4" -i "$base.wav" \
  -filter_complex "[1:a]atrim=0:${dur},loudnorm=I=-14:TP=-1.0:LRA=9,aresample=48000[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -movflags +faststart "$out"
echo "built $out"
