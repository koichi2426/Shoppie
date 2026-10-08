from urllib.parse import parse_qs, urlsplit

from infrastructure.database_tls import SUPABASE_ROOT_CA_PATH, with_verified_supabase_tls


def _query(conninfo):
    return parse_qs(urlsplit(conninfo).query)


def test_supabase_require_is_upgraded_to_verify_full():
    url = "postgresql://postgres.ref:p%40ss@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

    result = with_verified_supabase_tls(url)

    query = _query(result)
    assert query["sslmode"] == ["verify-full"]
    assert query["sslrootcert"] == [str(SUPABASE_ROOT_CA_PATH)]
    # 認証情報やホストは書き換えない
    assert urlsplit(result).netloc == "postgres.ref:p%40ss@aws-0-ap-northeast-1.pooler.supabase.com:5432"


def test_weaker_modes_and_other_params_are_handled():
    url = "postgresql://u:p@db.ref.supabase.co:5432/postgres?sslmode=disable&application_name=shoppie"

    query = _query(with_verified_supabase_tls(url))

    assert query["sslmode"] == ["verify-full"]
    assert query["application_name"] == ["shoppie"]


def test_non_supabase_and_keyword_conninfo_are_unchanged():
    local = "postgresql://shoppie:local-development-only@db:5432/shoppie"
    keyword = "host=db.ref.supabase.co dbname=postgres sslmode=require"

    assert with_verified_supabase_tls(local) == local
    assert with_verified_supabase_tls(keyword) == keyword


def test_bundled_ca_exists():
    assert SUPABASE_ROOT_CA_PATH.read_text().startswith("-----BEGIN CERTIFICATE-----")
