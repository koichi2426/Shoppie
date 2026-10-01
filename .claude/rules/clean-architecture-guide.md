---
description: クリーンアーキテクチャ各パーツ解説(Qiita記事準拠・backend作業時)
paths:
  - "fastapi/backend/**/*.py"
---
# クリーンアーキテクチャの各パーツをコードで理解する

出典方針: 本ルールは記事「クリーンアーキテクチャの各パーツをコードで理解する」(@koichi2426)の内容をそのまま規律として扱う。AgentHub backend 実装時はこれに従う。

## ゴール

クリーンアーキテクチャを構成する各パーツについて、その役割を自分の言葉で説明できること。実装時もその役割から外れないこと。

## 事前知識

### ドメイン駆動設計とは

本ルールでは以下を定義とする。

> 対象領域(ドメイン)をモデル化し、そのモデル(ドメインオブジェクト)を使ってシステムを実現する考え方

### クリーンアーキテクチャとは

本ルールでは以下を定義とする。

> ドメイン駆動設計により定義されたドメインオブジェクトを中心に据え、外部要素(DB、UI、フレームワーク等)から独立させるソフトウェア設計思想

一言で言えば、「流行りのフレームワークやDBの都合に、システムの核心であるビジネスルールを振り回されないようにする」ための整理術である。

---

## 1. ドメイン層

### 値オブジェクト

「名前」「メールアドレス」「金額」など、それ自体が意味を持つ値である。システムの中で「正しい形式であること」を保証し、単なる文字列や数字以上の意味を持たせる。

| 項目 | 内容 |
|------|------|
| 役割 | 不正な値(空文字、不正な形式のメールアドレスなど)がシステムに入り込むのを防ぎ、値の比較を容易にする。 |
| 具体例(ユーザー名) | 文字数制限や使用可能文字のルールを値オブジェクト自体に持たせ、生成時にバリデーションを行うことで「常に正しい名前」であることを担保する。 |
| 具体例(メールアドレス) | 「@」が含まれているかなどの形式チェックを内包する。一度生成された後は中身が変更されない(不変)ため、安心して使い回せる。 |

#### コードによる解説

値オブジェクトは、単なるデータの入れ物(構造体)ではない。それ自体がビジネスルールを内包し、守るべき「規律」を持ったオブジェクトである。

では、どのようにしてオブジェクトにルールを持たせるのだろうか。その鍵は、生成過程にある。

例えば、以下の id.go を見てほしい。単に `type ID int` と定義しただけで終わらせてしまえば、それはただの数値型に過ぎない。この型を「値オブジェクト」たらしめているのは、コンストラクタとなる `NewID` 関数の存在である。

値オブジェクトは、必ずこの `NewID` 関数を経由して生成される。そして、この生成の瞬間に厳格なルールを課すのである。id.go の場合、以下のような制約を設けている。

```go
if value < 0 {
    return 0, errors.New("ID must be non-negative")
}
return ID(value), nil
```

このように、不正な値での生成を断固として拒否することで、システム内に「負のID」が紛れ込む隙を失わせる。

また、username という値オブジェクトであれば、以下のようなルールを課して生成を行う。

```go
if utf8.RuneCountInString(value) < 3 || utf8.RuneCountInString(value) > 32 {
    return "", errors.New("username must be 3-32 chars")
}
return Username(value), nil
```

「3文字以上32文字以内」というビジネス上の制約を、型そのものが背負う形となる。

このように、生成時にバリデーションを強制し、一度作られたらその正しさが保証され続ける。これこそが、値オブジェクトが単なる構造体を超えて「ルールを背負ったオブジェクト」である理由である。

### エンティティ

「ユーザー」や「注文」など、一意の識別子(ID)を持つオブジェクト。システムの中で「誰が」「何が」を特定し、その状態を管理するための中心的な存在である。

