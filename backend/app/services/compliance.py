"""Map findings to CWE / OWASP Top 10 / compliance controls for audit reporting."""
import re
from dataclasses import dataclass

FRAMEWORKS = {
    "injection": ["SOC 2 CC6.1", "PCI-DSS 6.2.4", "ISO 27001 A.8.28"],
    "crypto": ["SOC 2 CC6.7", "PCI-DSS 3.5.1 / 4.2.1", "ISO 27001 A.8.24"],
    "access": ["SOC 2 CC6.1 / CC6.3", "PCI-DSS 7.2", "ISO 27001 A.8.3"],
    "auth": ["SOC 2 CC6.1", "PCI-DSS 8.3", "ISO 27001 A.8.5"],
    "config": ["SOC 2 CC7.1", "PCI-DSS 2.2", "ISO 27001 A.8.9"],
    "integrity": ["SOC 2 CC7.1", "PCI-DSS 6.3.2", "ISO 27001 A.8.28"],
    "network": ["SOC 2 CC6.6", "PCI-DSS 1.4 / 6.2.4", "ISO 27001 A.8.20"],
    "reliability": ["SOC 2 A1.2", "ISO 27001 A.8.28"],
}

# cwe -> (title, owasp, framework group)
CWE_MAP: dict[str, tuple[str, str, str]] = {
    "CWE-89": ("SQL Injection", "A03:2021 Injection", "injection"),
    "CWE-78": ("OS Command Injection", "A03:2021 Injection", "injection"),
    "CWE-79": ("Cross-site Scripting", "A03:2021 Injection", "injection"),
    "CWE-94": ("Code Injection", "A03:2021 Injection", "injection"),
    "CWE-95": ("Eval Injection", "A03:2021 Injection", "injection"),
    "CWE-502": ("Insecure Deserialization", "A08:2021 Software and Data Integrity Failures", "integrity"),
    "CWE-327": ("Weak Cryptographic Algorithm", "A02:2021 Cryptographic Failures", "crypto"),
    "CWE-328": ("Weak Hash", "A02:2021 Cryptographic Failures", "crypto"),
    "CWE-295": ("Improper Certificate Validation", "A02:2021 Cryptographic Failures", "crypto"),
    "CWE-22": ("Path Traversal", "A01:2021 Broken Access Control", "access"),
    "CWE-918": ("Server-Side Request Forgery", "A10:2021 Server-Side Request Forgery", "network"),
    "CWE-798": ("Hard-coded Credentials", "A07:2021 Identification and Authentication Failures", "auth"),
    "CWE-307": ("Missing Brute-force Protection", "A07:2021 Identification and Authentication Failures", "auth"),
    "CWE-287": ("Improper Authentication", "A07:2021 Identification and Authentication Failures", "auth"),
    "CWE-862": ("Missing Authorization", "A01:2021 Broken Access Control", "access"),
    "CWE-489": ("Active Debug Code", "A05:2021 Security Misconfiguration", "config"),
    "CWE-362": ("Race Condition", "—", "reliability"),
    "CWE-400": ("Uncontrolled Resource Consumption", "—", "reliability"),
    "CWE-476": ("Null Pointer Dereference", "—", "reliability"),
}

KEYWORDS: list[tuple[re.Pattern, str]] = [(re.compile(p, re.I), c) for p, c in [
    (r"sql\s*injection|string.*concat.*quer|unparameteri[sz]ed", "CWE-89"),
    (r"command\s*injection|os\.system|shell=true", "CWE-78"),
    (r"\bxss\b|cross-site scripting|unescaped html", "CWE-79"),
    (r"\beval\b|code injection", "CWE-94"),
    (r"deserializ|pickle|yaml\.load", "CWE-502"),
    (r"\bmd5\b|\bsha-?1\b|weak (hash|crypto)", "CWE-327"),
    (r"verify\s*=\s*false|certificate valid|tls verif", "CWE-295"),
    (r"path traversal|directory traversal", "CWE-22"),
    (r"\bssrf\b|server-side request", "CWE-918"),
    (r"hard-?coded (password|secret|credential|key)", "CWE-798"),
    (r"brute.?force|rate limit", "CWE-307"),
    (r"debug\s*(=\s*true|mode)", "CWE-489"),
    (r"race condition", "CWE-362"),
    (r"null (pointer|reference)|none dereference", "CWE-476"),
]]


@dataclass
class Classification:
    cwe: str | None
    cwe_title: str | None
    owasp: str | None
    controls: list[str]


def classify(title: str, description: str = "", cwe: str | None = None) -> Classification:
    cwe = (cwe or "").upper().strip() or None
    if cwe and not cwe.startswith("CWE-"):
        cwe = f"CWE-{cwe}"
    if cwe not in CWE_MAP:
        cwe = next((c for p, c in KEYWORDS if p.search(f"{title} {description}")), None)
    if cwe not in CWE_MAP:
        return Classification(None, None, None, [])
    name, owasp, group = CWE_MAP[cwe]
    return Classification(cwe, name, owasp if owasp != "—" else None, FRAMEWORKS[group])

