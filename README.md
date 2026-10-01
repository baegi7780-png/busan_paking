# 부산 주차 현황 · 개선 버전

HTML / CSS / JS / Cloudflare Pages Functions 구성입니다. 별도 프레임워크나 빌드 패키지가 없습니다.

## 적용 순서

1. ZIP 안의 파일과 폴더를 기존 GitHub 프로젝트 최상위에 덮어씁니다. 새 파일도 모두 추가합니다.
2. 커밋한 뒤 GitHub에 Push합니다. Pages가 자동 배포합니다.
3. 기존 Production의 BUSAN_SERVICE_KEY Secret은 유지합니다. API 주소 변수도 유지할 수 있습니다.
4. 아래 PARKING_CACHE KV 바인딩을 연결한 뒤 한 번 더 배포합니다.
5. 사이트에서 Ctrl+Shift+R로 새로고침합니다.

커밋 메시지:

```text
feat: 주차 정보 신뢰성 및 지역 검색·지도·공유 캐시 개선
```

## Cloudflare Pages 설정

| 항목 | 값 |
| --- | --- |
| Framework preset | None |
| Production branch | main |
| Build command | exit 0 |
| Build output directory | . |
| Root directory | 저장소 최상위 |

Git 연동 또는 Wrangler로 배포합니다. 대시보드 ZIP 드래그 Direct Upload는 Functions를 함께 배포하지 않습니다.

## 공유 캐시 연결: 한 번만 설정

1. Cloudflare의 **Storage & databases → KV**에서 namespace를 생성합니다. 예: busan-parking-cache.
2. **Workers & Pages → busan-paking Pages 프로젝트 → Settings → Bindings → Add → KV namespace**로 이동합니다.
3. Variable name에 **PARKING_CACHE**를 입력합니다.
4. namespace는 방금 만든 **busan-parking-cache**를 선택합니다.
5. Production 환경에 저장한 뒤 다시 배포합니다. Preview를 쓸 때는 별도 namespace를 권장합니다.

**PARKING_CACHE는 텍스트 변수나 Secret이 아닙니다. KV namespace 바인딩입니다.**
KV를 연결하지 않아도 작동하지만 캐시는 각 서버 인스턴스에만 남습니다. 서버가 재시작해도 최근 정상 조회 정보를 유지하려면 KV가 필요합니다.

