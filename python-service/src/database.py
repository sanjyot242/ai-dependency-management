"""
MongoDB client for updating vulnerability AI analysis results
"""
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from .config import settings

logger = logging.getLogger(__name__)


class MongoDBClient:
    """
    MongoDB client for updating scan documents with AI analysis results
    """

    def __init__(self):
        """Initialize MongoDB connection"""
        self.client = None
        self.db = None
        self.scans_collection = None
        self.connect()

    def connect(self):
        """Establish MongoDB connection"""
        try:
            logger.info(f"Connecting to MongoDB: {settings.mongodb_uri}")
            self.client = MongoClient(settings.mongodb_uri)
            self.db = self.client[settings.mongodb_database]
            self.scans_collection = self.db['scans']

            # Test connection
            self.client.admin.command('ping')
            logger.info("Successfully connected to MongoDB")

        except PyMongoError as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}", exc_info=True)
            raise

    def update_vulnerability_ai_analysis(
        self,
        scan_id: str,
        package_name: str,
        vulnerability_id: str,
        ai_data: Dict[str, Any]
    ) -> bool:
        """
        Update a vulnerability in a scan document with AI analysis results

        Args:
            scan_id: Scan document ID
            package_name: Package name containing the vulnerability
            vulnerability_id: Vulnerability ID
            ai_data: AI analysis results to update

        Returns:
            True if update successful, False otherwise
        """
        try:
            logger.info(
                f"Updating AI analysis for scan={scan_id}, "
                f"package={package_name}, vuln={vulnerability_id}"
            )

            # Prepare update data
            update_fields = {}

            if ai_data.get('aiGeneratedDescription'):
                update_fields['dependencies.$[dep].vulnerabilities.$[vuln].aiGeneratedDescription'] = \
                    ai_data['aiGeneratedDescription']

            if ai_data.get('aiDeterminedSeverity'):
                update_fields['dependencies.$[dep].vulnerabilities.$[vuln].aiDeterminedSeverity'] = \
                    ai_data['aiDeterminedSeverity']

            if ai_data.get('aiSeverityConfidence') is not None:
                update_fields['dependencies.$[dep].vulnerabilities.$[vuln].aiSeverityConfidence'] = \
                    ai_data['aiSeverityConfidence']

            if ai_data.get('aiSeverityFactors'):
                update_fields['dependencies.$[dep].vulnerabilities.$[vuln].aiSeverityFactors'] = \
                    ai_data['aiSeverityFactors']

            if ai_data.get('aiAnalysisError'):
                update_fields['dependencies.$[dep].vulnerabilities.$[vuln].aiAnalysisError'] = \
                    ai_data['aiAnalysisError']

            # Always set timestamp
            update_fields['dependencies.$[dep].vulnerabilities.$[vuln].aiAnalysisTimestamp'] = \
                datetime.utcnow()

            # Update the scan document
            result = self.scans_collection.update_one(
                {'_id': scan_id},
                {'$set': update_fields},
                array_filters=[
                    {'dep.packageName': package_name},
                    {'vuln.id': vulnerability_id}
                ]
            )

            if result.matched_count == 0:
                logger.warning(
                    f"No scan found with id={scan_id}, "
                    f"package={package_name}, vuln={vulnerability_id}"
                )
                return False

            if result.modified_count == 0:
                logger.warning(
                    f"Scan found but no modifications made for "
                    f"scan={scan_id}, package={package_name}, vuln={vulnerability_id}"
                )
                # Still return True as the document exists, might already have the data
                return True

            logger.info(
                f"Successfully updated AI analysis for "
                f"scan={scan_id}, package={package_name}, vuln={vulnerability_id}"
            )
            return True

        except PyMongoError as e:
            logger.error(
                f"MongoDB error updating AI analysis: {str(e)}",
                exc_info=True
            )
            return False

        except Exception as e:
            logger.error(
                f"Unexpected error updating AI analysis: {str(e)}",
                exc_info=True
            )
            return False

    def get_scan_by_id(self, scan_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a scan document by ID

        Args:
            scan_id: Scan document ID

        Returns:
            Scan document or None if not found
        """
        try:
            scan = self.scans_collection.find_one({'_id': scan_id})
            return scan

        except PyMongoError as e:
            logger.error(f"Error retrieving scan {scan_id}: {str(e)}", exc_info=True)
            return None

    def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")


# Global MongoDB client instance
mongo_client = MongoDBClient()
