from app.services.secret_scanner import redact


def test_redacts_known_secrets():
    text = "\n".join([
        '+aws = "AKIAIOSFODNN7EXAMPLE"',
        "+gh = ghp_" + "a" * 36,
        '+password = "hunter2hunter2"',
        "+Authorization: Bearer abcdefghijklmnopqrstuvwxyz123",
    ])
    out, counts = redact(text)
    for leaked in ("AKIAIOSFODNN7EXAMPLE", "ghp_aaaa", "hunter2hunter2", "abcdefghijklmnop"):
        assert leaked not in out
    assert counts["aws_access_key"] == 1 and counts["github_token"] == 1


def test_private_key_preserves_line_count():
    text = "+-----BEGIN RSA PRIVATE KEY-----\n+MIIabc\n+-----END RSA PRIVATE KEY-----\n+x = 1"
    out, counts = redact(text)
    assert "MIIabc" not in out and counts["private_key"] == 1
    assert out.count("\n") == text.count("\n")


def test_clean_text_untouched():
    text = "+def add(a, b):\n+    return a + b"
    assert redact(text) == (text, {})