공식 안내: [Pages KV 바인딩](https://developers.cloudflare.com/pages/functions/bindings/#kv-namespaces).

배포 후 /api/parking 응답의 cacheMode가 shared-kv면 해당 응답에서 KV 읽기·쓰기가 정상 동작했습니다. instance면 바인딩 누락 또는 KV 작업 실패로 인스턴스 캐시를 사용합니다. 일부 요청만 확인해서 계정 전체 상태를 보장할 수는 없습니다.

## API 환경 변수

Pages 프로젝트의 Settings → Variables and Secrets에 설정합니다.

| 이름 | 종류 | 값 |
| --- | --- | --- |
| BUSAN_SERVICE_KEY | Secret(Encrypt) | 공공데이터포털 Decoding 인증키 문자열만 |
| BUSAN_REALTIME_URL | Text, 선택 | https://apis.data.go.kr/B552587/ParkingInfoService_v2/getParkingInfoList_v2 |
| BUSAN_CATALOG_URL | Text, 선택 | https://apis.data.go.kr/B552587/ParkingInfoService_v2/getParkingList_v2 |

조회 주소는 이번 버전에 기본값이 들어 있습니다. 인증키만 필수입니다. 특정 코드로 제한하는 pParkGCd 조건은 제거하고 전체 목록을 요청합니다. serviceKey와 JSON 형식, 페이지 번호는 서버가 붙입니다. 인증키는 소스에 넣지 않습니다.

## 개선한 동작

- 검색창을 위로 이동하고 모바일 제목·통계 공간을 줄였습니다.
- 주차장 이름·주소·코드 검색, 구·군 필터, 상태 필터, 정렬을 제공합니다.
- 통계는 현재 검색 결과 기준입니다. 전체 실시간 제공 범위도 따로 안내합니다.
- 15분 이상 지난 정보, 미래 시각, 시각 미제공, API 장애로 보관 정보를 쓰는 경우는 현재 잔여면으로 표시하거나 집계하지 않습니다.
- 최근 정상 조회 정보가 있으면 장애 때 그대로 유지하고 최근 수치임을 표시합니다. 고정 첨부 데이터로 되돌아가지 않습니다.
- KV에 최근 정상 응답을 7일 보관합니다. 각 응답의 최신성은 실제 데이터 갱신 시각으로 판단합니다.
- 조회 실패 후 5분 재시도 대기, 호출량 초과(22)는 1시간 대기합니다.
- 같은 인스턴스에서 동시에 들어온 중복 조회를 합쳐 처리합니다.
- 기본정보는 관리기관·관리번호·이름을 대조한 코드별 연결표를 사용합니다. 검토한 연결은 36개이며 모호한 주차장은 임의로 연결하지 않습니다.
- 원본에 구·군만 있으면 상세 주소로 표시하지 않습니다.
- 지도는 원본 위도·경도가 부산 범위 안인 항목만 표시합니다. 지도 버튼을 누를 때만 Leaflet과 지도 타일을 불러옵니다.
- 원본 좌표가 있는 항목은 Kakao 위치 보기·길찾기, 없는 항목은 주소 또는 이름 검색만 제공합니다.
- 펼쳐둔 상세정보와 카드 내부 키보드 포커스를 검색·자동 갱신 후에도 유지합니다.
- 화면을 오래 열어두어도 30초마다 정보 최신성을 다시 계산합니다. API 확인은 5분 간격입니다.
- 실시간 제공기관을 부산시설공단으로 표시했습니다.
- _routes.json으로 /api/parking에만 Function을 실행합니다. 화면·CSS·JS 요청에는 Function을 호출하지 않습니다.

## 캐시와 한도

실시간은 5분, 기본정보·목록은 24시간 캐시합니다. KV는 지역 간 반영 지연이 있는 저장소라 여러 지역의 동시 갱신을 완전히 하나로 묶는 전역 잠금이 아닙니다. 공유 캐시와 인스턴스 중복 방지로 호출을 줄이지만 공공 API 호출량 상한을 보장하지 않습니다. 엄격한 전역 호출 제한은 별도 Durable Object 등이 필요합니다.

KV 무료 한도는 계정 전체 기준 하루 읽기 100,000회·쓰기 1,000회입니다. 서버 하나가 계속 사용되는 단순 경우 실시간 5분 갱신은 하루 약 288회 쓰기지만, 서버 수·동시 접속·실패·다른 프로젝트 사용에 따라 늘어납니다. 무료 범위를 자동 보장하지 않습니다. 실제 Cloudflare와 공공데이터포털 사용량을 확인하세요.

공식 안내: [KV 한도](https://developers.cloudflare.com/kv/platform/limits/), [Functions 경로](https://developers.cloudflare.com/pages/functions/routing/#functions-invocation-routes).

## 정보와 지도 정확도

연결표와 보관 기본정보는 2026-10-01 부산광역시 기본정보 API의 원본을 대조했습니다. 원본 데이터 기준일은 주차장 상세정보에 표시합니다. 일부 기준일은 오래됐으며 요금·운영시간은 현장 안내와 함께 확인해야 합니다.

원본 좌표는 반올림되어 있을 수 있습니다. 위치 표시는 주차장 진입구가 검증됐다는 뜻이 아닙니다. 잘못된 주소나 좌표가 확인되면 functions/api/parking.js의 VERIFIED_LINKS / BASIC_SEED를 수정합니다. 빈 좌표를 이름이나 구·군 중심점으로 추정해서 생성하지 않습니다.

지도: [Leaflet 1.9.4](https://leafletjs.com/) (BSD-2-Clause), [OpenStreetMap](https://www.openstreetmap.org/copyright) 타일·데이터. 타일은 브라우저가 표시하는 범위만 요청하고 출처를 표시합니다. 공개 타일 서비스는 대규모 트래픽에 대한 SLA가 없으므로 운영 규모가 커지면 타일 제공자를 변경해야 합니다. [타일 정책](https://operations.osmfoundation.org/policies/tiles/).

## 파일 구조

```text
index.html
css/style.css
js/app.js
js/parking-data.js
functions/api/parking.js
_routes.json
_headers
.gitignore
README.md
```

## 로컬 실행(선택)

Node.js가 설치된 PC에서 프로젝트 폴더를 열고:

```sh
npx wrangler@4 pages dev . --kv=PARKING_CACHE
```

로컬 인증키는 최상위 .dev.vars에 BUSAN_SERVICE_KEY="인증키" 형식으로 넣습니다. 이 파일은 GitHub에 올리지 않습니다. 실제 Cloudflare Secret과 KV 바인딩은 Production 설정을 따로 유지합니다.

## 검증 범위

최신성·지연 집계, 지역/주소 검색, 좌표 범위, 코드별 연결 36건, 동시 조회 중복 방지, KV를 통한 인스턴스 재시작 후 재사용, 조회 실패 시 마지막 정상 정보 유지, 재시도 대기, 인증키 비노출을 테스트했습니다.

브라우저 테스트에서는 카드 50개, 검색·필터, 펼침 상태·포커스 유지, 장애 시 화면 유지, 시간 경과에 따른 지연 표시, 실제 Leaflet 마커 생성, 지도 로딩 실패 대체 안내, 390px 모바일 너비의 가로 넘침 여부를 확인했습니다. 지도 타일의 외부 서비스 가용성과 새 버전의 실제 Cloudflare 배포는 확인하지 않았습니다.
