# Universal OpenAPI MCP Server - アーキテクチャドキュメント

## 目次
1. [全体アーキテクチャ](#全体アーキテクチャ)
2. [初期化フロー](#初期化フロー)
3. [APIリクエスト処理フロー](#apiリクエスト処理フロー)
4. [クラス構造](#クラス構造)
5. [コンポーネント相互作用](#コンポーネント相互作用)
6. [環境変数設定フロー](#環境変数設定フロー)
7. [認証処理フロー](#認証処理フロー)
8. [ファイル構造と役割](#ファイル構造と役割)

---

## 全体アーキテクチャ

アプリケーションの全体構造と主要コンポーネント間の関係を示します。

[全体アーキテクチャ図は英語版を参照してください](./ARCHITECTURE.md#overall-architecture)

主要構成要素：
- **ユーザー/Claude**：MCPクライアント
- **FastMCPサーバー**：MCPプロトコル処理
- **MCPツール**：4つの主要ツール（api_request、api_paths_list、api_paths_info、api_spec_info）
- **コアコンポーネント**：Configuration Loader、SpecLoader、SpecAnalyzer、ApiClient、AuthHandler
- **外部システム**：外部API、環境変数

---

## 初期化フロー

アプリケーションが起動する際の初期化プロセスを示します。

[初期化フロー図は英語版を参照してください](./ARCHITECTURE.md#initialization-flow)

主要ステップ：
1. **環境変数の読み込み**：dotenv.config()を通じて.envファイルを読み込み
2. **サーバー作成**：createServer関数の呼び出し
3. **設定の読み込み**：環境変数からApiConfigを解析
4. **必須変数の確認**：OPENAPI_SPEC_URLまたはAPI_BASE_URLの確認
5. **認証設定**：AUTH_TYPEに基づく認証方式の設定
6. **ヘッダー解析**：HEADER_*環境変数からカスタムヘッダーを生成
7. **仕様の読み込み**：OpenAPI仕様の読み込みと解析
8. **クライアント作成**：ApiClientインスタンスの作成
9. **MCP設定**：FastMCPサーバーの設定とツールの登録
10. **サーバー起動**：stdioモードでサーバーを起動

---

## APIリクエスト処理フロー

ユーザーが`api_request`ツールを呼び出した際の処理プロセスです。

[APIリクエスト処理フロー図は英語版を参照してください](./ARCHITECTURE.md#api-request-processing-flow)

主要プロセス：
1. **リクエスト受信**：ユーザーがMCPを通じてapi_requestを呼び出し
2. **パラメータ検証**：path、method、data、params、headersの検証
3. **URL生成**：baseUrl + pathで完全なURLを生成
4. **ヘッダー設定**：デフォルトヘッダーとカスタムヘッダーの適用
5. **認証処理**：AuthHandlerを通じて認証情報を追加
6. **HTTPリクエスト**：Axiosを通じて実際のAPIを呼び出し
7. **レスポンス処理**：成功/失敗に応じたレスポンスのフォーマット
8. **YAML変換**：レスポンスをYAML形式に変換して返却

---

## クラス構造

アプリケーションの主要クラスとその関係を示します。

[クラス図は英語版を参照してください](./ARCHITECTURE.md#class-structure)

主要クラス：
- **ApiConfig**：API設定情報（名前、URL、認証、ヘッダーなど）
- **ApiInstance**：ApiConfig + OpenAPI仕様
- **ApiClient**：HTTPリクエスト処理とレスポンスフォーマット
- **SpecLoader**：OpenAPI仕様の読み込み（URLまたはファイル）
- **SpecAnalyzer**：仕様の分析とメタデータの抽出
- **AuthHandler**：認証処理インターフェース
- **具体的なハンドラー**：ApiKeyAuthHandler、BearerAuthHandler、BasicAuthHandler

---

## コンポーネント相互作用

システムの主要コンポーネントがどのように相互作用するかを示します。

[コンポーネント相互作用図は英語版を参照してください](./ARCHITECTURE.md#component-interactions)

レイヤー構造：
1. **ユーザーインターフェースレイヤー**：ユーザー/Claude
2. **MCPプロトコルレイヤー**：FastMCPサーバー
3. **ビジネスロジックレイヤー**：ツールハンドラーとコアサービス
4. **データレイヤー**：設定管理と外部リソース
5. **外部システム**：外部APIとOpenAPI仕様

---

## 環境変数設定フロー

環境変数がどのように解析され使用されるかを示します。

[環境変数設定フロー図は英語版を参照してください](./ARCHITECTURE.md#environment-variable-configuration-flow)

主要プロセス：
1. **.envファイルの読み込み**：dotenv.config()
2. **必須変数の確認**：OPENAPI_SPEC_URLまたはAPI_BASE_URL
3. **基本設定の構成**：API_NAME、API_TIMEOUTなど
4. **認証設定の解析**：AUTH_TYPE別の処理
   - API Key：API_KEY、API_KEY_LOCATION、API_KEY_NAME
   - Bearer：AUTH_TOKENまたはBEARER_TOKEN
   - Basic：AUTH_USERNAME、AUTH_PASSWORD
5. **ヘッダー解析**：HEADER_*変数を実際のヘッダーに変換
6. **最終設定の完成**：ApiConfigオブジェクトの生成

---

## 認証処理フロー

様々な認証方式がどのように処理されるかを示します。

[認証処理フロー図は英語版を参照してください](./ARCHITECTURE.md#authentication-processing-flow)

サポートされる認証方式：
1. **APIキー認証**
   - ヘッダーまたはクエリパラメータで送信
   - 位置とキー名の設定が可能
2. **Bearerトークン認証**
   - Authorizationヘッダーに「Bearer {token}」形式
3. **Basic認証**
   - ユーザー名:パスワードをBase64でエンコード
   - Authorizationヘッダーに「Basic {encoded}」形式
4. **認証なし**
   - 公開API用

---

## ファイル構造と役割

プロジェクトのファイル構造と各ファイルの役割を示します。

[ファイル構造図は英語版を参照してください](./ARCHITECTURE.md#file-structure-and-roles)

主要ディレクトリ：
- **src/**：ソースコード
  - `index.ts`：メインエントリーポイント
  - `types.ts`：TypeScript型定義
  - `client.ts`：ApiClientクラス
  - `spec-utils.ts`：SpecLoaderとSpecAnalyzer
  - `auth.ts`：認証ハンドラー
  - `config-loader.ts`：設定ローダー
- **dist/**：コンパイル済みJavaScript
- **ドキュメント**：README.md、ARCHITECTURE.md

---

## 中核概念

### 1. **MCP（Model Context Protocol）**
- Claudeのような AIモデルが外部ツールと相互作用できるようにするプロトコル
- FastMCPはこのプロトコルを簡単に実装できるフレームワーク

### 2. **OpenAPI仕様**
- REST APIの構造を標準化された形式で記述する仕様
- APIのエンドポイント、パラメータ、レスポンス形式などを定義

### 3. **環境変数ベースの設定**
- コードを変更せずに異なるAPIに接続できる設計
- セキュリティ情報（APIキーなど）をコードから分離

### 4. **認証方式**
- **APIキー**：ヘッダーまたはクエリパラメータで送信
- **Bearerトークン**：Authorizationヘッダーにトークンを含む
- **Basic認証**：ユーザー名:パスワードをBase64でエンコード

### 5. **型安全性**
- TypeScriptを使用してコンパイル時にエラーを検出
- インターフェースと型による契約定義

このアーキテクチャは **単一責任原則** と **依存性注入** パターンに従い、各コンポーネントが明確な役割を持ち、簡単にテストして拡張できるように設計されています。
