// 판정 결과 소리 — 효과음(Web Audio 로 생성) + 한국어 음성(브라우저 내장 TTS). 음원 파일·패키지 없음
export type SoundStatus = "pass" | "fail" | "check";

// 통과 = 올라가는 두 음, 위반 = 내려가는 거친 두 음, 판정 불가 = 짧은 한 음
const TONES: Record<SoundStatus, number[]> = { pass: [880, 1320], fail: [440, 330], check: [660] };

// 페이지에 하나만 (재생마다 만들면 브라우저 AudioContext 개수 한도에 걸림)
let ctx: AudioContext | undefined;

/** 「소리 켜기」 클릭 때 호출 — 브라우저 자동 재생 차단은 사용자 클릭 안에서만 풀림 */
export function unlockSound() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch (e) {
    console.error("[ppe_violation] 효과음 초기화 실패 (음성만 재생)", e);
  }
}

/** 효과음 후 음성 안내. 이전 음성은 끊고 최신 판정만 읽음 */
export function playResult(status: SoundStatus, text: string) {
  const c = ctx;
  if (c) {
    TONES[status].forEach((hz, i) => {
      const t = c.currentTime + i * 0.18;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = status === "fail" ? "square" : "sine";
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.17); // 멈춘 노드는 브라우저가 회수
    });
  }
  if (!("speechSynthesis" in window)) return;
  // 한국어 음성이 없는 기기면 효과음만 (목록이 아직 비어 있으면 브라우저 기본에 맡김)
  const voices = speechSynthesis.getVoices();
  if (voices.length && !voices.some((v) => v.lang.toLowerCase().startsWith("ko"))) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  setTimeout(() => speechSynthesis.speak(u), 380); // 효과음 끝난 뒤
}
