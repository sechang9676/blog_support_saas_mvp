# GoGIF

블로그용 영상 파일을 브라우저에서 바로 GIF로 바꾸는 웹앱입니다.  
여러 파일을 한 번에 올리고, 결과 GIF를 개별 다운로드하거나 ZIP으로 묶어 받을 수 있습니다.

## 핵심 기능

- 여러 영상 동시 업로드
- 파일별 메타데이터 검사
- 최대 100MB, 최대 30초 제한
- 가로 폭(px)과 FPS 조절
- GIF 결과를 20MB 이하로 자동 최적화
- 변환 완료 후 ZIP 다운로드
- 브라우저 안에서 `ffmpeg.wasm` 실행

## 실행 방법

로컬에서 테스트할 때는 `index.html`을 웹서버로 열어야 합니다.

```bash
python -m http.server 8000
```

그다음 브라우저에서 `http://localhost:8000`을 열면 됩니다.

## GitHub에 올리기

이 폴더를 git 저장소로 초기화한 뒤 GitHub에 연결하면 됩니다.

```bash
git init -b main
git add .
git commit -m "Initial GoGIF web app"
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Vercel 배포

1. GitHub에 올린 뒤 Vercel에서 `New Project`를 누릅니다.
2. 방금 만든 GitHub 저장소를 연결합니다.
3. 별도 빌드 설정 없이 그대로 배포합니다.

이 프로젝트는 정적 웹앱이라서 `index.html`이 루트에 있으면 바로 배포 가능합니다.

## 참고

- `app.py`는 예전 파이썬 프로토타입입니다.
- 실제 서비스용 웹 버전은 `index.html`, `main.js`, `styles.css`입니다.
- `ffmpeg.wasm`과 `JSZip`은 브라우저에서 로드됩니다.
- 변환 품질은 입력 영상 길이와 원본 화질에 따라 달라질 수 있습니다.
