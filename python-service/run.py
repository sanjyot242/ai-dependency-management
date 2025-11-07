#!/usr/bin/env python3
"""
Entry point for AI Vulnerability Analysis Service
"""
import os
import sys
import logging
from pathlib import Path

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    print(f"Loaded environment variables from {env_path}")
else:
    print(f"Warning: .env file not found at {env_path}")

# Import after loading env vars
from src.config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Main entry point"""
    logger.info("=" * 60)
    logger.info("AI Vulnerability Analysis Service")
    logger.info("=" * 60)
    logger.info(f"OpenAI Model: {settings.openai_model}")
    logger.info(f"RabbitMQ Queue: {settings.ai_queue_name}")
    logger.info(f"MongoDB Database: {settings.mongodb_database}")
    logger.info(f"Service Port: {settings.service_port}")
    logger.info("=" * 60)

    # Validate OpenAI API key
    if not settings.openai_api_key or settings.openai_api_key == "sk-your-openai-api-key-here":
        logger.error("ERROR: OPENAI_API_KEY not configured!")
        logger.error("Please set your OpenAI API key in the .env file")
        sys.exit(1)

    # Start the FastAPI application
    import uvicorn
    from src.main import app

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=settings.service_port,
        log_level=settings.log_level.lower()
    )


if __name__ == "__main__":
    main()
