from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class FindingSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class FindingCategory(str, Enum):
    SECURITY = "security"
    BUG = "bug"
    PERFORMANCE = "performance"
    STYLE = "code_style"
    TEST_DEFICIENCY = "missing_tests"


class CodeFinding(BaseModel):
    file_path: str = Field(..., description="Target file path relative to repo root")
    line_number: Optional[int] = Field(None, description="Exact line number in new hunk to comment on")
    title: str = Field(..., description="Concise summary (e.g., Potential SQL Injection)")
    description: str = Field(..., description="Technical explanation of the flaw and impact")
    severity: FindingSeverity
    category: FindingCategory
    code_snippet: Optional[str] = Field(None, description="The vulnerable code excerpt from the diff")
    evidence: Optional[str] = Field(None, description="Supporting evidence: taint flow source-to-sink trace or regulatory rule violation")
    confidence: float = Field(0.90, ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    suggested_code: Optional[str] = Field(None, description="Exact replacement for the single line at line_number, if applicable")
    cwe: Optional[str] = Field(None, description="CWE identifier such as CWE-89, when the issue maps to one")


class PRReviewResult(BaseModel):
    summary: str = Field(..., description="Overall PR analysis summary")
    quality_score: int = Field(..., ge=1, le=10, description="Overall quality score 1 to 10")
    key_positives: List[str] = Field(default_factory=list, description="Positive aspects noted in the change")
    findings: List[CodeFinding]
    adversarial_content_detected: bool = Field(False, description="Whether prompt injection attempts were spotted")

