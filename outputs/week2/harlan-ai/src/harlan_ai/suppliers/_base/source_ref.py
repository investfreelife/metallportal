"""
harlan_ai.suppliers._base.source_ref

Утилиты для генерации SourceRef. Конвертация колонки 0-based → буква Excel.
"""

from .types import SourceRef


def col_letter(col_index_zero_based: int) -> str:
    """0 → 'A', 25 → 'Z', 26 → 'AA', 701 → 'ZZ'."""
    if col_index_zero_based < 0:
        raise ValueError(f"col index must be >=0, got {col_index_zero_based}")
    s = ""
    n = col_index_zero_based
    while True:
        n, r = divmod(n, 26)
        s = chr(65 + r) + s
        if n == 0:
            break
        n -= 1
    return s


def make_source_ref(
    file: str,
    sheet: str,
    row_zero_based: int,
    col_zero_based: int,
) -> SourceRef:
    """Конструктор SourceRef из 0-based индексов."""
    return SourceRef(
        file=file,
        sheet=sheet,
        row=row_zero_based + 1,             # Excel 1-based
        col=col_letter(col_zero_based),
    )
