import hashlib
import hmac


def compute_signature(secret: str, body: bytes) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def verify_signature(secret: str, body: bytes, signature_header: str | None) -> bool:
    """Constant-time verification of GitHub's X-Hub-Signature-256 header."""
    if not secret or not signature_header:
        return False
    return hmac.compare_digest(compute_signature(secret, body), signature_header)

