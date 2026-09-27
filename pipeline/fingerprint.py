"""Checksum of the whole corpus, used to prove that a rebuild produces the same output.

    python -m pipeline.fingerprint
"""
import hashlib
import sys

from . import config


def fingerprint():
    digest = hashlib.sha256()
    for path in sorted(config.CORPUS.rglob("*.json"), key=lambda p: p.as_posix()):
        digest.update(p_rel(path).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def p_rel(path):
    return path.relative_to(config.CORPUS).as_posix()


if __name__ == "__main__":
    files = sum(1 for _ in config.CORPUS.rglob("*.json"))
    print(f"{fingerprint()}  ({files} berkas)", file=sys.stdout)
