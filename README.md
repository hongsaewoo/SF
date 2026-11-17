# NULL / VECTOR — Cloudflare 커뮤니티

## Vercel 무료 주소 연결

Vercel에서 Add New → Project → `hongsaewoo/SF` Import를 선택하고 **Root Directory를 `vercel-proxy`**로 설정한 뒤 Deploy합니다. 프레임워크는 Other이며 빌드/출력은 폴더 안 vercel.json 설정을 사용합니다. 사이트 및 API 전체를 `https://sf.hongsaewoo.workers.dev`로 전달하므로 DB는 Cloudflare D1에 그대로 둡니다. 이 프로젝트에 D1_DATABASE_ID나 Cloudflare 토큰을 넣을 필요는 없습니다.

Vercel 배포 후 확정된 프로덕션 주소(예: `https://선택한이름.vercel.app`, 끝에 / 없이)를 Cloudflare `sf`의 **빌드 변수 `ALLOWED_ORIGINS`**로 추가하고 재배포하세요. `D1_DATABASE_ID`는 기존 값을 유지합니다. 여러 주소는 쉼표로 구분합니다. 등록된 정확한 HTTPS 주소만 글/댓글 작성을 허용하며 모든 vercel.app 주소를 허용하지 않습니다. 미리보기 주소는 자동 허용되지 않습니다.

Vercel 주소에서 목록/검색과 글/댓글 저장을 확인하세요. 프록시를 거치면 Cloudflare에서 보는 IP가 Vercel 서버 IP이므로 15초 작성 제한이 여러 방문자에게 함께 적용될 수 있습니다. 사용자 IP 헤더를 검증 없이 신뢰하지 않기 위한 현재 제한입니다. 실제 Vercel 배포 및 전달 헤더 동작은 계정 배포 후 검증해야 합니다.

## 현재 sf.workers.dev 프로젝트 설정 (Workers)

기존 프로젝트가 Workers라면 아래 설정을 사용합니다. 아래의 Pages 안내는 별도 Pages 프로젝트에만 해당합니다.

1. D1에서 `null-vector-community`를 만들고 Console에서 `migrations/0001_community.sql`을 실행합니다.
2. D1 화면의 Database ID(UUID)를 복사합니다. API 토큰이나 계정 ID가 아닙니다.
3. Workers 프로젝트 `sf` → Settings → Build의 빌드 변수에 `D1_DATABASE_ID`를 추가하고 복사한 UUID를 값으로 설정합니다. 런타임 변수가 아닌 빌드 환경 변수입니다.
4. 빌드 명령: `node build.mjs`
5. 배포 명령: `npx wrangler deploy --config wrangler.deploy.json`
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

- 타겟이 약 5.6초 이동한 뒤 정지하고 ENTER 활성화
- 레이더, 파형, 대시보드, 공유 글과 댓글
- 닉네임, 분류, 검색, 20개 단위 더 보기
- 서버 길이 검증, 매개변수 SQL, textContent 렌더링, 동일 출처 작성 제한
- IP별 글·댓글 합산 15초 작성 간격. IP 원문 대신 호스트와 IP의 해시를 일시 저장하고, 후속 작성 시 24시간 지난 제한 기록을 정리합니다.

회원 가입과 닉네임 소유권 인증은 없습니다. 글과 댓글은 공개되므로 개인정보를 쓰지 마세요. 삭제/수정 UI, 파일 첨부, 알림, 관리자 화면은 아직 없으며 운영자는 D1 Console에서 관리할 수 있습니다. 댓글은 글마다 오래된 순으로 최대 200개 표시합니다. 공개 운영 규모가 커지면 Turnstile과 신고/관리 기능을 추가하세요.

기존 브라우저 전용 메모는 자동으로 공개 업로드하지 않습니다. 레이더와 파형은 시각 효과입니다.

## 파일

`index.html`, `community.js`는 화면, `functions/api/[[path]].js`는 API, `migrations/0001_community.sql`은 DB 초기화입니다. `node build.mjs`는 공개할 파일만 public에 복사하므로 서버 코드와 SQL은 정적으로 노출되지 않습니다.

인증정보와 API 토큰을 저장소에 올리지 마세요. D1은 서버 바인딩으로 연결합니다. 무료 한도를 초과하면 계정 요금제에 따른 제한 또는 비용이 발생할 수 있습니다.
