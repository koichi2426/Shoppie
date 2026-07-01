# モール API 連携

## 概要

Shoppie は 3 つの EC モール API と連携します。エージェントがツール経由で呼び出し、結果をマージ・厳選して表示します。

| モール | 実装ファイル | 認証 |
|--------|-------------|------|
| Yahoo!ショッピング | `gateways/yahoo/yahoo_api.py` | `YAHOO_APP_ID` |
| 楽天市場 | `gateways/rakuten/rakuten_api.py` | `RAKUTEN_APP_ID` + `RAKUTEN_ACCESS_KEY` |
| Amazon.co.jp | `gateways/amazon/amazon_api.py` | Creators API または PA-API |

設定の有無は `infrastructure/marketplace_config.py` で判定します。

## 検索の呼び出し方

### デフォルト（モール指定なし）

利用可能な **すべてのモール**のツールを並列実行します。

### モール指定時

ユーザーが「Amazonで」「楽天で」などと言った場合は、そのモールのツールのみ実行します。

## Yahoo!ショッピング API

- **エンドポイント**: `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch`
- **取得件数**: 20 件（API パラメータ `results`）
- **アフィリエイト**: ValueCommerce（`VC_SID`, `VC_PID`）または `YAHOO_AFFILIATE_ID`
- **付加情報**: レビュー評価・件数（厳選スコアに使用）

### 主なフィルター

| パラメータ | 説明 |
|-----------|------|
| `sort` | `-score`（おすすめ）, `+price`, `-price`, `-review_count` |
| `price_from` / `price_to` | 価格帯 |
| `condition` | `new` / `used` |
| `shipping` | `free` / `conditional_free` |

## 楽天市場 API

- **エンドポイント**: `https://openapi.rakuten.co.jp/es/2.0/ichiba/item/search`
- **認証**: `Authorization: Bearer {RAKUTEN_ACCESS_KEY}` + `X-App-Id`
- **取得件数**: 10 件（`hits`）
- **必須ヘッダ**: `Origin` / `Referer`（`RAKUTEN_HTTP_REFERER`）

### 主なフィルター

| パラメータ | 説明 |
|-----------|------|
| `minPrice` / `maxPrice` | 価格帯 |
| `sort` | `standard`, `+itemPrice`, `-itemPrice`, `-reviewCount` |
| `availability` | 在庫あり（デフォルト 1） |

## Amazon

### 優先順位

1. **Creators API**（推奨・PA-API 後継）
2. **PA-API 5.0**（後方互換）
3. **アソシエイト検索リンク**（API 資格不足時のフォールバック）

### Creators API

- **認証**: OAuth 2.0（日本は `api.amazon.co.jp/auth/o2/token`）
- **バージョン**: `AMAZON_CREATORS_VERSION=3.3`（`v` プレフィックスなし）
- **発行**: https://affiliate.amazon.co.jp/creatorsapi

```
AMAZON_CREATORS_CREDENTIAL_ID=
AMAZON_CREATORS_CREDENTIAL_SECRET=
AMAZON_CREATORS_VERSION=3.3
AMAZON_PARTNER_TAG=
AMAZON_MARKETPLACE=www.amazon.co.jp
```

### 利用資格（重要）

Creators API / PA-API ともに、**過去 30 日間に適格な発送済み売上が 10 件以上**必要です。

資格不足時:

```
AssociateNotEligible
Your account does not currently meet the eligibility requirements.
```

この場合、パートナータグ付き **検索リンク 1 件**のみ返却されます（商品カード一覧は不可）。

- Amazon デバイス、Prime Video、ギフトカード等は適格売上にカウントされない
- 10 件を超えると通常は自動復帰（発送から最大 48 時間程度のラグあり）

### PA-API 5.0（後方互換）

```
AMAZON_ACCESS_KEY=
AMAZON_SECRET_KEY=
AMAZON_REGION=us-west-2
```

Creators API が設定されていればそちらが優先されます。

## 商品厳選後の表示

| 段階 | 件数 |
|------|------|
| Yahoo API 返却 | 最大 20 |
| 楽天 API 返却 | 最大 10 |
| Amazon API 返却 | 最大 30（または検索リンク 1） |
| マージ後 | 最大 90 |
| **画面表示（厳選後）** | **最大 10** |

厳選ロジック: `infrastructure/product_curation.py`