| 項目 | 内容 |
|------|------|
| 役割 | 属性(名前や住所など)が変化しても、特定の個体として一貫して追跡し続ける必要がある概念を表現する。 |
| 具体例(ユーザー) | ユーザーが「名前」を変更したとしても、システム上では「同じ人物(同一ID)」として認識し続け、過去の注文履歴などを紐付けたままで管理する。 |
| 具体例(注文) | 「未発送」から「発送済み」へステータスが変化しても、その「注文そのもの(注文番号)」は変わらず、一つの取引として成立し続ける。 |

#### コードによる解説

エンティティも値オブジェクトと同様、構造体を直接インスタンス化することはせず、必ず `NewUser` 関数のような生成用関数を経由させる。この関数内で、構成要素となる各値オブジェクトの生成(バリデーション)を強制するのである。

```go
func NewUser(id int, username, email, hashedPassword string) (*User, error) {
    // 各値オブジェクトの生成時にルールを課し、不正な値があればその時点で拒否する
    uid, err := value_objects.NewID(id)
    if err != nil {
        return nil, err
    }
    uname, err := value_objects.NewUsername(username)
    if err != nil {
        return nil, err
    }
    // ...中略...
    return &User{
        ID:             uid,
        Username:       uname,
        Email:          emailVO,
        HashedPassword: hashVO,
    }, nil
}
```

このように、エンティティは「ルールを通過した値オブジェクト」のみを受け入れることで、オブジェクト自身の正当性を担保している。

エンティティ最大の特徴は、システムが終了しても消えないよう「永続化」される必要がある点である。そのため、エンティティには必ず「リポジトリ」という、データの保存・取得を担う部品がセットで必要になる。

しかし、ここで一つ問題が生じる。リポジトリの正体はデータベース(MySQLやPostgreSQLなど)であり、これらは具体的な技術詳細(外側の層)である。クリーンアーキテクチャの原則に従えば、中心部であるドメイン層に具体的な技術を持ち込むことはできない。

そこで、ドメイン層ではインターフェース(約束事)だけを定義する。

```go
type UserRepository interface {
    Create(user *User) (*User, error)
    FindByID(id value_objects.ID) (*User, error)
    // ...中略...
    Update(user *User) error
}
```

このように、ドメイン層では「何ができるか(メソッドの形)」だけを決めておき、「どうやるか(DBへの書き込み)」の実装は必ず外側の層で行うよう約束させるのである。

### ドメインサービス

値オブジェクトやエンティティに持たせると不自然なロジックの受け皿。イメージとしては、エンティティたちがある特定の目的(認証や重複確認など)のために、外部の知恵を借りるための「専門サービス」である。

| 項目 | 内容 |
|------|------|
| 役割 | 個々のエンティティが自分自身の情報だけでは完結できない、システム全体やルールを跨ぐ計算・照合を行う。 |
| 具体例(認証) | ユーザー(エンティティ)が、入力されたパスワードが正しいかを判定するために「認証サービス(AuthDomainService)」を使用し、その結果を受け取る。 |
| 具体例(重複) | 新規ユーザーが、自分の希望する名前が既に使われていないかを「ユーザー重複確認サービス」を使用してチェックする。 |

ドメインモデル欠乏症を防ぐため、ドメインサービスは最低限にする。VO / エンティティに自然に載る正規化・バリデーション・判定は VO / エンティティへ置く。

---

## 2. ユースケース層

### ユースケース

「ユーザーを登録する」「商品を注文する」といった、システムの具体的な「機能」を実現する場所である。ドメイン層が「ルール」なら、ユースケース層はそれらを組み合わせて目的を果たす「手順(シナリオ)」を記述する。

| 項目 | 内容 |
|------|------|
| 役割 | ドメインオブジェクト(エンティティやサービス)を呼び出し、一つの業務目的を達成するための一連の処理の流れをコントロールする。 |
| 具体例(ユーザー登録) | 1. 入力値のバリデーション、2. ドメインサービスによる重複チェック、3. エンティティの生成、4. リポジトリによる保存、という手順を指揮する。 |
| 具体例(注文処理) | 在庫の確認、注文エンティティの作成、支払処理の実行、配送予約といった、複数のドメイン知識を跨ぐ「一連のフロー」を完結させる。 |

