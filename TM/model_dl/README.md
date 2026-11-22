# TM/model_dl — 품질 2차 검사 DL 모델

주조 품질 2차 검사(이미지)용 DL 모델입니다. 1차 검사 ML 모델은 [../model_ml/](../model_ml/README.md).
**파일명 = 폴더명** (확장자만 다름).

## 받기 전에 — Git LFS 필수

`.onnx` 는 Git LFS 로 관리합니다 (루트 `.gitattributes` 의 `*.onnx` 규칙, GitHub 파일당 100MB 제한 때문).
LFS 없이 받으면 모델 대신 **포인터 텍스트(약 130바이트)** 만 생겨 불러올 때 형식 오류가 납니다.

```powershell
git lfs install   # PC당 한 번
git lfs pull      # 이미 clone 했다면 실제 모델 파일 받기
```

- 저장 용량·대역폭은 원본 저장소 소유자(DH) 계정 한도에서 빠짐 → **확정 모델만** 올리기
- 모델이 필요 없으면 `GIT_LFS_SKIP_SMUDGE=1` 로 clone 해 포인터만 받을 수 있음

## 명명 규칙

```text
DieCasting_{Algo}_{YYYYMMDD}_{NN}
예) DieCasting_CNXV2T_20261117_01
```

- `Algo`: CNXV2T (ConvNeXt V2 Tiny)
- `YYYYMMDD`: 학습·배치 날짜
- `NN`: 같은 Algo+날짜 안 순번 (01부터)

## 구이름 → 새이름

| 새 이름 | 구 이름 | 날짜 | 비고 |
|---------|---------|------|------|
| `DieCasting_CNXV2T_20261117_01` | `cnxv2-t_384_geo-photo_v1_261117_e2e.onnx` | 2026-11-17 | 구 이름 요소: 384 · geo-photo · v1 · e2e (의미는 TM 확인 필요) |
| `DieCasting_CNXV2T_20261117_02` | `cnxv2-t_384_none_v1_261120.onnx` | 2026-11-20 | 모델 A · 증강 없음 · 전처리 미포함 (비교 실험용) |
| `DieCasting_CNXV2T_20261117_03` | `cnxv2-t_384_geo-flip_v1_261120.onnx` | 2026-11-20 | 모델 C · 기하+뒤집기 · 전처리 미포함 (비교 실험용) |
| `DieCasting_CNXV2T_20261117_04` | `cnxv2-t_384_geo-photo-sensor_v1_261120.onnx` | 2026-11-20 | 모델 E · 기하+조명+센서 · 전처리 미포함 (비교 실험용) |

파일 이름만 바꿨으므로 **모델 가중치·성능은 동일**합니다.

## 경로

```text
TM/model_dl/
  DieCasting_*/                      # 폴더 = 모델명
    DieCasting_*.onnx                # 모델 (Git LFS)
    DieCasting_*_METRICS.md          # 평가지표·강건성·입력 해상도 영향
    DieCasting_*_robustness.csv      # 강건성 조건별 지표 (Model Management 등록용)
  README.md
```
