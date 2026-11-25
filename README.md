# stxw 타워 구내식당

사진에서 확인한 **점심 식단**을 공개하는 읽기 전용 정적 웹사이트입니다. 이름의 `stxw` 표기는 의도된 그대로 사용합니다. 오늘·날짜별·월~금 주간 조회(PC·모바일 모두 한 열의 세로 카드), 한국 시간(Asia/Seoul) 기준 날짜, 코너별 메뉴, 갱신 시각을 제공합니다. 아침/저녁 선택, 사진 업로드, 관리자 로그인, 브라우저 쓰기 기능은 없습니다.

## 현재 상태와 남은 설정

코드와 로컬 테스트를 준비했습니다. 사용자 직접 SQL 실행 후 공개 REST 읽기와 빈 익명 쓰기 요청의 `HTTP 401 / 42501 permission denied for table meals`를 확인했습니다. 사진에서 확인한 실제 점심 식단을 Supabase에서 읽으며, GitHub Pages에 배포되어 있습니다: https://mingkyme.github.io/stxw-cafeteria/ . 실제 식단을 임의 생성하지 않습니다. `tests/`의 합성 데이터는 자동 테스트 전용으로, 공개 사이트나 운영 DB에 포함되지 않습니다.

- 프로젝트 URL: `https://xyjkxyyvslrhksiwzkph.supabase.co`
- 공개 설정: [`site/config.mjs`](site/config.mjs)의 publishable key (브라우저 노출 정상)
- SQL: [`supabase/schema.sql`](supabase/schema.sql) — 새 전용 프로젝트에 실행할 정확한 전체 SQL
- 가져오기: [`scripts/import.mjs`](scripts/import.mjs) — Node.js 22 이상, 외부 패키지 불필요
- 배포 대상은 **`site/`만**입니다. 저장소 루트나 비밀 키 파일을 정적 호스팅하지 마세요.

## 1. Supabase SQL 실행 (프로젝트 소유자가 직접)

