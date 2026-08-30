import sys
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.services.anthropic_client import (
    create_anthropic_client,
    get_anthropic_model,
    request_headers,
)


def configured(**overrides):
    values = {
        "anthropic_api_key": "key",
        "anthropic_base_url": "https://twogates.example/anthropic",
        "anthropic_model": "configured-model",
        "anthropic_task_class": "radio.agent",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_request_headers_generate_distinct_ids_and_preserve_supplied_id():
    config = configured()
    first = request_headers(config)
    second = request_headers(config)

    assert first["x-erebor-request-id"] != second["x-erebor-request-id"]
    assert first["x-erebor-task-class"] == "radio.agent"
    assert request_headers(config, "caller-request-7")["x-erebor-request-id"] == "caller-request-7"


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("anthropic_base_url", "", "anthropic_base_url"),
        ("anthropic_base_url", "http://insecure.example", "HTTPS URL"),
        ("anthropic_model", "", "anthropic_model"),
        ("anthropic_task_class", "", "anthropic_task_class"),
    ],
)
def test_provider_configuration_fails_closed(field, value, message):
    config = configured(**{field: value})
    check = get_anthropic_model if field == "anthropic_model" else request_headers
    with pytest.raises(ValueError, match=message):
        check(config)


@pytest.mark.parametrize(
    "base_url",
    [
        "http://insecure.example",
        "https://user:password@twogates.example/anthropic",
        "https://twogates.example/anthropic?mode=proxy",
        "https://twogates.example/anthropic#fragment",
    ],
)
def test_settings_reject_unsafe_anthropic_base_urls(base_url):
    with pytest.raises(ValidationError, match="ANTHROPIC_BASE_URL"):
        Settings(
            anthropic_api_key="key",
            anthropic_base_url=base_url,
            anthropic_model="model",
            anthropic_task_class="radio.agent",
        )


def test_settings_require_provider_fields():
    assert Settings.model_fields["anthropic_api_key"].is_required()
    assert Settings.model_fields["anthropic_base_url"].is_required()
    assert Settings.model_fields["anthropic_model"].is_required()
    assert Settings.model_fields["anthropic_task_class"].is_required()


def test_explicit_whitespace_api_key_is_rejected():
    with pytest.raises(ValueError, match="anthropic_api_key"):
        create_anthropic_client("   ", configured())


@pytest.mark.parametrize(
    "base_url",
    [
        "http://insecure.example",
        "https://user:password@twogates.example/anthropic",
        "https://twogates.example/anthropic?mode=proxy",
        "https://twogates.example/anthropic#fragment",
    ],
)
def test_request_headers_and_client_reject_unsafe_config_like_urls(base_url, monkeypatch):
    config = configured(anthropic_base_url=base_url)
    with pytest.raises(ValueError):
        request_headers(config)

    class AnthropicConstructor:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    monkeypatch.setitem(sys.modules, "anthropic", SimpleNamespace(Anthropic=AnthropicConstructor))
    with pytest.raises(ValueError):
        create_anthropic_client(config=config)


def test_model_is_read_from_typed_configuration():
    assert get_anthropic_model(configured(anthropic_model="model-from-config")) == "model-from-config"
