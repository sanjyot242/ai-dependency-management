# ai-dependency-management

Dependency Management Tool With AI assistance for risk analysis

Journal
This project contains two microservices:

1. **Node Service** (Express.js):

   - Scans GitHub repositories, updates dependencies, creates pull requests.
   - Running on port 3001 by default.

2. **Python Service** (FastAPI):
   - Provides AI/ML functionality for risk scoring, compatibility analysis.
   - Running on port 3002 by default.

Problem Statement:
Software projects rely on numerous external libraries and frameworks. Keeping dependencies updated (to patch security vulnerabilities, fix bugs, and gain new features) is crucial. However, updating dependencies can be risky or time-consuming—there’s always the possibility of breakages due to API changes or incompatibilities. Traditional automated tools (e.g., Dependabot, Renovate) help by opening pull requests with updated version numbers, but developers may still need to manually verify if the update breaks the build or tests.

Proposed Solution:
Build a web application that:
Scans a project’s dependency files (package.json, requirements.txt, etc.)
Identifies outdated or vulnerable dependencies.
Automatically creates pull requests with updated versions.
Uses an AI/ML approach (even if minimal) to estimate the risk/likelihood of breaking changes before merging.|
