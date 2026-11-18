"""임시: .env 메타만 출력 (비밀 없음). 확인 후 삭제."""
from pathlib import Path
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1]
env: dict[str, str] = {}
for line in root.joinpath(".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

u = urlparse(env.get("DATABASE_URL", ""))
print("DATABASE_URL user=", u.username)
print("DATABASE_URL host=", u.hostname)
print("DATABASE_URL port=", u.port)
print("DATABASE_URL db=", (u.path or "").lstrip("/"))
print("has APP_MES_PASSWORD", bool(env.get("APP_MES_PASSWORD")))
print("has APP_SPARK_PASSWORD", bool(env.get("APP_SPARK_PASSWORD")))
print("AIAX_MES", "AIAX_MES_DATABASE_URL" in env)
print("AIAX_SPARK", "AIAX_SPARK_DATABASE_URL" in env)
print("AIAX_KAFKA", env.get("AIAX_KAFKA_BOOTSTRAP", "(default)"))
