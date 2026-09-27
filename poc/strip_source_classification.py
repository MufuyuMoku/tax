"""Remove the sources' own classification fields from the committed data files.

The sources' classification (JDIH `label`/`tematik`, DJP `kategori`/`tag`) stays copyrighted
even though the regulation text itself does not (SPEC section 9). The PPh selection that used
those fields is finished and its result is kept in `alasan`, so the fields are no longer needed.
Full copies live outside the repo; this script only rewrites what is committed.

Idempotent: running it again on already-stripped files changes nothing.
"""
import json
from pathlib import Path

TARGETS = {
    "data/jdih_metadata.jsonl": ("label", "tematik"),
    "data/djp_pph_detail.jsonl": ("kategori", "tag"),
    "data/jdih_pph_candidates.jsonl": ("label",),
}
POC = Path(__file__).parent


def strip_jsonl(path, fields):
    src = POC / path
    out_lines, removed = [], 0
    for line in src.open(encoding="utf8"):
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        for f in fields:
            if f in rec:
                del rec[f]
                removed += 1
        out_lines.append(json.dumps(rec, ensure_ascii=False))
    src.write_text("\n".join(out_lines) + "\n", encoding="utf8")
    return len(out_lines), removed


if __name__ == "__main__":
    for path, fields in TARGETS.items():
        n, removed = strip_jsonl(path, fields)
        print(f"{path}: {n} baris, {removed} bidang dihapus ({', '.join(fields)})")
