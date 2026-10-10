"""LLM reviewer using OpenAI structured outputs, with selectable prompt-injection defense mode."""
from openai import AsyncOpenAI

from app.config import Settings, get_settings
from app.schemas.review import PRReviewResult
from app.services.diff_parser import FileDiff
from app.services.injection_guard import apply_output_guard, build_prompts


async def review_diffs(title: str, diffs: list[FileDiff], settings: Settings | None = None,
                       focus_rules: list[str] | None = None, client: AsyncOpenAI | None = None,
                       mode: str | None = None, model: str | None = None) -> tuple[PRReviewResult, int, int]:
    """Returns (result, prompt_tokens, completion_tokens). `client` may be any object exposing
    `beta.chat.completions.parse` (the benchmark injects a mock)."""
    settings = settings or get_settings()
    client = client or AsyncOpenAI(api_key=settings.openai_api_key)
    bundle = build_prompts(mode or settings.defense_mode, title, diffs, focus_rules)
    completion = await client.beta.chat.completions.parse(
        model=model or settings.openai_model,
        messages=[
            {"role": "system", "content": bundle.system},
            {"role": "user", "content": bundle.user},
        ],
        response_format=PRReviewResult,
    )
    result = completion.choices[0].message.parsed
    if result is None:
        raise ValueError("LLM returned no parsable review")
    result = apply_output_guard(bundle, result)
    usage = completion.usage
    return result, (usage.prompt_tokens if usage else 0), (usage.completion_tokens if usage else 0)
