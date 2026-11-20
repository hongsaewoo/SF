# NULL / VECTOR — Cloudflare 커뮤니티

## Vercel 무료 주소 연결

Vercel에서 Add New → Project → `hongsaewoo/SF` Import를 선택합니다. **Root Directory는 저장소 루트(기본값)**, Framework Preset은 **Other**로 둡니다. 루트의 `vercel.json`이 `node vercel-proxy/build.mjs`와 출력 `public`, 전체 경로 프록시 규칙을 설정합니다. 기존에 Root Directory를 `vercel-proxy`로 설정한 프로젝트도 폴더 안의 동일한 프록시 설정을 계속 사용할 수 있습니다. 사이트 및 API 전체를 `https://sf.hongsaewoo.workers.dev`로 전달하므로 DB는 Cloudflare D1에 그대로 둡니다. Vercel 프로젝트에 D1_DATABASE_ID나 Cloudflare 토큰을 넣을 필요는 없습니다.

Vercel에서 Ready인데 `404 NOT_FOUND`가 나오면 해당 프로젝트의 **Settings → Build and Deployment**에서 Root Directory가 루트 또는 `vercel-proxy`인지 확인하고, Build Command/Output Directory의 대시보드 Override를 해제해 vercel.json 값을 사용하세요. 그 후 수정 커밋이 포함된 최신 main 배포를 생성하세요. 코드 커밋이 바뀌기 전의 과거 배포를 재실행하면 새 설정 파일이 포함되지 않습니다.

Vercel 배포 후 확정된 프로덕션 주소(예: `https://null-vector-pi.vercel.app`, 끝에 / 없이)를 Cloudflare `sf`의 **빌드 변수 `ALLOWED_ORIGINS`**로 추가하고 재배포하세요. `D1_DATABASE_ID`는 기존 값을 유지합니다. 여러 주소는 쉼표로 구분합니다. 등록된 정확한 HTTPS 주소만 글/댓글 작성을 허용하며 모든 vercel.app 주소를 허용하지 않습니다. 미리보기 주소는 자동 허용되지 않습니다.

Vercel 주소에서 목록/검색과 글/댓글 저장을 확인하세요. 프록시를 거치면 Cloudflare에서 보는 IP가 Vercel 서버 IP이므로 15초 작성 제한이 여러 방문자에게 함께 적용될 수 있습니다. 사용자 IP 헤더를 검증 없이 신뢰하지 않기 위한 현재 제한입니다. 실제 Vercel 배포 및 전달 헤더 동작은 계정 배포 후 검증해야 합니다.

## 현재 sf.workers.dev 프로젝트 설정 (Workers)

기존 프로젝트가 Workers라면 아래 설정을 사용합니다. 아래의 Pages 안내는 별도 Pages 프로젝트에만 해당합니다.

1. D1에서 `null-vector-community`를 만듭니다. 아래 자동 배포 명령을 사용하면 필요한 게시판·계정 스키마는 배포 시 생성됩니다.
2. D1 화면의 Database ID(UUID)를 복사합니다. API 토큰이나 계정 ID가 아닙니다.
3. Workers 프로젝트 `sf` → Settings → Build의 빌드 변수에 `D1_DATABASE_ID`를 추가하고 복사한 UUID를 값으로 설정합니다. 런타임 변수가 아닌 빌드 환경 변수입니다.
4. 빌드 명령: `node build.mjs`
5. 배포 명령: `node deploy.mjs` (DB 스키마 확인·업데이트 후 Worker 배포). 빌드에 사용하는 API 토큰에 해당 계정의 **D1 Edit** 권한도 추가하세요.
6. 루트 디렉터리는 기본값(저장소 루트), 브랜치는 `main`으로 두고 재배포합니다. Workers에는 Pages의 출력 디렉터리 설정이 필요하지 않습니다.
7. `https://sf.hongsaewoo.workers.dev/api/posts`에서 JSON 응답을 확인합니다.

이 설정은 Worker 서버 코드와 정적 파일을 함께 배포하고 D1을 `DB`로 연결합니다. D1 ID 없이 먼저 배포해도 서버 코드는 생기지만 API는 DB 연결 안내(503)를 반환합니다. 이후 D1_DATABASE_ID를 설정하고 재배포하세요. 대시보드에서만 수동으로 추가한 DB 바인딩은 다음 코드 배포에서 덮어써질 수 있으므로 위 빌드 변수 방식을 유지하세요.

Pages + Pages Functions + D1을 사용합니다. 외부 DB 서비스는 필요 없습니다.

## 친구 Cloudflare 계정에서 설정

