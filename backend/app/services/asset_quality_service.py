"""Explicit, evidence-based catalog inventory. Indices are not certifications."""
import asyncio
import csv
import io
import json
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit, unquote
from types import SimpleNamespace
from app.services.security_report_service import assess_asset, safe_cell

METHODOLOGY = {
    'security': 'Security findings use description, dependencies and setup commands, plus readable document text when optional verification completes. File names and excerpts identify evidence sources. Mentions remain unverified; documents that are blocked, unsupported or not inspected are not proof of absent controls.',
    'metadata': 'Equal-weight field checks: complete=1, partial=0.5, missing=0. Description length is a completeness proxy, not proof of accuracy.',
    'compliance': 'Evidence-readiness index: missing=0, text mention requiring verification=0.5, ownership or dated review record present=1. Mentions, including negation/plans, never count as verified controls. Not legal compliance or a security certification.',
    'collateral': 'Six expected categories: architecture, sales pitch, marketing, technical guide, demo video, demo link. Each receives 20% for a recorded reference and 20% each for reachability, readable/expected content, relevance signal, and substantive content. Unknown checks earn no points but are counted separately; a low score can mean unverified, not poor quality. Miscellaneous files are inventoried without inflating category coverage.',
    'verification': 'Snapshot by default. Optional checks use approved hosts only, no credentials/cookies, 5 MB document limit and a 45-second total budget. 401/403 means authentication required; redirects, blocked hosts, timeouts and unsupported formats are not verified. No scripts executed. Text relevance uses title-term overlap and is not a human content review.',
}
SLOTS = {'overall_architecture': 'Architecture', 'sales_pitch': 'Sales pitch',
         'marketing_collateral': 'Marketing', 'technical_delivery': 'Technical guide'}
CATEGORIES = list(SLOTS.values()) + ['Demo video', 'Demo link']


def text(value):
    if isinstance(value, list):
        return '\n'.join(str(v) for v in value)
    return str(value or '').strip()


def finding(area, criterion, credit, status, evidence, action):
    return dict(area=area, criterion=criterion, credit=credit, status=status,
                evidence=evidence, action=action)


def index(findings):
    return round(100 * sum(f['credit'] for f in findings) / len(findings), 1) if findings else 0


def references(asset):
    refs = []
    def add(category, value, name=''):
        if isinstance(value, dict):
            name, value = value.get('name', name), value.get('url')
        if isinstance(value, str) and value.strip():
            try:
                filename = unquote(urlsplit(value.strip()).path.rsplit('/', 1)[-1])
                filename = re.sub(r'^[0-9a-fA-F]{32}_', '', filename)
            except ValueError:
                filename = ''
            refs.append(dict(category=category, name=name or filename or category, _url=value.strip()))
    raw = text(getattr(asset, 'architecture_file_url', ''))
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        parsed = None
    if isinstance(parsed, dict):
        for key, category in SLOTS.items():
            add(category, parsed.get(key))
        misc = parsed.get('miscellaneous', [])
        for value in misc if isinstance(misc, list) else []:
            add('Miscellaneous', value)
    elif raw:
        add('Architecture', raw)
    videos = getattr(asset, 'video_urls', None) or []
    if isinstance(videos, list):
        for video in videos:
            add('Demo video', video)
    add('Demo video', getattr(asset, 'video_url', None))
    add('Demo link', getattr(asset, 'demo_url', None))
    seen = set()
    unique = []
    for item in refs:
        key = (item['category'], item['_url'])
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def redact_url(value):
    try:
        p = urlsplit(value)
        return urlunsplit((p.scheme, p.hostname or '', p.path, '', ''))
    except ValueError:
        return '[Invalid URL]'