#### コードによる解説

ユースケースオブジェクトは、ドメインオブジェクト(値オブジェクト、エンティティ、ドメインサービス)とインターフェース(リポジトリ、プレゼンター)を駆使しながら、そのユースケースが実現したいシナリオ(例: ユーザー作成)を組み立てる。

ユースケースは外側(`infrastructure` / `adapter` の具象)に依存してはならない。ドメインオブジェクトとインターフェースのみを使う。

プレゼンターはユースケースの結果を「外の世界」へ伝える役割を持つが、ユースケース自体が特定の技術(JSONやHTMLなど)に依存しないよう、以下のようにインターフェースとして定義する。

```go
type UserSignupPresenter interface {
	Output(user *entities.User, token string) *UserSignupOutput
}
```

コード内の以下のユースケース入出力の定義について:

```go
type UserSignupInput struct {
	Username string
	Email    string
	Password string
}

type UserSignupOutput struct {
	ID    int
	Token string
}
```

値オブジェクトとして Username や Email、ID などをすべて定義したにもかかわらず、なぜ改めて string 型や int 型で定義し直しているのか。

その理由を理解するには、まずユースケースオブジェクトの役割を把握する必要がある。

ユースケースオブジェクトの本来の役割は、ドメインオブジェクト(値オブジェクト、エンティティ、ドメインサービス)を組み合わせて、システムとしての具体的な機能(ユーザー登録など)を実行することにある。

しかし、ユースケースオブジェクトは「ドメイン世界」と「現実世界」のちょうど境界線に位置している。

コンピュータの中の概念であるドメインオブジェクトは、ビジネスルールを守るために「特殊な型」をしているが、私たち人間やブラウザがやり取りできるのは、もっと一般的で扱いやすい 「数値(int)」や「文字列(string)」などのプリミティブ型 だけである。

つまり、ユースケースオブジェクトという機能を外から実行しようとしたとき、その入り口(入力)と出口(出力)だけは、現実世界でも話が通じる言葉で用意されていなければならない。

`UserSignupInput` は、現実世界側の入力、つまりユースケースオブジェクトが機能を開始するために受け取れる「現実世界の言葉」である。

`UserSignupOutput` は、機能が完了したあとに返される「現実世界側の出力」である。

「なぜドメインオブジェクトを使わずに、わざわざ string や int に戻しているのか?」

その問いの答えは、現実世界からユースケースを呼び出し、その結果を私たちが正しく受け取るためには、入り口と出口が「共通言語」であるプリミティブ型で定義されている必要があるから。

---

## 3. アダプタ層

この層は、現実世界(HTTPリクエストなど)と内部のビジネスロジック(ユースケース)の間で、データの形式を翻訳する役割を担う。

### コントローラー

外部(ブラウザやAPIクライアント)からのリクエストを一番に受け取る窓口である。

| 項目 | 内容 |
|------|------|
| 役割 | HTTPリクエストなどの外部入力を受け取り、ユースケースが理解できるデータ形式(Input DTO)に整理して橋渡しを行う。 |
| 具体例(入力) | JSON形式で送られてきたユーザー情報を解析(パース)し、UserSignupInput 構造体に詰め替えてユースケースの実行関数へ渡す。 |
| 具体例(交通整理) | 認証トークンの有無を確認したり、リクエストが正しい形式でない場合に早期にエラーを返したりする「受付室」のような振る舞いをする。 |

#### コードによる解説

コントローラーは、後ほど解説する「ルーター」というオブジェクトから送られてくる情報を、ユースケースオブジェクトが要求する形式(先述の UserSignupInput)に変換した上で、ユースケースを実行し、その結果をルーターへと返却する役割を担う。

