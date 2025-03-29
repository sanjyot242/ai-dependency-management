// services/scan.service.ts
import Scan, { IScan, IDependency } from '../models/Scan';
import Repository, { IRepository } from '../models/Repository';
import { Types } from 'mongoose';

interface ScanStatusUpdateData {
  startedAt?: Date;
  completedAt?: Date;
  branch?: string;
  commit?: string;
  errorMessage?: string;
}

interface VulnerabilitiesResult {
  scanId: Types.ObjectId;
  scannedAt: Date;
  vulnerableDependencies: IDependency[];
  totalVulnerabilities: number;
}

export const updateScanStatus = async (
  scanId: string,
  status: 'pending' | 'in-progress' | 'completed' | 'failed',
  data: ScanStatusUpdateData = {}
): Promise<IScan | null> => {
  try {
    const updates: any = { status, ...data };

    if (status === 'in-progress' && !data.startedAt) {
      updates.startedAt = new Date();
    }

    if (status === 'completed' && !data.completedAt) {
      updates.completedAt = new Date();
    }

    return await Scan.findByIdAndUpdate(scanId, updates, { new: true });
  } catch (error) {
    console.error('Error in updateScanStatus:', error);
    throw error;
  }
};

export const updateScanResults = async (
  scanId: string,
  dependencies: IDependency[]
): Promise<IScan | null> => {
  try {
    const scan = await Scan.findById(scanId);

    if (!scan) {
      throw new Error('Scan not found');
    }

    scan.dependencies = dependencies;
    scan.status = 'completed';
    scan.completedAt = new Date();

    // The pre-save hook will calculate the counts
    await scan.save();

    return scan;
  } catch (error) {
    console.error('Error in updateScanResults:', error);
    throw error;
  }
};

export const getLatestScan = async (
  repositoryId: string,
  userId: string
): Promise<IScan | null> => {
  try {
    // Validate repository belongs to user
    const repository = await Repository.findOne({ _id: repositoryId, userId });

    if (!repository) {
      throw new Error('Repository not found or not authorized');
    }

    return await Scan.findOne({
      repositoryId,
      status: 'completed',
    }).sort({ completedAt: -1 });
  } catch (error) {
    console.error('Error in getLatestScan:', error);
    throw error;
  }
};

export const getScanHistory = async (
  repositoryId: string,
  userId: string,
  limit: number = 10
): Promise<IScan[]> => {
  try {
    // Validate repository belongs to user
    const repository = await Repository.findOne({ _id: repositoryId, userId });

    if (!repository) {
      throw new Error('Repository not found or not authorized');
    }

    return await Scan.find({
      repositoryId,
      status: 'completed',
    })
      .select(
        '_id repositoryId startedAt completedAt outdatedCount vulnerabilityCount highSeverityCount'
      )
      .sort({ completedAt: -1 })
      .limit(limit);
  } catch (error) {
    console.error('Error in getScanHistory:', error);
    throw error;
  }
};

export const getVulnerabilities = async (
  repositoryId: string,
  userId: string
): Promise<VulnerabilitiesResult | null> => {
  try {
    const latestScan = await getLatestScan(repositoryId, userId);

    if (!latestScan) {
      return null;
    }

    // Filter dependencies to only include those with vulnerabilities
    const vulnerableDependencies = latestScan.dependencies.filter(
      (dep) => dep.vulnerabilities && dep.vulnerabilities.length > 0
    );

    return {
      scanId: latestScan._id as Types.ObjectId,
      scannedAt: latestScan.completedAt!,
      vulnerableDependencies,
      totalVulnerabilities: latestScan.vulnerabilityCount,
    };
  } catch (error) {
    console.error('Error in getVulnerabilities:', error);
    throw error;
  }
};