1. Pages에서 `hongsaewoo/SF` 저장소와 `main`을 연결합니다. 친구 계정의 GitHub 연결이 해당 저장소를 읽을 수 있어야 합니다.
2. 프레임워크 None, 빌드 명령 `node build.mjs`, 출력 디렉터리 `public`, 루트 디렉터리 기본값으로 설정합니다. 기존 `exit 0` 및 `.` 설정은 변경하세요.
3. Storage & databases → D1에서 `null-vector-community` 데이터베이스를 생성합니다.
4. D1 Console에서 `migrations/0001_community.sql` 전체 내용을 실행합니다. 다중 문장을 지원하지 않으면 세미콜론 단위로 순서대로 실행하세요. 기존 테이블을 삭제하지 않습니다.
5. Pages → Settings → Bindings → Add → D1 database에서 변수 이름을 정확히 `DB`로 지정하고 위 DB를 선택합니다. Production에 적용하세요. Preview에는 별도의 테스트 DB를 만들고 같은 SQL을 실행해 연결하세요.
6. Deployments에서 다시 배포합니다. 바인딩 변경 후 재배포가 필요합니다.
7. 배포 주소의 `/api/posts`가 JSON의 posts 배열을 반환하는지 확인합니다. 글과 댓글을 작성한 뒤 다른 브라우저에서도 보이는지 확인하세요.

## 기능과 범위

- 타겟이 약 1.4초 이동한 뒤 정지. 초점을 클릭하면 바로 입장
- 레이더, 파형, 대시보드, 공유 글과 댓글
- 닉네임, 분류, 검색, 20개 단위 더 보기
- 서버 길이 검증, 매개변수 SQL, textContent 렌더링, 동일 출처 작성 제한
- IP별 글·댓글 합산 15초 작성 간격. IP 원문 대신 호스트와 IP의 해시를 일시 저장하고, 후속 작성 시 24시간 지난 제한 기록을 정리합니다.

아이디·비밀번호 회원가입과 로그인, 로그아웃을 지원합니다. 글·댓글 작성 시 로그인한 계정의 닉네임을 서버에서 적용합니다. 글과 댓글은 공개되므로 개인정보를 쓰지 마세요. 삭제/수정 UI, 파일 첨부, 알림, 관리자 화면은 아직 없으며 운영자는 D1 Console에서 관리할 수 있습니다. 댓글은 글마다 오래된 순으로 최대 200개 표시합니다. 공개 운영 규모가 커지면 Turnstile과 신고/관리 기능을 추가하세요.

기존 브라우저 전용 메모는 자동으로 공개 업로드하지 않습니다. 입장 화면의 조준경과 입장 후 관제 레이더는 시각 효과입니다. 레이더 신호는 시뮬레이션이며 실제 항공·선박 추적 데이터가 아닙니다.

## 파일

`index.html`, `community.js`는 화면, `functions/_lib/auth.js`는 계정·세션 처리, `functions/api/[[path]].js`는 API, `migrations/0001_community.sql`은 게시판 DB 초기화, `migrations/0002_accounts.sql`은 계정과 작성자 연결 마이그레이션입니다. `node build.mjs`는 공개할 파일만 public에 복사하므로 서버 코드와 SQL은 정적으로 노출되지 않습니다.

인증정보와 API 토큰을 저장소에 올리지 마세요. D1은 서버 바인딩으로 연결합니다. 무료 한도를 초과하면 계정 요금제에 따른 제한 또는 비용이 발생할 수 있습니다.

## 계정 기능 및 새 관측 화면

입장 후 왼쪽에는 회원가입·로그인·내 기록·공유 아카이브 메뉴, 가운데에는 회전 스캔·거리 눈금·가상 신호를 표시하는 관제 레이더, 오른쪽에는 실제 DB 연결 상태·공유 기록 수·내 기록 수·로그인 상태를 표시합니다. 상태는 30초마다 갱신합니다.

- 회원가입: 아이디(영문 소문자·숫자·밑줄 3~24자), 고유 닉네임(1~30자), 비밀번호(10~128자).
- 비밀번호는 개별 랜덤 salt와 PBKDF2-SHA256 100,000회로 해시합니다. Workers의 PBKDF2 제한에 맞춘 값이며 작업 계수를 DB에 저장합니다.
- 랜덤 세션 토큰의 SHA-256 해시만 DB에 저장합니다. 세션은 7일 후 만료되고 로그아웃 시 즉시 삭제합니다. 쿠키는 HttpOnly, SameSite=Lax이며 HTTPS에서는 Secure와 __Host- 접두사를 사용합니다.
- 가입·로그인 요청은 IP 및 아이디 단위로 제한합니다. 공개 게시물 열람은 로그인 없이 가능합니다. 새 글·댓글 작성은 로그인이 필요합니다.
- ‘내 기록’은 닉네임 검색이 아니라 로그인한 user_id로 조회합니다. 기존 비회원 글은 자동으로 계정에 귀속하지 않습니다.
- 이메일 수집·인증, 비밀번호 재설정, 회원 탈퇴 UI는 현재 범위에 포함되지 않습니다.

### DB 적용

Workers에서 아래 자동 배포 설정을 사용하면 SQL을 Console에 직접 붙여넣지 않아도 됩니다. 수동 배포를 유지한다면 기존 운영 D1에 `migrations/0002_accounts.sql`을 한 번 적용해야 합니다. 수동 SQL의 ALTER TABLE 문은 중복 실행하지 마세요. 원격 DB에는 여기서 직접 접속하거나 적용하지 않았습니다.