def assess_metadata(asset, owner):
    fields = [('Title', 'title'), ('Family', 'family'), ('Department', 'department'),
              ('Tech stack', 'tech_stack'), ('Maturity', 'maturity'), ('Deployment environment', 'cloud_provider'),
              ('Dependencies', 'dependencies'), ('Setup instructions', 'commands'),
              ('Owner name', 'owner_name'), ('Owner email', 'owner_email'),
              ('Manager name', 'manager_name'), ('Manager email', 'manager_email')]
    findings = []
    for label, field in fields:
        value = text(getattr(asset, field, ''))
        if not value and owner and field in ('owner_name', 'owner_email'):
            value = text(getattr(owner, 'display_name' if field == 'owner_name' else 'email', ''))
        valid = bool(value) and value.lower() not in ('n/a', 'na', 'tbd', 'test', 'none', 'unknown')
        if 'email' in field:
            valid = valid and bool(re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value))
        findings.append(finding('Metadata', label, 1 if valid else 0, 'Recorded' if valid else 'Missing or invalid',
                                value[:500], f'Confirm and update {label.lower()}.'))
    description = text(getattr(asset, 'description', ''))
    count = len(description.split())
    findings.append(finding('Metadata', 'Description completeness', 1 if count >= 80 else 0.5 if count >= 20 else 0,
                            'Detailed text' if count >= 80 else 'Limited text', f'{count} words',
                            'Describe the problem, workflow, intended users, benefits and technical context.'))
    for label, pattern in [('Business problem / use cases', r'\b(problem|use case|addresses|solves|automates)\b'),
                           ('Intended users', r'\b(users?|teams?|engineers?|developers?|analysts?|sales|customers?)\b'),
                           ('Benefits / outcomes', r'\b(benefit|reduce\w*|improve\w*|saves?|efficien\w*|roi|accuracy)\b')]:
        matched = re.search(pattern, description, re.I)
        findings.append(finding('Metadata', label, 0.5 if matched else 0,
                                'Mention found - verify' if matched else 'Not documented',
                                description[:500] if matched else '', f'Provide clear {label.lower()} and verify accuracy.'))
    from app.schemas.metadata_rules import corporate_repo, cloud_values
    repo = text(getattr(asset, 'repo_url', ''))
    try:
        valid_repo = bool(repo) and bool(corporate_repo(repo))
    except ValueError:
        valid_repo = False
    findings.append(finding('Metadata', 'Corporate repository', 1 if valid_repo else 0,
                            'Recorded - access requires verification' if valid_repo else 'Missing or invalid',
                            redact_url(repo) if repo else '', 'Obtain the correct corporate repository URL from the owner and verify authorized access.'))
    cloud = text(getattr(asset, 'cloud_provider', ''))
    if cloud:
        try: cloud_values(cloud)
        except ValueError:
            for f in findings:
                if f['criterion'] == 'Deployment environment': f.update(credit=0, status='Unsupported cloud tags')
    return findings


def assess_compliance(asset, owner, submission=None, documents=()):
    security = assess_asset(asset, owner)
    for name, content in documents:
        proxy = SimpleNamespace(**{key: getattr(asset, key, None) for key in
            ('id', 'title', 'slug', 'family', 'status', 'owner_name', 'owner_email', 'updated_at', 'ai_feedback')},
            description=content, dependencies=None, commands=None)
        doc_findings = assess_asset(proxy, owner)['findings']
        for original, doc in zip(security['findings'], doc_findings):
            original['evidence'].extend({'field': f'document:{name}', 'excerpt': f'Document {name}: {e["excerpt"]}'} for e in doc['evidence'])
            if original['evidence']:
                original['status'] = 'Mention found - verify'
    findings = []
    for item in security['findings']:
        result = finding('Compliance readiness', item['control'], 0.5 if item['evidence'] else 0,
                         item['status'], '\n'.join(f"{e['field']}: {e['excerpt']}" for e in item['evidence']), item['action'])
        result['section'] = 'security'
        result['evidence_sources'] = item['evidence']
        findings.append(result)
    description = text(getattr(asset, 'description', '')) + '\n' + '\n'.join(f'Document {name}: {content}' for name, content in documents)
    for label, pattern, action in [
        ('IP and licensing', r'\b(licen[cs]\w*|intellectual property|ip ownership|copyright)\b', 'Document ownership, third-party/model licenses and reuse restrictions.'),
        ('Regulatory applicability', r'\b(gdpr|hipaa|pci.dss|regulatory|regulation|compliance)\b', 'Identify applicable obligations, or record a reviewed rationale for non-applicability.'),
    ]:
        match = re.search(pattern, description, re.I)
        findings.append(finding('Compliance readiness', label, 0.5 if match else 0,
                                'Mention found - verify' if match else 'Not documented',
                                description[max(0, match.start()-100):match.end()+300] if match else '', action))
    ownership = security['owner_name'] and security['owner_email']
    findings.append(finding('Compliance readiness', 'Accountable owner', 1 if ownership else 0,
                            'Recorded' if ownership else 'Missing', security['owner_email'], 'Confirm the accountable owner and support contact.'))
    reviewed = submission and getattr(submission, 'reviewed_by', None) and getattr(submission, 'reviewed_at', None)
    findings.append(finding('Compliance readiness', 'Review traceability', 1 if reviewed else 0,
                            'Dated review recorded' if reviewed else 'No matched dated review',
                            f'Reviewer {submission.reviewed_by}; {submission.reviewed_at.isoformat()}' if reviewed else '',
                            'Record an authorized review and decision; a prior review is not a compliance certification.'))
    return findings


