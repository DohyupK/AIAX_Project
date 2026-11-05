# 팀용 Flink 이미지: Flink 2.2.1 + PyFlink(Python 3.12) + Kafka 커넥터
# 기본 Flink 이미지에는 Python이 없고, OS 기본 Python 버전은 PyFlink 지원 범위(3.9~3.12)를 벗어날 수 있어
# uv로 Python 3.12를 직접 지정해 설치한다.
FROM flink:2.2.1-java17

# Flink 2.x 이미지는 flink 사용자로 실행되므로, 설치 단계만 root로 전환
USER root

# uv 실행 파일만 복사 (Python 설치·패키지 설치 도구)
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /usr/local/bin/uv

# PyFlink 의존 패키지 중 일부(pemja 등)는 설치 시 컴파일이 필요할 수 있어 컴파일러를 함께 설치
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc g++ \
 && rm -rf /var/lib/apt/lists/*

# flink 사용자도 읽을 수 있도록 /opt 아래에 Python과 가상환경 설치
ENV UV_PYTHON_INSTALL_DIR=/opt/uv-python
RUN uv python install 3.12 \
 && uv venv /opt/pyflink --python 3.12 \
 && uv pip install --python /opt/pyflink/bin/python --no-cache apache-flink==2.2.1 \
 && ln -sf /opt/pyflink/bin/python /usr/local/bin/python \
 && ln -sf /opt/pyflink/bin/python /usr/local/bin/python3 \
 && chmod -R a+rX /opt/uv-python /opt/pyflink

# Kafka 커넥터 (Flink 2.2용)
ADD --chmod=644 https://repo1.maven.org/maven2/org/apache/flink/flink-sql-connector-kafka/5.0.0-2.2/flink-sql-connector-kafka-5.0.0-2.2.jar /opt/flink/lib/

# 실행은 다시 flink 사용자로
USER flink