Node.js 22.13 이상에서 로컬 서버는 `node dev-server.mjs`로 실행합니다. 로컬 SQLite의 마이그레이션 적용 내역을 관리하며 재시작 시 중복 실행하지 않습니다. 로컬 계정은 `.wrangler/local.sqlite`에 저장되며 운영 DB와 분리됩니다.

검증: `node test-community.mjs` (가입/중복/비밀번호/세션 만료·회전·로그아웃/작성자 위조 방지/내 기록 격리/작성 제한/검색/페이지 처리).

구현 참고: [Cloudflare Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/), [Workers PBKDF2 제한](https://github.com/cloudflare/workerd/issues/1346), [쿠키 속성](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

## Workers 자동 배포 — 계정 소유자가 한 번 설정

Cloudflare **Workers & Pages → sf → Settings → Builds**에서:

1. Git 저장소 `hongsaewoo/SF`, 프로덕션 브랜치 `main`을 연결합니다.
2. 빌드 명령은 `node build.mjs`, 프로덕션 배포 명령은 **`node deploy.mjs`**로 설정합니다.
3. 기존 빌드 변수 `D1_DATABASE_ID`를 유지합니다. `ALLOWED_ORIGINS`도 기존 값을 유지합니다.
4. Builds에서 사용하는 API 토큰에 **Account → D1 → Edit** 권한이 있는지 확인합니다. 기본 자동 생성 토큰에는 D1 권한이 포함되지 않으므로, 계정 소유자가 **My Profile → API Tokens**에서 해당 빌드 토큰에 권한을 추가해야 합니다. 토큰 값 자체를 GitHub나 대화에 공유할 필요는 없습니다.
5. 설정 변경 후 최신 `main`을 빌드·배포합니다. 이후 GitHub main 푸시가 빌드를 시작합니다.

`deploy.mjs`는 0001의 게시판 스키마를 확보하고, 운영 DB의 posts/comments 컬럼을 조회한 뒤 0002의 계정 스키마와 없는 user_id 컬럼만 적용합니다. Console로 이미 0002를 적용했거나 일부 컬럼만 적용한 DB도 다시 실행할 수 있습니다. 기존 글·회원 데이터를 삭제하지 않습니다. DB 작업 실패·권한 부족·잘못된 설정 시 Worker 배포를 중단합니다.

이 스크립트는 현재 저장소의 0001/0002/0003 스키마를 자동 준비합니다. 추후 다른 DB 변경 파일을 추가할 때에는 배포 스크립트에도 해당 변경을 연결해야 합니다. 프로덕션 배포용이며 별도 미리보기 배포 명령은 유지하세요. Workers Builds의 `WORKERS_CI_BRANCH`가 main이 아니면 실행을 중단합니다.

로컬 검증: `node test-deploy.mjs`는 원격 연결 없이 새 DB, 기존 DB, 일부 적용, 수동 적용, 재실행, 데이터 보존과 실패 시 배포 중단을 확인합니다. 실제 Cloudflare 배포 검증은 계정 소유자의 최초 설정 후 필요합니다.

공식 문서: [Workers Builds 설정·토큰 권한](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [D1 SQL 실행 명령](https://developers.cloudflare.com/d1/wrangler-commands/#d1-execute).


## 공용 채팅

입장 후 화면 좌측 하단의 **공용 채팅** 버튼을 누르면 라운지가 위로 펼쳐집니다. 아카이브·글 상세·작성 화면으로 이동해도 같은 창과 입력 중인 메시지를 유지하며, 입장 전 조준경 화면에서는 보이지 않습니다.

- 전체 공개 채널입니다. 비로그인 사용자는 읽을 수 있고 로그인한 사용자는 계정 닉네임으로 전송합니다.
- 창이 열려 있고 브라우저 탭이 보일 때만 5초마다 갱신합니다. WebSocket 방식은 아닙니다. 닫으면 갱신을 멈춥니다.
- 최근 50개로 시작하고 이후 메시지는 순서대로 추가합니다. 화면에는 최근 200개까지 유지합니다. DB 기록은 자동 삭제하지 않습니다.
- 메시지는 최대 500자이며 계정당 2초의 작성 간격을 적용합니다. 전송 실패 후 동일 요청을 다시 보내도 중복 저장하지 않습니다.
- Enter로 전송, Shift+Enter로 줄바꿈합니다. 한글 조합 중 Enter는 전송하지 않습니다. Escape 또는 접기 버튼으로 닫습니다.
- 로그아웃·계정 변경 시 입력 중인 메시지는 비웁니다. 다른 계정으로 초안이 이어지지 않습니다.

`migrations/0003_chat.sql`이 필요합니다. **Workers 배포 명령이 `node deploy.mjs`이면 자동 적용**합니다. 이전 수동 배포 명령을 계속 쓰는 경우, D1 Console에서 0003_chat.sql을 적용해야 합니다. 채팅 마이그레이션은 재실행할 수 있습니다.

검증: `node test-chat.mjs`, `node test-chat-ui.mjs`, `node test-deploy.mjs`, `node test-community.mjs`.
