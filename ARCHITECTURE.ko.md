# Universal OpenAPI MCP Server - 아키텍처 문서

## 목차
1. [전체 아키텍처](#전체-아키텍처)
2. [초기화 플로우](#초기화-플로우)
3. [API 요청 처리 플로우](#api-요청-처리-플로우)
4. [클래스 구조](#클래스-구조)
5. [컴포넌트 상호작용](#컴포넌트-상호작용)
6. [환경변수 설정 플로우](#환경변수-설정-플로우)
7. [인증 처리 플로우](#인증-처리-플로우)
8. [파일 구조와 역할](#파일-구조와-역할)

---

## 전체 아키텍처

애플리케이션의 전체 구조와 주요 컴포넌트들 간의 관계를 보여줍니다.

[전체 아키텍처 다이어그램은 영어 버전을 참조하세요](./ARCHITECTURE.md#overall-architecture)

주요 구성 요소:
- **사용자/Claude**: MCP 클라이언트
- **FastMCP 서버**: MCP 프로토콜 처리
- **MCP 도구들**: 4개의 주요 도구 (api_request, api_paths_list, api_paths_info, api_spec_info)
- **핵심 컴포넌트**: Configuration Loader, SpecLoader, SpecAnalyzer, ApiClient, AuthHandler
- **외부 시스템**: 외부 API, 환경 변수

---

## 초기화 플로우

애플리케이션이 시작될 때의 초기화 과정을 보여줍니다.

[초기화 플로우 다이어그램은 영어 버전을 참조하세요](./ARCHITECTURE.md#initialization-flow)

주요 단계:
1. **환경 변수 로드**: dotenv.config()를 통해 .env 파일 로드
2. **서버 생성**: createServer 함수 호출
3. **설정 로드**: 환경 변수에서 ApiConfig 파싱
4. **필수 변수 확인**: OPENAPI_SPEC_URL 또는 API_BASE_URL 확인
5. **인증 설정**: AUTH_TYPE에 따른 인증 방식 설정
6. **헤더 파싱**: HEADER_* 환경 변수로부터 커스텀 헤더 생성
7. **스펙 로드**: OpenAPI 스펙 로드 및 파싱
8. **클라이언트 생성**: ApiClient 인스턴스 생성
9. **MCP 설정**: FastMCP 서버 설정 및 도구 등록
10. **서버 시작**: stdio 모드로 서버 시작

---

## API 요청 처리 플로우

사용자가 `api_request` 도구를 호출했을 때의 처리 과정입니다.

[API 요청 처리 플로우 다이어그램은 영어 버전을 참조하세요](./ARCHITECTURE.md#api-request-processing-flow)

주요 과정:
1. **요청 수신**: 사용자가 MCP를 통해 api_request 호출
2. **파라미터 검증**: path, method, data, params, headers 검증
3. **URL 생성**: baseUrl + path로 완전한 URL 생성
4. **헤더 설정**: 기본 헤더와 커스텀 헤더 적용
5. **인증 처리**: AuthHandler를 통해 인증 정보 추가
6. **HTTP 요청**: Axios를 통해 실제 API 호출
7. **응답 처리**: 성공/실패에 따른 응답 포맷팅
8. **YAML 변환**: 응답을 YAML 형식으로 변환하여 반환

---

## 클래스 구조

애플리케이션의 주요 클래스들과 그들의 관계를 보여줍니다.

[클래스 다이어그램은 영어 버전을 참조하세요](./ARCHITECTURE.md#class-structure)

주요 클래스:
- **ApiConfig**: API 설정 정보 (이름, URL, 인증, 헤더 등)
- **ApiInstance**: ApiConfig + OpenAPI 스펙
- **ApiClient**: HTTP 요청 처리 및 응답 포맷팅
- **SpecLoader**: OpenAPI 스펙 로드 (URL 또는 파일)
- **SpecAnalyzer**: 스펙 분석 및 메타데이터 추출
- **AuthHandler**: 인증 처리 인터페이스
- **구체적 핸들러들**: ApiKeyAuthHandler, BearerAuthHandler, BasicAuthHandler

---

## 컴포넌트 상호작용

시스템의 주요 컴포넌트들이 어떻게 상호작용하는지 보여줍니다.

[컴포넌트 상호작용 다이어그램은 영어 버전을 참조하세요](./ARCHITECTURE.md#component-interactions)

레이어 구조:
1. **사용자 인터페이스 레이어**: 사용자/Claude
2. **MCP 프로토콜 레이어**: FastMCP 서버
3. **비즈니스 로직 레이어**: 도구 핸들러와 핵심 서비스
4. **데이터 레이어**: 설정 관리와 외부 리소스
5. **외부 시스템**: 외부 API와 OpenAPI 스펙

---

## 환경변수 설정 플로우

환경변수가 어떻게 파싱되고 사용되는지 보여줍니다.

[환경변수 설정 플로우 다이어그램은 영어 버전을 참조하세요](./ARCHITECTURE.md#environment-variable-configuration-flow)

주요 과정:
1. **.env 파일 로드**: dotenv.config()
2. **필수 변수 확인**: OPENAPI_SPEC_URL 또는 API_BASE_URL
3. **기본 설정 구성**: API_NAME, API_TIMEOUT 등
4. **인증 설정 파싱**: AUTH_TYPE별 처리
   - API Key: API_KEY, API_KEY_LOCATION, API_KEY_NAME
   - Bearer: AUTH_TOKEN 또는 BEARER_TOKEN
   - Basic: AUTH_USERNAME, AUTH_PASSWORD
5. **헤더 파싱**: HEADER_* 변수를 실제 헤더로 변환
6. **최종 설정 완성**: ApiConfig 객체 생성

---

## 인증 처리 플로우

다양한 인증 방식이 어떻게 처리되는지 보여줍니다.

[인증 처리 플로우 다이어그램은 영어 버전을 참조하세요](./ARCHITECTURE.md#authentication-processing-flow)

지원되는 인증 방식:
1. **API Key 인증**
   - 헤더 또는 쿼리 파라미터로 전달
   - 위치와 키 이름 설정 가능
2. **Bearer Token 인증**
   - Authorization 헤더에 "Bearer {token}" 형식
3. **Basic 인증**
   - 사용자명:비밀번호를 Base64로 인코딩
   - Authorization 헤더에 "Basic {encoded}" 형식
4. **인증 없음**
   - 공개 API용

---

## 파일 구조와 역할

프로젝트의 파일 구조와 각 파일의 역할을 보여줍니다.

[파일 구조 다이어그램은 영어 버전을 참조하세요](./ARCHITECTURE.md#file-structure-and-roles)

주요 디렉토리:
- **src/**: 소스 코드
  - `index.ts`: 메인 엔트리 포인트
  - `types.ts`: TypeScript 타입 정의
  - `client.ts`: ApiClient 클래스
  - `spec-utils.ts`: SpecLoader와 SpecAnalyzer
  - `auth.ts`: 인증 핸들러들
  - `config-loader.ts`: 설정 로더
- **dist/**: 컴파일된 JavaScript
- **문서**: README.md, ARCHITECTURE.md

---

## 핵심 개념

### 1. **MCP (Model Context Protocol)**
- Claude와 같은 AI 모델이 외부 도구와 상호작용할 수 있게 해주는 프로토콜
- FastMCP는 이 프로토콜을 쉽게 구현할 수 있게 해주는 프레임워크

### 2. **OpenAPI 스펙**
- REST API의 구조를 표준화된 형식으로 기술하는 명세
- API의 엔드포인트, 파라미터, 응답 형식 등을 정의

### 3. **환경변수 기반 설정**
- 코드 변경 없이 다른 API에 연결할 수 있게 해주는 설계
- 보안 정보(API 키 등)를 코드에서 분리

### 4. **인증 방식들**
- **API Key**: 헤더나 쿼리 파라미터로 전달
- **Bearer Token**: Authorization 헤더에 토큰 포함
- **Basic Auth**: 사용자명:비밀번호를 Base64로 인코딩

### 5. **타입 안전성**
- TypeScript를 사용하여 컴파일 타임에 오류 검출
- 인터페이스와 타입을 통한 계약 정의

이 아키텍처는 **단일 책임 원칙**과 **의존성 주입** 패턴을 따라 각 컴포넌트가 명확한 역할을 가지며, 쉽게 테스트하고 확장할 수 있도록 설계되었습니다.
