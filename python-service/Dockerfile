# python-service/Dockerfile
FROM python:3.9-slim

WORKDIR /usr/src/app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your service code
COPY . .

# Expose port used by FastAPI (assuming 3002)
EXPOSE 3002

# Start FastAPI via uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3002"]
