# 프로젝트 요구사항

## 프로젝트 개요
- 수정 대상: `./front_yoo/` 디렉토리
- 유지사항: 오디오 피치 그래프 시각화 (왼쪽에 위치한 기존 오디오 시각화 기능 유지)

## 구현 단계

### 1단계: 모드 선택 기능 구현
- 위치: 왼쪽 상단
- 기능: 
  - 토글 버튼을 통한 모드 선택
  - 선택 가능한 옵션: Host Mode, Client Mode
  - 매핑 관계:
    - Host Mode → B (demoScripts.ts)
    - Client Mode → A (demoScripts.ts)

### 2단계: 음성 대화 시스템 구현
- 구현 로직:
  1. 1단계에서 선택된 모드(Host/Client) 적용
  2. `demoScripts.ts`의 텍스트 순차적 출력
  3. 음성 출력 (기존 오디오 시각화 방식 유지)
  4. 지정된 delay 시간 대기
  5. 선택된 모드에 따른 응답:
     - Host Mode: B 타입 응답
     - Client Mode: A 타입 응답
  6. delay 후 다음 대화 진행
