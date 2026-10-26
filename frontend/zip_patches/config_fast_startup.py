import asyncio
import logging
from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    # Database
    database_url: str = Field(..., description="PostgreSQL async DSN")
    db_pool_size: int = Field(2, ge=1, le=50, description="Persistent DB connections per worker")
    db_max_overflow: int = Field(1, ge=0, le=50, description="Temporary DB connections per worker")
    db_pool_timeout: int = Field(30, ge=5, le=120, description="Seconds to wait for a DB connection")
    db_pool_recycle: int = Field(300, ge=60, description="Seconds before recycling pooled connections")

    # Auth
    jwt_secret: str = Field(..., description="Secret key for signing Amplify JWTs")
    azure_tenant_id: str = Field(..., description="Azure AD tenant ID")
    azure_client_id: str = Field(..., description="Azure AD application client ID")

    # Azure infrastructure
    azure_keyvault_url: str = Field("", description="Azure Key Vault URL")
    blob_connection_string: str = Field("", description="Azure Blob Storage connection string")
    blob_account_name: str = Field("", description="Azure Blob Storage account name")
    blob_account_key: str = Field("", description="Azure Blob Storage account key (for SAS)")

    # Email
    email_connection_string: str = Field("", description="Azure Communication Services connection string")
    smtp_host: str = Field("smtp.gmail.com", description="SMTP host")
    smtp_port: int = Field(587, description="SMTP port")
    smtp_user: str = Field("", description="SMTP username")
    smtp_password: str = Field("", description="SMTP password / app password")
    smtp_use_tls: bool = Field(True, description="Use STARTTLS")
    smtp_from: str = Field("", description="From address shown to recipients")
    email_dev_override: str = Field("", description="Redirect ALL outbound mail to this address (local dev only)")
    executive_report_schedule_enabled: bool = Field(False, description="Enable automatic executive report email")
    executive_report_recipients: str = Field("", description="Comma-separated executive report recipients")
    executive_report_interval_hours: int = Field(168, ge=1, description="Hours between automatic reports")
    executive_report_days: int = Field(30, ge=7, le=365, description="Reporting period included in scheduled reports")

    # AI — Gemini (production) / Groq (local dev fallback)
    gemini_api_key: str = Field("", description="Google Gemini API key (production, preferred)")
    gemini_model: str = Field("", description="Gemini model used for AI scoring")
    groq_api_key: str = Field("", description="Groq API key (local dev fallback)")
    groq_model: str = Field("", description="Groq fallback model used for AI scoring")

    # AI Intelligence Portal MongoDB integration (Azure environment settings only)
    aiv_mongodb_url: str = Field(
        "",
        validation_alias=AliasChoices("AIV_MONGODB_URL", "MONGODB_URL"),
        description="Read-only MongoDB URI for approved AIV ideations",
    )
    aiv_mongodb_db_name: str = Field(
        "",
        validation_alias=AliasChoices("AIV_MONGODB_DB_NAME", "MONGODB_DB_NAME"),
        description="AIV MongoDB database name",
    )
    aiv_ideations_collection: str = Field("cic_pipeline", description="AIV approval-pipeline collection")

    evaluation_worker_enabled: bool = Field(True)

    # App
    debug: bool = Field(False)
    dev_auth_bypass: bool = Field(False, description="Enable /auth/dev-login endpoint (local only)")
    frontend_url: str = Field("http://localhost:5173")
    quality_report_allowed_hosts: str = Field("", description="Comma-separated exact public hosts approved for optional quality-report URL checks")


async def load_secrets(settings: Settings) -> None:
    """Overlay settings with secrets from Azure Key Vault at startup."""
    if not settings.azure_keyvault_url:
        logger.info("Azure Key Vault URL not configured — skipping secret load.")
        return

    try:
        from azure.identity.aio import DefaultAzureCredential
        from azure.keyvault.secrets.aio import SecretClient
    except ImportError as exc:
        raise RuntimeError("azure-identity and azure-keyvault-secrets are required") from exc

    secret_field_map = {
        "database-url": "database_url",
        "jwt-secret": "jwt_secret",
        "blob-connection-string": "blob_connection_string",
        "blob-account-name": "blob_account_name",
        "blob-account-key": "blob_account_key",
        "email-connection-string": "email_connection_string",
        "gemini-api-key": "gemini_api_key",
        "groq-api-key": "groq_api_key",
        "aiv-mongodb-url": "aiv_mongodb_url",
    }

    async with DefaultAzureCredential() as credential:
        async with SecretClient(vault_url=settings.azure_keyvault_url, credential=credential) as client:
            async def load_one(secret_name: str, field_name: str) -> None:
                try:
                    secret = await client.get_secret(secret_name)
                    if secret.value:
                        object.__setattr__(settings, field_name, secret.value)
                        logger.debug("Loaded secret '%s' from Key Vault.", secret_name)
                except Exception as exc:
                    logger.warning("Could not load secret '%s': %s", secret_name, exc)

            try:
                await asyncio.wait_for(
                    asyncio.gather(*(load_one(name, field) for name, field in secret_field_map.items())),
                    timeout=45,
                )
            except asyncio.TimeoutError:
                logger.warning("Key Vault secret loading exceeded 45 seconds; using available app settings.")

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
