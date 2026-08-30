"""Validated Anthropic client construction and per-request Erebor metadata."""

from __future__ import annotations

from typing import Any, Mapping, Optional
from uuid import uuid4

from app.config import Settings, settings, validate_anthropic_base_url


def _required(value: str, name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"Missing required Anthropic configuration: {name}")
    return normalized


def get_anthropic_model(config: Settings = settings) -> str:
    return _required(config.anthropic_model, "anthropic_model")


def request_headers(
    config: Settings = settings, request_id: Optional[str] = None
) -> Mapping[str, str]:
    validate_anthropic_base_url(config.anthropic_base_url)
    task_class = _required(config.anthropic_task_class, "anthropic_task_class")
    resolved_id = request_id.strip() if request_id else str(uuid4())
    if not resolved_id:
        raise ValueError("Anthropic request_id must not be empty")
    return {
        "x-erebor-request-id": resolved_id,
        "x-erebor-task-class": task_class,
    }


def create_anthropic_client(
    api_key: Optional[str] = None, config: Settings = settings
) -> Any:
    from anthropic import Anthropic

    resolved_api_key = (
        _required(api_key, "anthropic_api_key")
        if api_key is not None
        else _required(config.anthropic_api_key, "anthropic_api_key")
    )
    return Anthropic(
        api_key=resolved_api_key,
        base_url=validate_anthropic_base_url(config.anthropic_base_url),
        default_headers={
            "x-erebor-task-class": _required(
                config.anthropic_task_class, "anthropic_task_class"
            )
        },
    )


def request_options(
    config: Settings = settings, request_id: Optional[str] = None
) -> Mapping[str, Mapping[str, str]]:
    return {"extra_headers": request_headers(config, request_id)}
