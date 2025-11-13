import os
import pytest
import importlib  # config 모듈을 새로고침(reload)하기 위해 import

# 'Settings' 클래스 대신 'config' 모듈 자체를 import 합니다.
from back.app import config


def test_config_loads_defaults(monkeypatch):
    """
    back/app/config.py가 환경 변수가 없을 때 기본값을 잘 로드하는지 테스트합니다.

    """
    # monkeypatch: pytest의 기능으로, 이 테스트 동안만 환경 변수를 조작합니다.
    monkeypatch.delenv("INFLUX_URL", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)

    # config.py 파일은 스크립트 로드 시점에 os.getenv()를 실행합니다.
    # 따라서 모듈을 강제로 '다시 로드'해야 변경된 환경 변수를 감지합니다.
    importlib.reload(config)

    # config.py에 정의된 기본값과 일치하는지 확인
    assert config.INFLUX_URL == "http://influxdb3-core:8181"
    assert config.LLM_MODEL == "llama3:8b"


def test_config_reads_env_vars(monkeypatch):
    """
    back/app/config.py가 환경 변수를 잘 읽어오는지 테스트합니다.

    """
    # 테스트용 가짜 환경 변수를 설정합니다.
    monkeypatch.setenv("INFLUX_URL", "http://my-test-url.com")
    monkeypatch.setenv("LLM_MODEL", "test-model")

    # config 모듈을 다시 로드하여 새 환경 변수를 반영합니다.
    importlib.reload(config)

    # 환경 변수로 덮어쓴 값이 잘 적용되었는지 확인
    assert config.INFLUX_URL == "http://my-test-url.com"
    assert config.LLM_MODEL == "test-model"