async def build_quality_report(rows, submissions=(), verify=False, checker=None, publication_links=None):
    report = {'generated_at': datetime.now(timezone.utc).isoformat(), 'version': 'Asset quality inventory v1',
              'methodology': METHODOLOGY, 'verification_requested': verify, 'assets': []}
    # Match UUID references, legacy public codes and recorded publication links;
    # never guess identity by title similarity.
    queue = []
    sources = {}
    for asset, owner in rows:
        identity = assess_asset(asset, owner)
        candidates = [sub for sub in submissions if str(getattr(sub,'catalog_code','')) in (str(asset.id), str(getattr(asset,'catalog_code','')))
                      or str((publication_links or {}).get(str(getattr(sub,'id','')), '')) == str(asset.id)]
        matched = max(candidates, key=lambda sub: (bool(getattr(sub,'reviewed_at',None)), getattr(sub,'reviewed_at',None) or sub.created_at)) if candidates else None
        sources[str(asset.id)] = (asset, owner, matched)
        refs = references(asset)
        for ref in refs:
            ref.update(url=redact_url(ref['_url']), link_status='Not verified', content_status='Not inspected',
                       relevance_status='Not inspected', substantial=False, checked_at=None)
            try:
                parsed = urlsplit(ref['_url'])
                ref['_valid_url'] = parsed.scheme in ('http', 'https') and bool(parsed.hostname)
            except ValueError:
                ref['_valid_url'] = False
            if not ref['_valid_url']:
                ref['link_status'] = 'Invalid or unsupported URL'
            queue.append((asset, ref))
        report['assets'].append(dict(
            id=str(asset.id), title=asset.title, slug=asset.slug, family=asset.family,
            status=getattr(asset.status, 'value', asset.status), owner_name=identity['owner_name'], owner_email=identity['owner_email'],
            updated_at=identity['updated_at'], asset_path='/catalog/' + asset.slug,
            findings=assess_metadata(asset, owner) + assess_compliance(asset, owner, matched),
            collateral=refs, existing_ai_security_status=identity['existing_ai_security_status'],
            existing_ai_security_note=identity['existing_ai_security_note']))
    if verify and checker:
        sem = asyncio.Semaphore(4)
        async def run(asset, ref):
            async with sem:
                try:
                    ref.update(await checker(ref['_url'], ref['category'], asset.title))
                except Exception:
                    ref['link_status'] = 'Not verified - check failed'
        tasks = [asyncio.create_task(run(asset, ref)) for asset, ref in queue]
        if tasks:
            _, pending = await asyncio.wait(tasks, timeout=45)
            for task in pending:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
    for asset in report['assets']:
        source, owner, submission = sources[asset['id']]
        from app.services.evaluation_jobs import evaluation_health
        asset['evaluation_health'] = evaluation_health(source)
        documents = [(r['name'], r['_text']) for r in asset['collateral'] if r.get('_text') and r['category'] not in ('Demo video', 'Demo link')]
        document_refs = [r for r in asset['collateral'] if r['category'] not in ('Demo video', 'Demo link')]
        asset['security_scope'] = {
            'stored_fields': ['Description', 'Dependencies', 'Setup commands'],
            'documents_provided': len(document_refs),
            'documents_reviewed': len(documents),
            'documents_not_reviewed': len(document_refs) - len(documents),
            'document_checks': [{'file': r['name'], 'status': r['content_status'], 'link_status': r['link_status']} for r in document_refs],
        }
        asset['findings'] = [f for f in asset['findings'] if f['area'] == 'Metadata'] + assess_compliance(source, owner, submission, documents)
        for category in CATEGORIES:
            files = [r for r in asset['collateral'] if r['category'] == category]
            # A category is assessed using its best single artifact, not mixed evidence from different files.
            points = [0.2 * r['_valid_url'] + 0.2 * (r['link_status'] == 'Reachable')
                      + 0.2 * (r['content_status'] in ('Text extracted', 'Expected video content', 'HTML response'))
                      + 0.2 * (r['relevance_status'] == 'Title terms found - verify')
                      + 0.2 * bool(r['substantial']) for r in files]
            credit = round(max(points, default=0), 2)
            asset['findings'].append(finding('Collateral', category, credit, 'Missing' if not files else 'Recorded - see checks',
                f'{len(files)} reference(s)', 'Add the relevant collateral and verify accessibility, relevance, readability and current content.'))
        asset['indices'] = {key: index([f for f in asset['findings'] if f['area'] == area]) for key, area in
                            [('metadata', 'Metadata'), ('compliance', 'Compliance readiness'), ('collateral', 'Collateral')]}
        asset['unverified_links'] = sum(r['link_status'] != 'Reachable' for r in asset['collateral'])
        asset['missing_items'] = sum(f['credit'] == 0 for f in asset['findings'])
        for ref in asset['collateral']:
            del ref['_url']
            ref.pop('_text', None)
            ref.pop('_valid_url', None)
    return report


