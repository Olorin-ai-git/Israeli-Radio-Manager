"""Common utility functions shared across the application."""
from typing import Any, List, Optional, TypeVar

T = TypeVar('T')


def get_first(value: Any) -> Optional[Any]:
    """
    Extract the first element from a list or return the value as-is.

    Args:
        value: Either a list or a single value

    Returns:
        First element if list, otherwise the value itself

    Example:
        >>> get_first(['hello', 'world'])
        'hello'
        >>> get_first('single')
        'single'
        >>> get_first([])
        None
    """
    if isinstance(value, list):
        return value[0] if value else None
    return value
