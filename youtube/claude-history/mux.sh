#!/usr/bin/env bash
# Two-pass loudnorm mux of <base>.video.mp4 + <base>.wav -> <out>.
# usage: ./mux.sh out/amodei.mp4
set -euo pipefail
cd "$(dirname "$0")"
out=$1; base=${out%.mp4}
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
echo "muxed $out"
