from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    github_app_id: str = ""
    # PEM contents; literal "\n" sequences are expanded.
    github_private_key: str = ""
    github_webhook_secret: str = ""
    github_api_url: str = "https://api.github.com"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    database_url: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel"
    redis_url: str = "redis://localhost:6379/0"
    idempotency_ttl_seconds: int = 3600

    # Enterprise: auth, routing, alerts
    auth_enabled: bool = False  # when False every request acts as a local all-access admin (dev/demo)
    github_oauth_client_id: str = ""
    github_oauth_client_secret: str = ""
    session_secret: str = "dev-secret-change-me"
    frontend_url: str = "http://localhost:5173"
    public_url: str = "http://localhost:8000"  # where GitHub redirects the OAuth callback
    slack_webhook_url: str = ""
    cheap_model: str = "gpt-4o-mini"
    strong_model: str = "gpt-4o"

    # baseline | sanitized_delimiter | full_hardened
    defense_mode: str = "full_hardened"

    # USD per 1M tokens (defaults: gpt-4o-mini)
    price_input_per_mtok: float = 0.15
    price_output_per_mtok: float = 0.60

    # Limits to keep prompts bounded
    max_diff_chars: int = 60000
    max_files: int = 40


@lru_cache
def get_settings() -> Settings:
    return Settings()

