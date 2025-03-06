// controllers/scan.controller.ts
import { Request, Response } from 'express';
import {
  createScan,
  updateScanResults,
  getLatestScan,
  getScanHistory,
  getVulnerabilities,
} from '../services/scan.service';
import {
  createRiskAnalysis,
  getRiskAnalyses,
} from '../services/risk-analysis.service';
import { IDependency } from '../models/Scan';

interface ScanRequestBody {
  repoId: string;
}

interface RiskAnalysisRequestBody {
  repoId: string;
  packageName: string;
  currentVersion: string;
  newVersion: string;
}

const scanController = {
  // Initiate a dependency scan for a repository
  initiateRepositoryScan: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { repoId } = req.body as ScanRequestBody;

      if (!repoId) {
        res.status(400).json({ error: 'Repository ID is required' });
        return;
      }

      const scan = await createScan(userId, repoId);

      // In a real application, you would trigger an asynchronous process
      // to scan the repository dependencies (e.g., using a job queue)

      res.json({
        success: true,
        message: 'Scan initiated',
        scanId: scan._id,
      });
    } catch (error) {
      console.error('Error initiating scan:', error);
      res.status(500).json({ error: 'Failed to initiate scan' });
    }
  },

  // Get the latest scan for a repository
  getLatestRepositoryScan: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { repoId } = req.params;

      const latestScan = await getLatestScan(repoId, userId);

      if (!latestScan) {
        res.status(404).json({ error: 'No scan found for this repository' });
        return;
      }

      res.json(latestScan);
    } catch (error) {
      console.error('Error fetching latest scan:', error);
      res.status(500).json({ error: 'Failed to fetch latest scan' });
    }
  },

  // Get scan history for a repository
  getRepositoryScanHistory: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { repoId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const history = await getScanHistory(repoId, userId, limit);

      res.json(history);
    } catch (error) {
      console.error('Error fetching scan history:', error);
      res.status(500).json({ error: 'Failed to fetch scan history' });
    }
  },

  // Get vulnerabilities from the latest scan for a repository
  getRepositoryVulnerabilities: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { repoId } = req.params;

      const vulnerabilities = await getVulnerabilities(repoId, userId);

      if (!vulnerabilities) {
        res.status(404).json({ error: 'No vulnerabilities found' });
        return;
      }

      res.json(vulnerabilities);
    } catch (error) {
      console.error('Error fetching vulnerabilities:', error);
      res.status(500).json({ error: 'Failed to fetch vulnerabilities' });
    }
  },

  // Analyze update risk for a dependency
  analyzeUpdateRisk: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { repoId, packageName, currentVersion, newVersion } =
        req.body as RiskAnalysisRequestBody;

      if (!repoId || !packageName || !currentVersion || !newVersion) {
        res.status(400).json({
          error:
            'Repository ID, package name, current version, and new version are required',
        });
        return;
      }

      // In a real application, you would use an AI service to perform this analysis
      // For now, we'll implement a basic algorithm to simulate risk assessment

      // Parse version parts
      const versionParts = {
        current: currentVersion.split('.').map(Number),
        new: newVersion.split('.').map(Number),
      };

      let riskScore = 0;
      let breakingChanges = false;

      // Major version change is higher risk
      if (versionParts.new[0] > versionParts.current[0]) {
        riskScore = 70 + Math.floor(Math.random() * 20);
        breakingChanges = true;
      }
      // Minor version change is medium risk
      else if (versionParts.new[1] > versionParts.current[1]) {
        riskScore = 30 + Math.floor(Math.random() * 30);
        breakingChanges = Math.random() > 0.7;
      }
      // Patch version change is low risk
      else {
        riskScore = 10 + Math.floor(Math.random() * 20);
        breakingChanges = false;
      }

      // Generate recommendations based on risk
      const recommendations = [
        'Review the changelog before updating',
        'Run comprehensive tests after updating',
      ];

      if (breakingChanges) {
        recommendations.push('Consider updating in a separate PR');
        recommendations.push('Update any affected code before deploying');
      } else {
        recommendations.push(
          'Safe to update in a batch with other dependencies'
        );
      }

      // Save analysis to database
      const analysisData = {
        packageName,
        currentVersion,
        targetVersion: newVersion,
        riskScore,
        breakingChanges,
        confidenceLevel: 75,
        recommendations,
        aiAnalysisDetails: {
          majorVersionChange: versionParts.new[0] > versionParts.current[0],
          minorVersionChange: versionParts.new[1] > versionParts.current[1],
          patchVersionChange: versionParts.new[2] > versionParts.current[2],
        },
      };

      const savedAnalysis = await createRiskAnalysis(
        userId,
        repoId,
        analysisData
      );

      res.json(savedAnalysis);
    } catch (error) {
      console.error('Error analyzing risk:', error);
      res.status(500).json({ error: 'Failed to analyze risk' });
    }
  },

  // Get risk analyses for a repository or specific package
  getRiskAnalyses: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { repoId } = req.params;
      const packageName = req.query.packageName as string | undefined;

      const analyses = await getRiskAnalyses(userId, repoId, packageName);

      res.json(analyses);
    } catch (error) {
      console.error('Error fetching risk analyses:', error);
      res.status(500).json({ error: 'Failed to fetch risk analyses' });
    }
  },
};

export default scanController;
