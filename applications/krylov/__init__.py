"""Independent client-side Chebyshev compilation and polynomial inference.

Mathematical inspiration: https://github.com/chimans/PrivNet-Krylov,
commit 0976e41881192da938ef2ab988c2fe3fdb92835b. No upstream code is used.
"""

from .core import (
    MAX_DEGREE,
    compile_chebyshev_blocks,
    evaluate_affine,
    evaluate_model,
    evaluate_polynomial,
    evaluate_readout,
    normalize_adjacency,
)

__all__ = [
    "MAX_DEGREE", "compile_chebyshev_blocks", "evaluate_affine",
    "evaluate_model", "evaluate_polynomial", "evaluate_readout",
    "normalize_adjacency",
]