「そのままルーターに返してしまって問題ないのか」と疑問に思うかもしれない。しかし、ユースケースオブジェクトの内部において、プレゼンターを通じてすでに現実世界の形式へと変換されているため、そのまま返却しても支障はないのである。

### プレゼンター

ユースケースの実行結果を受け取り、クライアントが表示しやすい形式に変換する担当である。

| 項目 | 内容 |
|------|------|
| 役割 | ユースケースから返された出力(Output DTO)を、最終的なレスポンス形式(JSON、HTML、XMLなど)に整形して返す。 |
| 具体例(JSON変換) | 登録完了したユーザーのIDやトークンを、「成功ステータス」と共に綺麗なJSONフォーマットに整えてレスポンスとして出力する。 |
| 具体例(多言語・形式対応) | 同じ実行結果であっても、スマホアプリ向けにはJSON、ブラウザ向けにはHTMLといったように、出力先に応じた「見せ方」を調整する。 |

#### コードによる解説

プレゼンターはドメイン世界の情報を現実世界の情報(ユースケースの UserSignupOutput)に変換するオブジェクトである。

---

## 4. インフラストラクチャ層

この層は、データベースやWebフレームワーク、外部APIといった「具体的な技術」が配置される、最も外側の層である。内側の層(ドメイン層やユースケース層)が決めた「ルール」や「約束(インターフェース)」を、現実の技術を使って実現する役割を担う。

### ルーター

ルーターは単なるURLの分岐点ではない。クリーンアーキテクチャにおいて、バラバラだった各パーツに命を吹き込み、一つのシステムとして連結する(DI:依存性注入)最も重要な場所である。

| 項目 | 内容 |
|------|------|
| 役割(組み立て) | 各層のパーツを生成し、インターフェースという「穴」に具体的な実装を流し込む(DI)。 |
| 役割(配線) | HTTPメソッドやURLパスを確認し、組み立て済みのコントローラーを呼び出す。 |
| 技術依存 | Echo や Gin といった具体的なフレームワークを使い、通信の入り口を管理する。 |

#### コードによる解説

ルーターは単なるパスの分岐点ではない。クリーンアーキテクチャにおいて、各層でバラバラに定義されたパーツを結合し、システムとして命を吹き込む「組み立て工場」の役割を担う。

具体的には、ドメイン層やユースケース層で定義したインターフェース(リポジトリ、ドメインサービス、プレゼンター)に対して、インフラ層やアダプタ層で作った「具体的な実装」をDI(依存性注入)していく場所である。

クリーンアーキテクチャにおける「依存性」の正体は、MySQLやPostgreSQL、あるいは外部APIといった「具体的な技術」そのものである。
ドメイン層では「データを保存する」というインターフェース(メソッドの約束事)だけを決めておき、中身は空っぽにしておく。その空っぽの約束事に対して、「今回はPostgreSQLを使ってこう実現する」という具体的な技術を流し込み、実体を持たせる。

これこそが技術(依存性)の注入である。

```go
// 1. インフラ層(Repository / Domain Impl)の初期化
spotRepo := postgres.NewSpotRepository(db)
postRepo := postgres.NewPostRepository(db)
userRepo := postgres.NewUserRepository(db)
```

各パーツを実装後、それらを使用してユースケースを初期化し、さらにそのユースケースをコントローラーに渡し、最終的にHTTPパスへと紐付ける。

(HTTP 以外の入口がある場合も、同様の DI 組み立てを外側の Composition Root で行う。)

### リポジトリ

データの保存や取得の実務を担当する「裏方」である。

| 項目 | 内容 |
|------|------|
| 役割 | ドメイン層で定義されたインターフェース(UserRepository等)を実装し、具体的な保存処理を行う。 |
| 具体例(DB操作) | SQLを発行してMySQLにデータを保存したり、Redisからキャッシュを取得したりといった「生臭い」処理を一手に引き受ける。 |
| 具体例(隠蔽) | ユースケース層に対しては「データがどこにあるか」を意識させず、まるでメモリ上にデータがあるかのように振る舞う。 |

