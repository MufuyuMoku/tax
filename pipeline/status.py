"""Build a document's status out of the claims each source makes. Never guesses (SPEC invariant 1).

Every claim is kept verbatim with its source, URL and retrieval date. A single value is only
reported when every claim agrees. Anything else is "tidak_pasti", with the reasons spelled out:

- claims disagree between sources (36% of comparable documents in the proof of concept),
- claims disagree inside one source (duplicate rows),
- a claim is empty,
- a source says it is in force while another regulation's text revokes it.

The normalised vocabulary is deliberately coarse. DJP's "Diubah/Disempurnakan/Dicabut sebagian"
mixes two different legal situations, so it gets its own value and never maps onto "berlaku".
"""

NORMALISED = {
    "berlaku": "berlaku",
    "aktif": "berlaku",
    "tidak berlaku": "tidak_berlaku",
    "dicabut": "tidak_berlaku",
    "diubah/disempurnakan dan sudah dicabut": "tidak_berlaku",
    "tetap": "tetap",
    "diubah/disempurnakan/dicabut sebagian": "diubah_atau_dicabut_sebagian",
}

UNCERTAIN = "tidak_pasti"


def normalise(raw):
    value = (raw or "").strip().lower()
    if not value:
        return "kosong"
    return NORMALISED.get(value, "lain:" + value)


def resolve(claims, revoked_by_text=()):
    """claims: [{source, value_verbatim, url, retrieved_at, ...}] -> status dict.

    The claims list is returned with `value_normalized` filled in; nothing is dropped.
    """
    for claim in claims:
        claim["value_normalized"] = normalise(claim.get("value_verbatim"))

    values = sorted({c["value_normalized"] for c in claims})
    sources = {c["source"] for c in claims}
    reasons = []

    if not claims:
        reasons.append("tidak ada klaim status")
    elif "kosong" in values:
        reasons.append("status kosong di sumber")
    if len(values) > 1:
        reasons.append(
            "status berbeda antar sumber" if len(sources) > 1
            else "status berbeda dalam satu sumber (rekaman ganda)"
        )
    if revoked_by_text and any(v == "berlaku" for v in values):
        reasons.append(
            "sumber menyatakan berlaku, tetapi teks " + ", ".join(revoked_by_text) + " mencabutnya"
        )

    if reasons:
        return {"value": UNCERTAIN, "reasons": reasons}
    return {
        "value": values[0],
        "reasons": [],
        # One source is one claim, never a certainty (M5 criterion). The note names the source and
        # says only what is true now: no second source was compared. It must not suggest that the
        # other source lacks the document (owner, 2026-10-08).
        "note": (f"klaim {next(iter(sources))} saja; belum dibandingkan dengan sumber lain"
                 if len(sources) == 1 else "disepakati JDIH & DJP"),
    }
