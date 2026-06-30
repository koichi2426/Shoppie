# ベースとなるPythonイメージを指定
FROM python:3.10-slim

# コンテナ内の作業ディレクトリを設定
WORKDIR /app

# Pythonのパスを設定し、プロジェクト内のモジュールを正しくインポートできるようにする
ENV PYTHONPATH=/app

# まずは依存関係ファイルのみをコピーして、キャッシュを有効活用
COPY ./requirements.txt /app/

# pipでライブラリをインストール
RUN pip install --no-cache-dir -r requirements.txt

# プロジェクトのソースコードをコンテナ内にコピー
COPY . /app

# コンテナがリッスンするポートを指定
EXPOSE 8000

# ★ここを修正: Gunicornを使って本番環境でアプリケーションを起動
# 4つのワーカープロセスを起動し、それぞれがUvicornとして動作します
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "main:app", "--bind", "0.0.0.0:8000"]