def sheets(report):
    summary = [['Asset ID', 'Asset', 'Family', 'Status', 'Owner', 'Email', 'Metadata index', 'Compliance readiness index',
                'Collateral index', 'Missing items', 'Links not verified reachable', 'Asset path', 'Updated at', 'Generated at', 'AI evaluation health']]
    details = [['Asset ID', 'Asset', 'Owner email', 'Area', 'Criterion', 'Credit (0-1)', 'Status', 'Evidence', 'Owner action']]
    collateral = [['Asset ID', 'Asset', 'Category', 'Name', 'URL (credentials/query omitted)', 'Link check', 'Content check', 'Relevance check', 'Substantive text signal', 'Checked at']]
    security = [['Asset ID', 'Asset', 'Owner email', 'Security control', 'Evidence status', 'Source fields / file names',
                 'Supporting excerpts', 'Owner action', 'Documents reviewed', 'Documents not reviewed',
                 'Existing AI verdict (historical)', 'Existing AI note']]
    owners = {}
    for a in report['assets']:
        summary.append([a['id'], a['title'], a['family'], a['status'], a['owner_name'], a['owner_email'],
                        a['indices']['metadata'], a['indices']['compliance'], a['indices']['collateral'],
                        a['missing_items'], a['unverified_links'], a['asset_path'], a['updated_at'], report['generated_at'], a.get('evaluation_health','Unknown')])
        for f in a['findings']:
            details.append([a['id'], a['title'], a['owner_email'], f['area'], f['criterion'], f['credit'], f['status'], f['evidence'], f['action']])
            if f.get('section') == 'security':
                scope = a.get('security_scope', {})
                security.append([a['id'], a['title'], a['owner_email'], f['criterion'], f['status'],
                                 '; '.join(e['field'] for e in f.get('evidence_sources', [])),
                                 f['evidence'], f['action'], scope.get('documents_reviewed', 0),
                                 scope.get('documents_not_reviewed', 0), a['existing_ai_security_status'], a['existing_ai_security_note']])
        for r in a['collateral']:
            collateral.append([a['id'], a['title'], r['category'], r['name'], r['url'], r['link_status'], r['content_status'], r['relevance_status'], r['substantial'], r['checked_at']])
        key = a['owner_email'] or 'Owner missing'
        bucket = owners.setdefault(key, [0, 0, 0])
        bucket[0] += 1; bucket[1] += a['missing_items']; bucket[2] += a['unverified_links']
    return {'All Assets': summary, 'Detailed Findings': details, 'Security Evidence': security, 'Collateral Checks': collateral,
            'Owner Actions': [['Owner email', 'Assets', 'Missing items', 'Links not verified reachable']] + [[k, *v] for k, v in sorted(owners.items())],
            'Methodology': [['Area', 'Method']] + [[k, v] for k, v in report['methodology'].items()] +
                           [['Scope', 'All catalog assets, all lifecycle statuses. No code execution, compliance certification, or automatic asset updates.'],
                            ['Generated at', report['generated_at']]]}


def export_quality_csv(report):
    output = io.StringIO(newline='')
    writer = csv.writer(output)
    table = sheets(report)['Detailed Findings']
    writer.writerows([[safe_cell(v) for v in row] for row in table])
    return output.getvalue().encode('utf-8-sig')


def export_quality_xlsx(report):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter
    wb = Workbook(); wb.remove(wb.active)
    for name, rows in sheets(report).items():
        ws = wb.create_sheet(name)
        for row in rows:
            # Explicit string cells prevent spreadsheet formula injection; preserve numeric zero.
            ws.append([v if isinstance(v, (int, float, bool)) else safe_cell(v)[:30000] for v in row])
        ws.freeze_panes = 'A2'; ws.auto_filter.ref = ws.dimensions
        for cell in ws[1]:
            cell.font = Font(bold=True, color='FFFFFF'); cell.fill = PatternFill('solid', fgColor='4338CA')
        for col in range(1, ws.max_column + 1):
            width = min(65, max(16, max(len(str(ws.cell(row, col).value or '')) for row in range(1, min(ws.max_row, 100) + 1))))
            ws.column_dimensions[get_column_letter(col)].width = width
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(vertical='top', wrap_text=True)
    output = io.BytesIO(); wb.save(output); return output.getvalue()
