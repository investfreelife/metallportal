"""
conftest для тестов парсера. Не требует Supabase — используется FakeClient.
"""
from __future__ import annotations
import uuid
from pathlib import Path
import pytest

# делаем пакет импортируемым
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))


# ─── Fake Supabase ────────────────────────────────────────────────────────
class _FakeRpcResponse:
    def __init__(self, data):
        self.data = data

class _FakeRpc:
    def __init__(self):
        self.calls = []

    def __call__(self, name, params):
        # Имитируем поведение upsert_supplier_offer / create_parsing_question:
        # возвращаем выдуманный uuid
        self.calls.append((name, params))
        return self

    def execute(self):
        return _FakeRpcResponse(str(uuid.uuid4()))


class FakeSupabase:
    def __init__(self):
        self.rpc_log: list[tuple[str, dict]] = []

    def rpc(self, name, params):
        self.rpc_log.append((name, params))
        class _Exec:
            def execute(_):
                return _FakeRpcResponse(str(uuid.uuid4()))
        return _Exec()

    def table(self, _name):
        # упрощённо: для тестов парсера прямой работы с table не нужно
        raise NotImplementedError("FakeSupabase.table not used in parser tests")


@pytest.fixture
def fake_sb():
    return FakeSupabase()


# ─── Fixture: пути к реальным прайсам ─────────────────────────────────────
@pytest.fixture
def fixtures_dir():
    """
    Папка с тестовыми .xls. По умолчанию ищет:
      tests/fixtures/metallservice/*.xls
    Если не найдено — пропускает тесты (skip).
    """
    return Path(__file__).resolve().parents[1] / "fixtures" / "metallservice"