#### コードによる解説

エンティティの層でインターフェースとして定義したリポジトリを、ここで具体的に実装する。PostgreSQL でも MySQL でも、他のどのようなデータベースであっても同様に実装が可能である。

## 模範リポジトリ(お手本)

本プロジェクト(AgentHub)の実バックエンドは既にこのクリーンアーキテクチャに従っている。以下は URL を貼るだけでなく、実際にコードを clone して中身を読み、本ガイドの主張を裏付けた記録である。

### cosmicpython/code(『Architecture Patterns with Python』サンプル)

`chapter_06_uow` ブランチの実ファイル構成:

```text
src/allocation/
  domain/model.py               # Batch, OrderLine, allocate()（純粋なドメインロジック）
  adapters/repository.py        # AbstractRepository(ABC) / SqlAlchemyRepository
  service_layer/
    unit_of_work.py             # AbstractUnitOfWork(ABC) / SqlAlchemyUnitOfWork
    services.py                 # add_batch() / allocate()（ユースケース関数）
  entrypoints/flask_app.py      # Flask ルート = 本ガイドの「ルーター」
```

`adapters/repository.py` は「ドメイン層はリポジトリのインターフェースだけを持ち、実装は外側」という本ガイド 4章の原則をそのままコードにしている(抜粋):

```python
class AbstractRepository(abc.ABC):
    @abc.abstractmethod
    def add(self, batch: model.Batch):
        raise NotImplementedError

    @abc.abstractmethod
    def get(self, reference) -> model.Batch:
        raise NotImplementedError


class SqlAlchemyRepository(AbstractRepository):
    def __init__(self, session):
        self.session = session

    def add(self, batch):
        self.session.add(batch)

    def get(self, reference):
        return self.session.query(model.Batch).filter_by(reference=reference).one()
```

`service_layer/unit_of_work.py` は、Session の生成・commit・rollback・close を 1 つの `with` ブロックに閉じ込め、リポジトリ生成もこの中で行う Unit of Work パターンの実装である(抜粋):

```python
class AbstractUnitOfWork(abc.ABC):
    batches: repository.AbstractRepository

    def __enter__(self) -> "AbstractUnitOfWork":
        return self

    def __exit__(self, *args):
        self.rollback()  # commit されなければ既定でロールバック


class SqlAlchemyUnitOfWork(AbstractUnitOfWork):
    def __enter__(self):
        self.session = self.session_factory()
        self.batches = repository.SqlAlchemyRepository(self.session)
        return super().__enter__()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()
```

そして `service_layer/services.py` の `allocate()` は、ユースケース関数が UoW とドメインモデルだけを使い、Flask や SQLAlchemy そのものを知らないことを示している:

```python
def allocate(orderid: str, sku: str, qty: int, uow: unit_of_work.AbstractUnitOfWork) -> str:
    line = OrderLine(orderid, sku, qty)
    with uow:
        batches = uow.batches.list()
        if not is_valid_sku(line.sku, batches):
            raise InvalidSku(f"Invalid sku {line.sku}")
        batchref = model.allocate(line, batches)
        uow.commit()
    return batchref
```

**このプロジェクトへのマッピング:** 本ガイドの「ユースケース」は `services.allocate` に、「リポジトリ IF」は `AbstractRepository` に、「ルーター(組み立て工場)」は `SqlAlchemyUnitOfWork` を DI する部分に相当する。ただし cosmicpython は 1 トランザクションで複数リポジトリ操作をまとめる Unit of Work を明示的なオブジェクトとして持つ点が、本ガイドの `repository_base.py` の `session_scope`(1 リポジトリ単位のスコープ)より一段抽象度が高い。複数リポジトリを跨ぐ整合性が必要なユースケースが増えたら、この UoW パターンの導入を検討する価値がある。

