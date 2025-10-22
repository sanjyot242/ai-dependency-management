"""
Configuration management for AI Vulnerability Analysis Service
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # OpenAI Configuration
    openai_api_key: str
    openai_model: str = "gpt-4"
    openai_temperature: float = 0.3
    openai_max_tokens: int = 500

    # RabbitMQ Configuration
    rabbitmq_url: str = "amqp://localhost:5672"
    ai_queue_name: str = "ai_vulnerability_analysis"

    # MongoDB Configuration
    mongodb_uri: str = "mongodb://localhost:27017/dependency-manager"
    mongodb_database: str = "dependency-manager"

    # Service Configuration
    log_level: str = "INFO"
    service_port: int = 8000

    # Processing Configuration
    max_retries: int = 3
    retry_delay_seconds: int = 2
    processing_timeout_seconds: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
