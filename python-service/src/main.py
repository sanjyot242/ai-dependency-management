"""
Main FastAPI application for AI Vulnerability Analysis Service
"""
import logging
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from .config import settings
from .queue_consumer import ai_worker
from .database import mongo_client

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global worker thread
worker_thread = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    logger.info("Starting AI Vulnerability Analysis Service...")

    # Start RabbitMQ consumer in background thread
    global worker_thread
    worker_thread = threading.Thread(target=ai_worker.start, daemon=True)
    worker_thread.start()
    logger.info("RabbitMQ consumer thread started")

    yield

    # Shutdown
    logger.info("Shutting down AI Vulnerability Analysis Service...")
    ai_worker.stop()
    mongo_client.close()
    logger.info("Service stopped")


# Create FastAPI app
app = FastAPI(
    title="AI Vulnerability Analysis Service",
    description="Microservice for analyzing vulnerabilities using OpenAI GPT-4",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "AI Vulnerability Analysis Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint

    Returns service health status
    """
    health_status = {
        "status": "healthy",
        "service": "ai-vulnerability-analysis",
        "version": "1.0.0"
    }

    # Check RabbitMQ connection
    try:
        if ai_worker.connection and not ai_worker.connection.is_closed:
            health_status["rabbitmq"] = "connected"
        else:
            health_status["rabbitmq"] = "disconnected"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["rabbitmq"] = f"error: {str(e)}"
        health_status["status"] = "unhealthy"

    # Check MongoDB connection
    try:
        mongo_client.client.admin.command('ping')
        health_status["mongodb"] = "connected"
    except Exception as e:
        health_status["mongodb"] = f"error: {str(e)}"
        health_status["status"] = "unhealthy"

    # Check OpenAI configuration
    if settings.openai_api_key and settings.openai_api_key != "sk-your-openai-api-key-here":
        health_status["openai"] = "configured"
    else:
        health_status["openai"] = "not configured"
        health_status["status"] = "degraded"

    status_code = 200 if health_status["status"] == "healthy" else 503

    return JSONResponse(content=health_status, status_code=status_code)


@app.get("/status")
async def status():
    """
    Detailed status endpoint

    Returns detailed service status including queue stats
    """
    status_info = {
        "service": "ai-vulnerability-analysis",
        "version": "1.0.0",
        "worker_running": ai_worker.is_running,
        "worker_thread_alive": worker_thread.is_alive() if worker_thread else False,
        "configuration": {
            "queue_name": settings.ai_queue_name,
            "openai_model": settings.openai_model,
            "openai_temperature": settings.openai_temperature,
            "max_retries": settings.max_retries,
            "mongodb_database": settings.mongodb_database
        }
    }

    # Get RabbitMQ queue stats if possible
    try:
        if ai_worker.channel and not ai_worker.channel.is_closed:
            queue_info = ai_worker.channel.queue_declare(
                queue=settings.ai_queue_name,
                passive=True
            )
            status_info["queue_stats"] = {
                "message_count": queue_info.method.message_count,
                "consumer_count": queue_info.method.consumer_count
            }
        else:
            status_info["queue_stats"] = "unavailable (not connected)"
    except Exception as e:
        status_info["queue_stats"] = f"error: {str(e)}"

    return status_info


@app.post("/analyze")
async def analyze_vulnerability(vulnerability_data: dict):
    """
    Manual endpoint to trigger vulnerability analysis (for testing)

    Args:
        vulnerability_data: Vulnerability data matching AIVulnerabilityMessage format

    Returns:
        AI analysis results
    """
    try:
        from .ai_service import AIVulnerabilityAnalyzer

        analyzer = AIVulnerabilityAnalyzer()
        result = analyzer.analyze_vulnerability(vulnerability_data)

        return result

    except Exception as e:
        logger.error(f"Error in manual analysis: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.service_port)
