# 「인류의 마지막 발명」

음악과 화면 글자로 전달하는 AGI·ASI 다큐멘터리예요. 그림은 전부 WebGL 셰이더로 그리고, 음악은 파이프 오르간을 numpy로 직접 합성해요.

## 내 PC에서 GPU로 렌더링하기 (가장 빠른 방법)
그래픽카드가 있는 PC라면 클라우드보다 수십~수백 배 빨라요. 클라우드는 GPU 없이 프레임당 2~3초가 걸려요.

**필요한 것:** Node.js 18 이상, Git, ffmpeg, Google Chrome

```bash
git clone https://github.com/gosu95634-tech/codex-test.git
cd codex-test
git checkout claude/cloud-usage-guide-6lllki
node youtube/agi/render-local.mjs
```

- 다 끝나면 **바탕화면에 `인류의 마지막 발명.mp4`**가 생겨요.
- 옵션
  - `--chunks 3`: 동시에 돌릴 렌더 수
  - `--from 0 --to 40`: 일부 구간만 렌더링
- 렌더러가 GPU를 잡았는지는 로그의 `renderer:` 줄로 확인해요. `SwiftShader`라고 나오면 GPU를 못 잡은 거예요.

Claude Code를 PC에서 쓰고 있다면 그 세션에 "codex-test의 youtube/agi/render-local.mjs 실행해 줘"라고만 하면 돼요.

## 구조
- `film/shaders.js`: 장면 셰이더(하늘의 존재, 궤도, 계단, 바둑판, 우주)와 HDR 후처리
- `film/gl.js`: WebGL2 파이프라인(블룸, 갓레이, ACES, 그레인, 레터박스)
- `film/timeline.js`: 시간별 장면, 카메라, 자막
- `film/render.js`: 프레임 렌더러 (`--gpu`이면 그래픽카드 사용)
- `audio/organ.py`: 파이프 오르간, 종, 대성당 잔향 합성
- `audio/master.sh`: 음악을 `audio/score.m4a`로 마스터링 (-15 LUFS)
- `facts.md`: 영상에 쓴 사실과 출처
- `script.md`: 대본
- `data/`: 알파고 대 이세돌 2·4국 기보
