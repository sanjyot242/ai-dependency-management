// services/risk-analysis.service.ts
import RiskAnalysis from '../models/RiskAnalysis';
import { IRiskAnalysis } from '../types/models';
import { RiskAnalysisData } from '../types/dto';

export const createRiskAnalysis = async (
  userId: string,
  repositoryId: string,
  analysisData: RiskAnalysisData
): Promise<IRiskAnalysis> => {
  try {
    const {
      packageName,
      currentVersion,
      targetVersion,
      riskScore,
      breakingChanges,
      confidenceLevel,
      recommendations,
      aiAnalysisDetails,
    } = analysisData;

    const riskAnalysis = new RiskAnalysis({
      userId,
      repositoryId,
      packageName,
      currentVersion,
      targetVersion,
      riskScore,
      breakingChanges,
      confidenceLevel,
      recommendations,
      aiAnalysisDetails,
    });

    await riskAnalysis.save();
    return riskAnalysis;
  } catch (error) {
    console.error('Error in createRiskAnalysis:', error);
    throw error;
  }
};

export const getRiskAnalyses = async (
  userId: string,
  repositoryId: string,
  packageName?: string
): Promise<IRiskAnalysis[]> => {
  try {
    const query: any = { userId, repositoryId };

    if (packageName) {
      query.packageName = packageName;
    }

    return await RiskAnalysis.find(query).sort({ createdAt: -1 });
  } catch (error) {
    console.error('Error in getRiskAnalyses:', error);
    throw error;
  }
};
