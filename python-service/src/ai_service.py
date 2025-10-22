"""
AI Vulnerability Analysis Service using OpenAI GPT-4
"""
import json
import logging
import time
from typing import Dict, Optional, Any
from openai import OpenAI
from openai import OpenAIError

from .config import settings
from .prompts import (
    format_description_prompt,
    format_severity_prompt,
    DESCRIPTION_SYSTEM_PROMPT,
    SEVERITY_SYSTEM_PROMPT
)

logger = logging.getLogger(__name__)


class AIVulnerabilityAnalyzer:
    """
    Analyzes vulnerabilities using OpenAI GPT-4 to generate:
    1. User-friendly descriptions
    2. AI-determined severity ratings with confidence scores
    """

    def __init__(self):
        """Initialize the OpenAI client"""
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model
        self.temperature = settings.openai_temperature
        self.max_tokens = settings.openai_max_tokens
        self.max_retries = settings.max_retries
        self.retry_delay = settings.retry_delay_seconds

    def generate_description(self, vulnerability_data: dict) -> Optional[str]:
        """
        Generate a user-friendly vulnerability description

        Args:
            vulnerability_data: Vulnerability information from queue message

        Returns:
            User-friendly description string, or None if generation fails
        """
        try:
            prompt = format_description_prompt(vulnerability_data)

            logger.info(f"Generating description for vulnerability {vulnerability_data.get('vulnerabilityId')}")

            response = self._call_openai_with_retry(
                system_prompt=DESCRIPTION_SYSTEM_PROMPT,
                user_prompt=prompt,
                temperature=self.temperature
            )

            if response:
                description = response.strip()
                logger.info(f"Successfully generated description ({len(description)} chars)")
                return description
            else:
                logger.error("OpenAI returned empty response for description")
                return None

        except Exception as e:
            logger.error(f"Error generating description: {str(e)}", exc_info=True)
            return None

    def analyze_severity(self, vulnerability_data: dict) -> Optional[Dict[str, Any]]:
        """
        Analyze vulnerability severity using AI

        Args:
            vulnerability_data: Vulnerability information from queue message

        Returns:
            Dictionary with severity, confidence, and factors, or None if analysis fails
        """
        try:
            prompt = format_severity_prompt(vulnerability_data)

            logger.info(f"Analyzing severity for vulnerability {vulnerability_data.get('vulnerabilityId')}")

            response = self._call_openai_with_retry(
                system_prompt=SEVERITY_SYSTEM_PROMPT,
                user_prompt=prompt,
                temperature=0.2  # Lower temperature for more consistent severity ratings
            )

            if response:
                # Parse JSON response
                try:
                    severity_data = json.loads(response)

                    # Validate response structure
                    required_fields = ['severity', 'confidence', 'factors']
                    if all(field in severity_data for field in required_fields):
                        logger.info(
                            f"Successfully analyzed severity: "
                            f"{severity_data['severity']} "
                            f"(confidence: {severity_data['confidence']}%)"
                        )
                        return severity_data
                    else:
                        logger.error(f"Invalid severity response structure: {severity_data}")
                        return None

                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse severity JSON response: {str(e)}")
                    logger.debug(f"Raw response: {response}")
                    return None
            else:
                logger.error("OpenAI returned empty response for severity analysis")
                return None

        except Exception as e:
            logger.error(f"Error analyzing severity: {str(e)}", exc_info=True)
            return None

    def analyze_vulnerability(self, vulnerability_data: dict) -> Dict[str, Any]:
        """
        Perform complete vulnerability analysis (description + severity)

        Args:
            vulnerability_data: Vulnerability information from queue message

        Returns:
            Dictionary with AI analysis results
        """
        vuln_id = vulnerability_data.get('vulnerabilityId', 'Unknown')
        package_name = vulnerability_data.get('packageName', 'Unknown')

        logger.info(f"Starting AI analysis for {package_name}:{vuln_id}")

        result = {
            'success': False,
            'vulnerabilityId': vuln_id,
            'packageName': package_name,
            'aiGeneratedDescription': None,
            'aiDeterminedSeverity': None,
            'aiSeverityConfidence': None,
            'aiSeverityFactors': None,
            'aiAnalysisError': None,
            'aiAnalysisTimestamp': None
        }

        try:
            # Generate description
            description = self.generate_description(vulnerability_data)
            if description:
                result['aiGeneratedDescription'] = description

            # Analyze severity
            severity_analysis = self.analyze_severity(vulnerability_data)
            if severity_analysis:
                result['aiDeterminedSeverity'] = severity_analysis.get('severity')
                result['aiSeverityConfidence'] = severity_analysis.get('confidence')
                result['aiSeverityFactors'] = severity_analysis.get('factors')

            # Mark as successful if we got at least one result
            if description or severity_analysis:
                result['success'] = True
                logger.info(f"AI analysis completed successfully for {package_name}:{vuln_id}")
            else:
                result['aiAnalysisError'] = "Failed to generate both description and severity analysis"
                logger.warning(f"AI analysis produced no results for {package_name}:{vuln_id}")

        except Exception as e:
            error_msg = f"AI analysis error: {str(e)}"
            result['aiAnalysisError'] = error_msg
            logger.error(f"Error in analyze_vulnerability: {error_msg}", exc_info=True)

        return result

    def _call_openai_with_retry(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float
    ) -> Optional[str]:
        """
        Call OpenAI API with retry logic

        Args:
            system_prompt: System message for context
            user_prompt: User message with the actual prompt
            temperature: Sampling temperature

        Returns:
            Response text or None if all retries fail
        """
        for attempt in range(self.max_retries):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=temperature,
                    max_tokens=self.max_tokens
                )

                # Extract response text
                if response.choices and len(response.choices) > 0:
                    return response.choices[0].message.content

                logger.warning(f"OpenAI response had no choices (attempt {attempt + 1})")

            except OpenAIError as e:
                logger.warning(
                    f"OpenAI API error (attempt {attempt + 1}/{self.max_retries}): {str(e)}"
                )

                # Retry after delay if not last attempt
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))  # Exponential backoff
                else:
                    logger.error(f"All {self.max_retries} OpenAI API attempts failed")
                    raise

            except Exception as e:
                logger.error(f"Unexpected error calling OpenAI API: {str(e)}", exc_info=True)
                raise

        return None
