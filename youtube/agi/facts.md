# 「인류의 마지막 발명」 사실 확인 노트

화면 글자에는 이 문서에 있는 것만 써요.
- **[1차]** 당사자가 직접 낸 자료
- **[2차]** 언론·위키·요약
- **[판단]** 이 채널의 관점이에요. 꼬리표 없이 문장으로 말해요(「우리는 본다」, 「우리는 이것을 AGI라고 본다」).

## 정의
| 내용 | 출처 |
|---|---|
| OpenAI 헌장: AGI = "highly autonomous systems that outperform humans at most economically valuable work", 사명 = AGI가 "benefits all of humanity" | [1차] https://openai.com/charter/ (검색 캐시로 문구 확인) |
| Anthropic: "We aim to build frontier AI systems that are reliable, interpretable, and steerable." | [1차] https://www.anthropic.com/company |

## 예언
| 내용 | 출처 |
|---|---|
| I. J. 굿, 1965, *Advances in Computers* 6권: "Thus the first ultraintelligent machine is the last invention that man need ever make, provided that the machine is docile enough to tell us how to keep it under control." | [2차] https://quoteinvestigator.com/2022/01/04/ultraintelligent/ |

## 역사 (널리 확인된 사실)
- 1950 앨런 튜링, 「Computing Machinery and Intelligence」: "Can machines think?"
- 1956 다트머스 여름 연구 프로젝트: 인공지능이 하나의 연구 분야로 시작됨 (이름은 1955년 제안서에 처음 등장)
- 1958 로젠블랫의 퍼셉트론
- AI 겨울: 1970년대, 1980년대 후반
- 1997년 5월 딥블루가 카스파로프에게 승리
- 2012 AlexNet: 이미지넷에서 딥러닝 돌파
- 2017 「Attention Is All You Need」: 트랜스포머
- 2022-11-30 ChatGPT 공개. 5일 만에 사용자 100만 명 (샘 올트먼, 2022-12-05)
- 2023-03 GPT-4: 모의 변호사 시험 상위 약 10%
- 2024-09 OpenAI o1: 추론 모델

## 알파고
| 내용 | 출처 |
|---|---|
| 2016년 3월 서울, 알파고가 이세돌에게 4:1 승리. 전 세계 2억 명 이상 시청 | [1차] https://deepmind.google/research/alphago/ |
| 제2국 37수: "a 1 in 10,000 chance of being used", "upended centuries of traditional wisdom". 해설자들은 처음에 이상한 수로 봤음 | [1차] 같은 페이지, [2차] https://en.wikipedia.org/wiki/Lee_Sedol |
| 제4국 78수(이세돌): "Known as 'God's Touch'", 구리 9단이 "divine move"라 부름. 이세돌이 이 대국에서 거둔 유일한 승리 | [1차] 같은 페이지, [2차] 위키백과 |

## 2025~2026 내부 모델
| 내용 | 출처 |
|---|---|
| 2025-07 국제수학올림피아드: Gemini Deep Think가 공식 채점으로 금메달 수준(35/42). OpenAI 실험 모델도 같은 점수를 주장 | [2차] https://simonwillison.net/2025/Jul/21/gemini-imo/ |
| 2026-04-07 Anthropic, Claude Mythos Preview를 일반 공개하지 않고 Project Glasswing을 통해 방어 기관에만 제공 | [1차] https://www.anthropic.com/glasswing |
| Mythos Preview가 "thousands of high-severity vulnerabilities"를 찾았고, 모든 주요 OS와 브라우저에서 발견됨. 27년 된 OpenBSD 취약점 포함 | [1차] 같은 페이지 |
| AI 모델이 "can surpass all but the most skilled humans at finding and exploiting software vulnerabilities" | [1차] 같은 페이지 |
| 2026-05-20 OpenAI 범용 추론 모델이 에르되시의 1946년 단위 거리 추측을 반증. 같은 날 Alon, Bloom, Gowers, Litt, Sawin이 사람이 검증한 요약을 게시 | [2차] https://techcrunch.com/2026/05/20/openai-claims-it-solved-an-80-year-old-math-problem-for-real-this-time/, [1차 링크] https://openai.com/index/model-disproves-discrete-geometry-conjecture/ (403으로 직접 열람 불가) |
| 2026-08-01 OpenAI 차기 모델 "아스트라" 내부 버전이 10년 이상 미해결이던 수학·이론전산 문제 10개를 해결. 전부 Lean 4 인증서 공개. 대표 결과는 최초의 명시적 non-sofic 군 구성. 총 비용 약 2천 달러. Thomas Bloom이 "big news"라 평가 | [2차] https://thenextweb.com/news/openai-astra-model-ten-math-proofs-non-sofic-groups, [1차 링크] https://openai.com/index/ten-advances-in-mathematics/ |
| 2026-09-06 GPT-6 아스트라, 2026학년도 수능 문제 기반 AI 평가에서 450점 만점(인터넷 차단). 공식 시험이 아니라 개인이 GitHub에 공개한 평가이고, 학습 데이터 노출 가능성이 있음 | [2차] https://www.koreatimes.co.kr/business/tech-science/20260907/gpt-6-astra-aces-korean-college-entrance-exam, https://www.aitimes.com/news/articleView.html?idxno=214896 |
| 2026-09-08(현지) OpenAI, 공개하지 않은 내부 모델(8월 말부터 학습)이 클레이 7대 밀레니엄 난제 중 나비에–스토크스 문제를 풀었다고 발표. 방정식이 시간이 지나면 깨질 수 있음(blow-up)을 보였다는 주장. 프로젝트 시작 약 88시간 만에 도달, 마지막 단계에 AI 에이전트 최대 1만 개 동시 투입. 상금 100만 달러는 청구하지 않겠다고 밝힘. **동료 심사·학계 검증 전**이고 우선권 논쟁(Buckmaster·Alpoge)이 있음. 클레이 연구소 브리드슨 소장: 평가는 "deliberately unhurried" | [2차] https://www.thestar.com.my/tech/tech-news/2026/09/09/openai-says-ai-solved-one-of-math039s-hardest-problems-in-days (Bloomberg 전재), https://imnews.imbc.com/news/2026/world/article/6850646_36925.html, https://www.washingtonpost.com/technology/2026/09/09/openai-claims-it-solved-elusive-math-problem-with-1-million-prize/, [1차 링크] https://openai.com/index/navier-stokes-solution/ (403으로 직접 열람 불가) |
| OpenAI는 자동화된 AI 연구자를 명시적 목표로 삼음 (2026-07 사후 학습 자동화 사례) | [2차] https://www.technologyreview.com/2026/08/18/1142188/ai-recursive-self-improvement/ |

## 아모데이, 「Machines of Loving Grace」 (2024년 10월)
| 내용 | 출처 |
|---|---|
| "a 'country of geniuses in a datacenter'" | [1차] https://www.darioamodei.com/essay/machines-of-loving-grace |
| "I think it could come as early as 2026, though there are also ways it could take much longer." | [1차] 같은 글 |
| 강력한 AI: "smarter than a Nobel Prize winner across most relevant fields" | [1차] 같은 글 |
| 생물학 진보 50~100년을 5~10년으로 압축: "compressed 21st century" | [1차] 같은 글 |

## 이 채널의 판단 (꼬리표 없이 문장으로)
- AGI는 2026년 내부 모델 수준에서 이미 도착했다.
- ASI는 1~2년 안에 온다.
- 일반 공개 모델의 한계는 다루지 않는다. 영상의 초점은 최전선 내부 모델이다.