1. Supabase Dashboard에서 위 프로젝트 ID `xyjkxyyvslrhksiwzkph`를 확인합니다.
2. **SQL Editor → New query**에서 `supabase/schema.sql`의 전체 내용을 실행합니다. 이 파일은 `BEGIN;`부터 `COMMIT;`까지 포함한 최초 설치용 SQL입니다. 실행 권한/연결 비밀 키를 확보하지 않았으므로 도구가 대신 실행한 것은 아닙니다.
3. 이미 `public.meals`가 있다면 최초 SQL을 재실행하거나 테이블을 지우지 마세요. 기존 스키마를 확인하고 필요한 마이그레이션만 적용합니다. 이전 아침/저녁 허용 버전을 이미 실행했다면 별도 제공된 점심 전용 마이그레이션을 사용하세요.
4. Table Editor에서 `public.meals`가 있는지 확인합니다. SQL Editor에서 다음 읽기 전용 점검을 실행할 수 있습니다.

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'meals'
ORDER BY ordinal_position;
SELECT relrowsecurity
FROM pg_class WHERE oid = 'public.meals'::regclass;
SELECT policyname, roles, cmd, qual
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meals';
```

정확한 열 계약: `id` identity PK, `cafeteria` 기본값 `stxw 타워 구내식당`, `meal_date` date, `meal_type` 기본값/유일 허용값 `lunch`, `corner` 기본값 `기본`, `menus` 비어 있지 않은 text 배열, 선택적 `source_path`, 자동 갱신 `updated_at` timestamptz. 고유 키는 `(cafeteria, meal_date, meal_type, corner)`입니다.

보안: RLS 활성화, `anon`/`authenticated`는 SELECT만 허용하고 INSERT/UPDATE/DELETE/TRUNCATE/시퀀스 사용 권한을 주지 않습니다. `service_role`만 로컬 가져오기에 사용합니다. **식단 전체는 공개 정보입니다.** `source_path`도 테이블 공개 조회 대상이므로 비밀·개인정보·사내 비공개 URL·로컬 절대 경로를 절대 넣지 마세요. 가져오기 도구는 이 열을 쓰지 않습니다.

설정 전 `PGRST205`(테이블 없음)는 정상 빈 식단이 아니라 **데이터베이스 설정 미완료**로 화면에 표시합니다. 평일에 설정 후 0건이면 **등록된 식단이 없습니다**라고 표시합니다. 토요일·일요일은 DB 조회 없이 **주말 휴무**를 표시하고 기존 주말 데이터는 사용하지 않습니다. 주간은 선택일이 속한 월요일~금요일만 표시하며, 일요일 선택도 직전 월요일부터 시작합니다. 네트워크/권한 오류도 빈 결과와 구분합니다.

## 2. 로컬 비밀 키 파일 (채팅으로 보내지 마세요)

Supabase 프로젝트의 **secret key** (`sb_secret_...`) 또는 legacy **service_role JWT**를 사용합니다. publishable/anon key로 쓰기는 불가능합니다. 비밀 키는 사용자 본인이 로컬 편집기에 직접 입력합니다. 채팅·GitHub·브라우저·명령줄 인수·셸 히스토리에 붙여넣지 마세요.

macOS에서 다음은 빈 파일만 준비합니다. 기존 파일이 있으면 내용을 지우지 않습니다.

```sh
install -d -m 700 "$HOME/.config/stxw-cafeteria"
(umask 077; touch "$HOME/.config/stxw-cafeteria/supabase-secret")
chmod 600 "$HOME/.config/stxw-cafeteria/supabase-secret"
open -e "$HOME/.config/stxw-cafeteria/supabase-secret"
```

열린 로컬 편집기에 **키 값 한 줄만** 입력하고 저장합니다(따옴표, `KEY=`, JSON 불필요). 파일은 `/Users/mingky/stxw-cafeteria` **외부**여야 합니다. 도구는 실제 경로(심볼릭 링크 해석 포함)와 권한 0600을 검사하고 키를 출력하지 않습니다. 다른 외부 경로를 사용할 때는 키 자체가 아닌 경로만 지정합니다.

```sh
export STXW_SECRET_FILE="$HOME/.config/stxw-cafeteria/supabase-secret"
```

이 키는 프로젝트 전체 쓰기 권한을 갖는 강력한 키입니다. 유출되면 즉시 폐기·재발급하세요. GitHub Actions에는 비밀 키가 필요하지 않으며, 절대 등록할 이유가 없습니다.

## 3. 사진 → 확인 → 로컬 가져오기

사용자는 대화에서 식단 사진을 전달하고, 에이전트가 판독 후 확정된 JSON을 준비합니다. **연도가 없거나 날짜·요일·메뉴를 읽기 어려우면 사용자에게 확인하며 임의로 보정하지 않습니다.** 누락된 날짜를 오늘 날짜로 채우지 않습니다.

입력 JSON 최상위는 `meals` 배열이며 각 행은 아래 필드만 허용됩니다. 실제 사진 확인 후 작성하세요(이 안내는 식단 예시를 임의 제공하지 않습니다).

| 필드 | 필수 내용 |
|---|---|
| `meal_date` | 확정된 `YYYY-MM-DD`, 존재하는 날짜, 2000~2100년 |
| `weekday` | 사진/사용자 확인에 따른 `월`~`일`, 실제 날짜와 일치 필수 |
| `date_confirmed` | 연·월·일을 확인한 경우에만 boolean `true` |
| `meal_type` | 반드시 `lunch` |
| `corner` | 확인된 코너명. 구분이 없다고 확인한 경우 `기본` |
| `menus` | 확인된 메뉴 문자열 배열(1~50개). 빈 문자열/물음표 불허 |

주말 식단은 네트워크 쓰기 전에 거부합니다(주말 휴무 레코드를 만들지 않습니다). 평일 공휴일의 `휴무` 메뉴는 그대로 허용합니다. 같은 날짜·점심·코너의 중복 행, 알 수 없는 필드, 불확실한 날짜, 잘못된 요일, 빈 메뉴는 전체 요청 전 거부합니다. 원본 사진/중간 JSON은 저장소 외부에 보관하거나 gitignored `imports/`에 두세요. 도구는 사진을 전송하지 않습니다.

```sh
cd /Users/mingky/stxw-cafeteria
# 경로는 본인이 확인한 실제 JSON으로 바꿉니다.
node scripts/import.mjs /absolute/path/confirmed-meals.json --dry-run
# dry-run 결과와 날짜·요일·코너·메뉴를 다시 확인한 후에만 실행
node scripts/import.mjs /absolute/path/confirmed-meals.json --apply
```

기본 동작도 dry-run입니다. `--apply`에서만 POST 업서트하고, **별도 GET 재조회로 메뉴 일치까지 확인**한 후 성공을 출력합니다. 같은 파일 재실행 시 동일 키의 메뉴가 수정되고 `updated_at`이 갱신됩니다. 코너 이름을 변경하면 새 행이므로 기존 코너를 자동 삭제하지 않습니다. 특정 날짜의 일부 코너만 넣어도 나머지는 삭제되지 않습니다. 잘못 등록한 코너/날짜 삭제는 소유자가 Dashboard에서 원본과 대조 후 직접 처리합니다. 시간 초과/재조회 실패는 쓰기가 이미 반영됐을 수도 있으므로 같은 파일로 재시도하거나 Dashboard에서 확인하세요.

## 4. 실행과 테스트

```sh
cd /Users/mingky/stxw-cafeteria
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run serve
```

로컬 주소: `http://127.0.0.1:4173`. 운영용 라이브러리나 빌드 과정 없이 정적 파일만으로 동작합니다. 테스트 의존성만 npm으로 설치합니다.

