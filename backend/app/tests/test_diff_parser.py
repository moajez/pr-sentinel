from app.schemas.review import CodeFinding, PRReviewResult
from app.services.diff_parser import annotate_patch, build_file_diffs, parse_added_lines
from app.services.github_poster import split_findings

PATCH = """@@ -1,3 +1,4 @@
 import os
-x = 1
+x = 2
+y = 3
 print(x)
@@ -10,2 +11,2 @@ def f():
-    a
+    b
     c"""


def test_parse_lines():
    assert parse_added_lines(PATCH) == {1, 2, 3, 4, 11, 12}


def test_annotate_numbers_lines():
    out = annotate_patch(PATCH)
    assert "    2 +x = 2" in out
    assert "     -x = 1" in out


def test_build_skips_binary_and_removed():
    files = [
        {"filename": "a.py", "patch": PATCH, "status": "modified"},
        {"filename": "img.png", "status": "added"},
        {"filename": "gone.py", "patch": PATCH, "status": "removed"},
    ]
    assert [d.path for d in build_file_diffs(files)] == ["a.py"]


def test_split_findings():
    diffs = build_file_diffs([{"filename": "a.py", "patch": PATCH, "status": "modified"}])
    mk = lambda ln: CodeFinding(file_path="a.py", line_number=ln, title="t", description="d",
                                severity="low", category="bug")
    res = PRReviewResult(summary="s", quality_score=5, findings=[mk(2), mk(99), mk(None)])
    inline, other = split_findings(res, diffs)
    assert len(inline) == 1 and len(other) == 2
