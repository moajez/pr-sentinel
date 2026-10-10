"""Parse unified-diff patches into added lines with new-file line numbers."""
import re
from dataclasses import dataclass, field

HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")


@dataclass
class FileDiff:
    path: str
    patch: str
    added_lines: set[int] = field(default_factory=set)  # commentable new-file lines

    def annotated(self) -> str:
        """Patch with new-file line numbers prefixed so the LLM can cite them."""
        return annotate_patch(self.patch)


def parse_added_lines(patch: str) -> set[int]:
    """Return new-file line numbers for '+' and context lines (valid review anchors)."""
    lines: set[int] = set()
    new_line = 0
    for raw in patch.splitlines():
        m = HUNK_RE.match(raw)
        if m:
            new_line = int(m.group(1))
            continue
        if not new_line:
            continue
        if raw.startswith("-"):
            continue
        if raw.startswith("\\"):  # "\ No newline at end of file"
            continue
        lines.add(new_line)
        new_line += 1
    return lines


def annotate_patch(patch: str) -> str:
    out: list[str] = []
    new_line = 0
    for raw in patch.splitlines():
        m = HUNK_RE.match(raw)
        if m:
            new_line = int(m.group(1))
            out.append(raw)
        elif raw.startswith("-") or raw.startswith("\\") or not new_line:
            out.append(f"     {raw}")
        else:
            out.append(f"{new_line:>5} {raw}")
            new_line += 1
    return "\n".join(out)


def build_file_diffs(files: list[dict], max_files: int = 40, max_chars: int = 60000) -> list[FileDiff]:
    """Convert GitHub `pulls/files` entries into FileDiffs, skipping binary/removed/oversized."""
    diffs: list[FileDiff] = []
    total = 0
    for f in files:
        patch = f.get("patch")
        if not patch or f.get("status") == "removed":
            continue
        if total + len(patch) > max_chars or len(diffs) >= max_files:
            break
        total += len(patch)
        diffs.append(FileDiff(path=f["filename"], patch=patch, added_lines=parse_added_lines(patch)))
    return diffs