- Node 테스트: KST/연도 경계, 엄격한 날짜·요일 검증, 점심 전용, REST 읽기·페이지네이션·오류, 비밀 파일 안전성, 업서트 후 재조회.
- PGlite의 실제 PostgreSQL 엔진에 SQL을 적용하고 고유 키/업서트/갱신 트리거/RLS/anon·authenticated 쓰기 차단을 검증합니다. **로컬 SQL 검증이지 운영 Supabase 실행 증거는 아닙니다.**
- Chromium 브라우저: 모바일/데스크톱, 오늘/날짜별/주간, KST 날짜, 연도 경계, 빈 상태/설정 미완료/오프라인, 메뉴 HTML 비실행. 이 테스트의 네트워크 응답은 명시적 테스트 fixture로 대체하며 실제 등록 데이터가 아닙니다.

## 5. GitHub Pages 공개

사용자 승인 저장소는 `mingkyme/stxw-cafeteria`(public)입니다. 공개 정적 파일만 배포하며 식단 사진 원본·가져오기 JSON·비밀 키 파일은 올리지 않습니다.

1. GitHub 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**를 선택합니다.
2. 준비된 [Pages 워크플로](.github/workflows/pages.yml)는 단위/DB/브라우저 테스트 성공 뒤에만 `site/`를 업로드합니다. PR은 테스트만 수행합니다.
3. 배포된 실제 URL과 Actions 성공 여부를 확인합니다. 예상 URL을 실제 배포 완료 주소로 안내하지 마세요.
4. 배포 후 GET 조회, 비어 있는 날짜, 주간 전환, 작은 화면을 다시 확인합니다. 실제 식단은 Supabase에서 읽으므로 사진을 가져올 때마다 사이트 재배포가 필요하지 않습니다.

HTML은 상대 경로를 사용하여 GitHub Pages의 `/stxw-cafeteria/` 하위 경로에서도 동작합니다. 외부 폰트/분석/추적 스크립트는 없습니다. 방문자의 브라우저는 식단을 위해 Supabase로 직접 GET 요청합니다.
