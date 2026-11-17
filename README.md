# NULL / VECTOR — Cloudflare 커뮤니티

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