### cdddg/py-clean-arch

README は「entities/usecases/interface-adapters/infrastructure」を謳うが、実際に clone してディレクトリを読むと、その名前そのままのフォルダ構成ではなく次の実構成になっている:

```text
src/
  models/pokemon.py                        # dataclass のドメイン/DTO モデル(entities 相当)
  usecases/pokemon.py                      # ユースケース関数
  repositories/
    abstraction/pokemon.py                 # AbstractPokemonRepository(ABC) = ドメイン側 IF
    relational_db/pokemon/{orm.py, mapper.py, repository.py}  # RDB 実装
    document_db/ , key_value_db/           # 同じ IF に対する Mongo/Redis 実装も並存
  controllers/rest/pokemon/router.py       # アダプタ層(REST)
  controllers/graphql/pokemon/             # アダプタ層(GraphQL)
  di/unit_of_work.py                       # Composition Root
```

つまり実体は 4 フォルダの直訳ではなく、**同じ IF(`repositories/abstraction/`)に対して RDB / Document DB / KVS の 3 種類の実装を並べて依存性逆転を体現する**構成である。抽象リポジトリはこう定義されている(抜粋):

```python
class AbstractPokemonRepository(abc.ABC):
    @abc.abstractmethod
    async def get(self, no: PokemonNumberStr) -> PokemonModel: ...
    @abc.abstractmethod
    async def create(self, data: CreatePokemonModel) -> PokemonNumberStr: ...
```

ユースケースはこの IF だけを触り、DI 経由で受け取った Unit of Work からリポジトリを取り出す:

```python
async def create_pokemon(async_unit_of_work: AbstractUnitOfWork, data: CreatePokemonModel) -> PokemonModel:
    async with async_unit_of_work as auow:
        no = await auow.pokemon_repo.create(data)
        await auow.pokemon_repo.replace_types(no, data.type_names)
        return await auow.pokemon_repo.get(no)
```

**このプロジェクトへのマッピング:** `repositories/abstraction/pokemon.py` は本ガイドのドメイン層 `UserRepository interface` に、`repositories/relational_db/pokemon/{orm.py, mapper.py, repository.py}` は `backend/infrastructure/gateways/postgres/{models/schema.py, operations/repositories/*_repository.py}` に相当する。1 点、本プロジェクトの慣習と違うのは、cdddg 版はリポジトリ自身がドメイン例外(`PokemonNotFound` 等)を送出している点である。「リポジトリは永続化のみ、判定はユースケース/ドメイン」という原則との境界線をどこに引くかは、実装時に意識して選ぶ必要がある。

### zhanymkanov/fastapi-best-practices

コードリポジトリではなく Markdown 一枚のベストプラクティス集だが、実際に README を読むと「Project Structure」節に Netflix Dispatch 由来の具体的なディレクトリ例が載っている:

```text
fastapi-project
├── alembic/
├── src
│   ├── auth/   {router.py, schemas.py, models.py, dependencies.py, config.py, constants.py, exceptions.py, service.py, utils.py}
│   ├── posts/  (同様の構成)
│   ├── config.py / models.py / exceptions.py / database.py / main.py   # グローバル
```

ドメインを跨ぐ import は `from src.auth import constants as auth_constants` のように**明示的なモジュール名付き**で行う、という規約も明記されている。本ガイドの「usecase から外側具象を直接 import しない」原則と直接は対応しないが、ドメイン単位でパッケージを割り、パッケージ間の依存を明示するという考え方は、`backend/` 配下でユースケースやリポジトリをドメインごとに束ねる際の実務的なヒントになる。

### 参考リンク

- [cosmicpython/code](https://github.com/cosmicpython/code) — 特に `chapter_06_uow` ブランチ
- [cdddg/py-clean-arch](https://github.com/cdddg/py-clean-arch)
- [zhanymkanov/fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices)
