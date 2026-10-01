# 부산 공영주차장 · HTML / CSS / JS / Pages Functions

이 ZIP의 파일을 GitHub 저장소 최상위에 업로드하세요.

```text
index.html
css/
  style.css
js/
  app.js
functions/
  api/
    parking.js
.gitignore
README.md
```

- `index.html`: 화면 구조
- `css/style.css`: 디자인과 모바일 화면
- `js/app.js`: 검색, 정렬, 표시, 5분 간격 갱신
- `functions/api/parking.js`: 서버 API 호출과 데이터 검증. `/api/parking`으로 연결됩니다.

별도 프레임워크, package.json, 빌드 스크립트가 없는 기본 구성입니다. 첨부 JSON 응답은 Function 안에 스냅샷으로 들어 있습니다. 인증키는 포함되어 있지 않습니다.

## Cloudflare + GitHub 연결

1. GitHub에 새 저장소를 만들고 위 파일을 올립니다. `index.html`이 저장소 최상위에 있어야 합니다.
2. Cloudflare → Workers & Pages → Create application → **Pages** → Git 저장소 연결을 선택합니다.
3. 다음 설정으로 배포합니다.

| 항목 | 값 |
| --- | --- |
| Framework preset | None |
| Production branch | main |
| Build command | `exit 0` |
| Build output directory | `.` |
| Root directory | 저장소 최상위(비워두기) |

GitHub의 main 브랜치에 새 변경사항을 올리면 Cloudflare Pages가 자동으로 배포합니다.
이전 Workers 프로젝트의 `npm test` / `wrangler deploy` 설정은 이번 구성에 사용하지 않습니다.

Function을 함께 배포하려면 Git 연동 또는 Wrangler를 사용합니다. Cloudflare 대시보드에 ZIP을 드래그하는 Direct Upload는 Functions를 지원하지 않습니다.

공식 안내: [정적 HTML 배포](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/), [Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/).

## API 설정

Pages 프로젝트 → **Settings → Variables and Secrets**에서 설정한 뒤 새로 배포합니다. Production과 Preview는 별도 환경입니다.

| 이름 | 종류 | 값 |
| --- | --- | --- |
| `BUSAN_SERVICE_KEY` | Secret(Encrypt) | 공공데이터포털 일반 인증키(Decoding) |
| `BUSAN_REALTIME_URL` | 일반 변수 | 실시간 잔여면 조회 주소 |
| `BUSAN_CATALOG_URL` | 일반 변수 | 주차장 코드·이름 조회 주소 |

주소에는 인증키를 넣지 않습니다. Function이 `serviceKey`, `resultType=json`, `pageNo`, `numOfRows`를 붙입니다. API 호스트는 `apis.data.go.kr`만 허용하고 HTTPS로 요청합니다.

기본정보 주소는 Function에 이미 설정되어 있습니다:

`https://apis.data.go.kr/6260000/BusanPblcPrkngInfoService/getPblcPrkngInfo`

공식 안내: [Pages 변수와 Secret](https://developers.cloudflare.com/pages/functions/bindings/#secrets).

## 현재 상태

실시간 조회 URL이 아직 없어 **첨부 응답 미리보기**로 동작합니다. 화면의 잔여면을 현재 실시간 수치로 오해하지 않도록 안내합니다. 실제 API 연결과 Cloudflare 배포는 아직 확인하지 않았습니다.

첨부 50개 주차장을 검색·정렬하고 만차 여부를 표시합니다. null·음수·총면수 0·합계 불일치는 정보 확인 필요로 표시하고 집계에서 제외합니다. 15분 이상 지난 갱신 시각은 지연으로 표시합니다.

실시간 코드와 기본정보 관리번호는 별개입니다. 기본정보는 이름을 정규화한 뒤 유일하게 일치할 때만 연결합니다. 지도 링크는 이름 검색이며 검증된 좌표가 아닙니다.

서버 메모리 캐시는 실시간 5분, 목록·기본정보 24시간입니다. 인스턴스마다 별개이므로 전역 API 호출량 제한을 보장하지 않습니다.

## 로컬 실행(선택)

Node.js가 설치된 PC에서 프로젝트 폴더를 열고 실행합니다:

```sh
npx wrangler@4 pages dev .
```

터미널에 표시된 주소로 접속합니다. HTML 파일을 더블클릭하면 Function이 실행되지 않습니다.
로컬에서 API를 연결하려면 최상위에 `.dev.vars` 파일을 만들고 다음 값을 입력합니다. 이 파일은 GitHub에 올리지 않습니다.

```dotenv
BUSAN_SERVICE_KEY="발급받은 Decoding 인증키"
BUSAN_REALTIME_URL="실시간 조회 주소"
BUSAN_CATALOG_URL="목록 조회 주소"
```
