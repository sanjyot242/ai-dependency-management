"""
AI Prompt templates for vulnerability analysis
"""


def format_description_prompt(vulnerability_data: dict) -> str:
    """
    Generate a prompt for creating user-friendly vulnerability descriptions

    Args:
        vulnerability_data: Dictionary containing vulnerability information

    Returns:
        Formatted prompt string for OpenAI
    """
    vuln_id = vulnerability_data.get('vulnerabilityId', 'Unknown')
    description = vulnerability_data.get('osvData', {}).get('description', 'No description available')
    package_name = vulnerability_data.get('packageName', 'Unknown')
    current_version = vulnerability_data.get('packageContext', {}).get('currentVersion', 'Unknown')
    severity = vulnerability_data.get('osvData', {}).get('severity', 'unknown')
    fixed_in = vulnerability_data.get('osvData', {}).get('fixedIn')
    references = vulnerability_data.get('osvData', {}).get('references', [])

    prompt = f"""You are a security expert explaining vulnerabilities to software developers.

Generate a clear, user-friendly description of this security vulnerability:

Vulnerability ID: {vuln_id}
Package: {package_name}
Current Version: {current_version}
Severity: {severity}
{f"Fixed In: {fixed_in}" if fixed_in else "Fix: Not yet available"}

Technical Description:
{description}

References:
{chr(10).join(f"- {ref}" for ref in references[:3]) if references else "None available"}

Generate a 2-3 sentence explanation that:
1. Explains WHAT the vulnerability is in simple terms
2. Describes the IMPACT or potential risks
3. Mentions if a fix is available

Keep it concise, avoid technical jargon, and make it actionable for developers.
Do NOT include the vulnerability ID or package name in your response - just the description.

Response:"""

    return prompt


def format_severity_prompt(vulnerability_data: dict) -> str:
    """
    Generate a prompt for AI-determined severity analysis

    Args:
        vulnerability_data: Dictionary containing vulnerability information

    Returns:
        Formatted prompt string for OpenAI
    """
    vuln_id = vulnerability_data.get('vulnerabilityId', 'Unknown')
    description = vulnerability_data.get('osvData', {}).get('description', 'No description available')
    package_name = vulnerability_data.get('packageName', 'Unknown')
    current_version = vulnerability_data.get('packageContext', {}).get('currentVersion', 'Unknown')
    latest_version = vulnerability_data.get('packageContext', {}).get('latestVersion', 'Unknown')
    osv_severity = vulnerability_data.get('osvData', {}).get('severity', {})
    fixed_in = vulnerability_data.get('osvData', {}).get('fixedIn')
    dependency_type = vulnerability_data.get('packageContext', {}).get('dependencyType', 'dependencies')
    ecosystem = vulnerability_data.get('packageContext', {}).get('ecosystem', 'npm')

    # Extract CVSS score if available
    cvss_score = None
    if isinstance(osv_severity, list) and len(osv_severity) > 0:
        for sev in osv_severity:
            if isinstance(sev, dict) and 'score' in sev:
                cvss_score = sev.get('score')
                break

    prompt = f"""You are a security analyst performing vulnerability severity assessment.

Analyze this vulnerability and determine its real-world severity:

Vulnerability Details:
- ID: {vuln_id}
- Package: {package_name} ({ecosystem})
- Current Version: {current_version}
- Latest Version: {latest_version}
- Dependency Type: {dependency_type}
- OSV Severity: {osv_severity}
{f"- CVSS Score: {cvss_score}" if cvss_score else ""}
{f"- Fixed In: {fixed_in}" if fixed_in else "- Fix: Not yet available"}

Description:
{description}

Analyze considering these factors:
1. CVSS Score (30% weight) - Base severity score
2. Exploitability (25% weight) - How easy to exploit in real-world scenarios
3. Package Context (20% weight) - Production vs dev dependency, package popularity
4. Patch Availability (15% weight) - Is a fix available? How recent?
5. Vulnerability Age (10% weight) - How long has this been known?

Provide your analysis in this EXACT JSON format:
{{
  "severity": "critical|high|medium|low|info",
  "confidence": 85,
  "factors": {{
    "cvssScore": {cvss_score if cvss_score else 0},
    "exploitability": "easy|moderate|difficult",
    "packageCriticality": "high|medium|low",
    "patchAvailable": true,
    "reasoning": "Brief explanation of severity determination"
  }}
}}

Respond ONLY with valid JSON, no additional text.

Response:"""

    return prompt


DESCRIPTION_SYSTEM_PROMPT = """You are a cybersecurity expert who excels at explaining technical vulnerabilities in clear, accessible language for software developers. Your explanations are concise, accurate, and actionable."""

SEVERITY_SYSTEM_PROMPT = """You are a senior security analyst with expertise in vulnerability assessment and risk analysis. You provide objective, data-driven severity ratings based on real-world exploitability and impact."""
