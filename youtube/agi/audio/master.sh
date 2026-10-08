#!/usr/bin/env bash
# Synthesize a score and master it to audio/score.m4a (two-pass loudnorm, AAC 320k) for render-local.mjs.
# usage: ./audio/master.sh film            # the full 540 s film score (audio/film_score.py)
#        ./audio/master.sh coldopen_soft   # any score name from audio/organ.py
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
if [ "$1" = "film" ]; then
  python3 audio/film_score.py out/score.wav
  LRA=30   # wide enough that loudnorm stays linear and the long-form dynamics survive
else
  python3 audio/organ.py "$1" out/score.wav
  LRA=14
fi
st=$(ffmpeg -hide_banner -nostats -i out/score.wav -af "loudnorm=I=-15:TP=-1.5:LRA=$LRA:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$st" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -y -loglevel error -i out/score.wav -af "loudnorm=I=-15:TP=-1.5:LRA=$LRA:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -c:a aac -b:a 320k audio/score.m4a
echo "mastered audio/score.m4a"
