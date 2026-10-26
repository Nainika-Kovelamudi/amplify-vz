"""Conservative evidence inventory, not a security scan or compliance certification."""
import csv
import io
import re
from datetime import datetime, timezone

# A match is only a lead for a reviewer, never proof of an implemented control.
CONTROLS = (
    ('Authentication', r'\b(authentication|oauth\w*|openid|saml|sso|entra|jwt|webhook.{0,30}(signature|auth)|hmac)\b',
     'Describe sign-in and API/webhook authentication, identity provider, and verification steps.'),
    ('Authorization', r'\b(authorization|authorisation|rbac|abac|least privilege|access control|role.based)\b',
     'Document user roles, permission boundaries, tenant isolation, and least-privilege access.'),
    ('Secrets management', r'\b(key vault|secrets? manager|secrets? management|token storage|credential rotation|secret rotation)\b',
     'Document where credentials and API tokens are stored, access restrictions, and rotation; never include actual secrets.'),
    ('Input and AI safety', r'\b(sanitiz\w*|sanitis\w*|input validation|prompt injection|input filtering|output filtering|guardrails?)\b',
     'Describe input validation, prompt-injection defenses, output handling, and relevant abuse tests.'),
    ('Data protection', r'\b(encryption|encrypted|tls|https|data masking|redaction|pii|personal data)\b',
     'Document encryption in transit/at rest and masking of sensitive data, including data sent to LLMs.'),
    ('Data handling and privacy', r'\b(data retention|data residency|data deletion|privacy|consent|data handling)\b',
     'Describe data categories, retention/deletion, residency, and third-party model/vector-store data flows.'),
    ('Audit logging', r'\b(audit log\w*|audit trail|security monitoring|security event\w*)\b',
     'Specify recorded security events, retention, access to logs, and monitoring/alerting responsibilities.'),
    ('Dependency and vulnerability management', r'\b(vulnerability|vulnerabilities|dependency scanning|sast|dast|sbom|patching|penetration test\w*)\b',
     'Provide dependency/vulnerability scan evidence, patch process, and remediation ownership.'),
    ('Deployment hardening', r'\b(network isolation|private endpoint|firewall|rate limit\w*|hardening|non.root|container secur\w*)\b',
     'Document network boundaries, rate limits, container/runtime hardening, and environment separation.'),
    ('Security verification', r'\b(security test\w*|threat model\w*|security review|penetration test\w*|abuse test\w*)\b',
     'Attach a dated security review, threat model, or relevant test results and identify the reviewer.'),
)
FIELDS = ('description', 'dependencies', 'commands')
LIMITATION = ('Reviews stored description, dependencies and setup commands only. Uploaded documents, '
              'repository code and running endpoints are not inspected. Keyword matches are leads, '
              'not verified controls. Missing text does not prove a control is absent.')


def assess_asset(asset, owner=None):
    findings = []
    for title, pattern, action in CONTROLS:
        evidence = []
        for field in FIELDS:
            value = getattr(asset, field, None)
            if isinstance(value, list):
                value = '\n'.join(str(item) for item in value)
            if not isinstance(value, str):
                continue
            # Keep the original sentence so negation/planned work stays visible.
            for sentence in re.split(r'(?<=[.!?])\s+|[\r\n]+', value):
                if re.search(pattern, sentence, re.IGNORECASE):
                    evidence.append({'field': field, 'excerpt': sentence[:600]})
                    break
        findings.append({
            'control': title,
            'status': 'Mention found - verify' if evidence else 'Not documented in reviewed fields',
            'evidence': evidence,
            'action': ('Verify the quoted statement describes an implemented control, not a plan or missing control. ' if evidence else '') + action,
        })
    feedback = getattr(asset, 'ai_feedback', None) or {}
    checklist = feedback.get('checklist', {}) if isinstance(feedback, dict) else {}
    security = checklist.get('security', {}) if isinstance(checklist, dict) else {}
    return {
        'id': str(asset.id), 'title': asset.title, 'slug': asset.slug,
        'family': asset.family, 'status': getattr(asset.status, 'value', asset.status),
        'owner_name': asset.owner_name or (getattr(owner, 'display_name', None) if owner else None) or '',
        'owner_email': asset.owner_email or (getattr(owner, 'email', None) if owner else None) or '',
        'updated_at': asset.updated_at.isoformat() if asset.updated_at else None,
        'mentions': sum(bool(item['evidence']) for item in findings), 'total_controls': len(findings),
        'not_documented': sum(not item['evidence'] for item in findings),
        'unverified_controls': len(findings),
        'existing_ai_security_status': security.get('status', 'Not evaluated') if isinstance(security, dict) else 'Not evaluated',
        'existing_ai_security_note': security.get('note', '') if isinstance(security, dict) else '',
        'findings': findings,
    }


def build_report(assets_and_owners):
    return {'generated_at': datetime.now(timezone.utc).isoformat(), 'method': 'Security evidence inventory v1',
            'limitation': LIMITATION, 'assets': [assess_asset(asset, owner) for asset, owner in assets_and_owners]}


def safe_cell(value):
    value = str(value if value is not None else '')
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', value)
    # Untrusted descriptions must not become spreadsheet formulas when opened in Excel.
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@')) or value.startswith(('\t', '\r', '\n')) else value


def export_csv(report):
    output = io.StringIO(newline='')
    writer = csv.writer(output)
    writer.writerow(['Asset ID', 'Asset', 'Family', 'Status', 'Owner', 'Owner email', 'Asset path',
                     'Control', 'Evidence status', 'Source fields', 'Evidence excerpts', 'Required owner action',
                     'Existing AI security verdict (not independently verified)', 'Existing AI note',
                     'Asset updated at', 'Report generated at', 'Scope and limitations'])
    for asset in report['assets']:
        for finding in asset['findings']:
            writer.writerow([safe_cell(value) for value in [
                asset['id'], asset['title'], asset['family'], asset['status'], asset['owner_name'], asset['owner_email'],
                '/catalog/' + asset['slug'], finding['control'], finding['status'],
                '; '.join(e['field'] for e in finding['evidence']),
                '\n'.join(e['excerpt'] for e in finding['evidence']), finding['action'],
                asset['existing_ai_security_status'], asset['existing_ai_security_note'],
                asset['updated_at'], report['generated_at'], report['limitation'],
            ]])
    return output.getvalue().encode('utf-8-sig')
