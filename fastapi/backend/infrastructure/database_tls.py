from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Supabase の DB は自社のルート CA で署名した証明書を出す。libpq の sslmode=require は暗号化だけで
# 接続先の証明書もホスト名も確かめないため、経路上で接続先を偽装されると会話本文や DB の資格情報を
# 渡してしまう。Supabase への接続は、同梱した公式 CA で証明書とホスト名を検証する verify-full に固定する。
# 配布元: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
# (CN=Supabase Root 2021 CA、2031-04-26 まで有効。管理画面の nextjs/frontend/lib/admin/supabase-ca.ts と同じ)
SUPABASE_ROOT_CA_PATH = Path(__file__).resolve().parent / "certs" / "supabase-prod-ca-2021.crt"
SUPABASE_HOST_SUFFIXES = (".supabase.com", ".supabase.co")
_TLS_KEYS = {"sslmode", "sslrootcert"}


def with_verified_supabase_tls(conninfo: str) -> str:
    """Supabase 宛ての接続文字列(URI 形式)に verify-full と同梱 CA を指定して返す。それ以外はそのまま返す。"""
    if not conninfo.startswith(("postgres://", "postgresql://")):
        return conninfo
    parts = urlsplit(conninfo)
    host = (parts.hostname or "").lower()
    if not host.endswith(SUPABASE_HOST_SUFFIXES):
        return conninfo
    query = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True) if key not in _TLS_KEYS]
    query += [("sslmode", "verify-full"), ("sslrootcert", str(SUPABASE_ROOT_CA_PATH))]
    return urlunsplit(parts._replace(query=urlencode(query)))
