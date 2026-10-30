import asyncio
import io
import json
import unittest
import uuid
import zipfile
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.db.base import get_db
from app.deps.rbac import get_current_user
from app.db.models import UserRole
from app.routers.security_report import quality_router
from app.services.asset_quality_service import build_quality_report, references, export_quality_xlsx, export_quality_csv
from app.services.quality_link_checker import checker_for_hosts, extract


def asset(**changes):
    values = dict(id=uuid.uuid4(), title='Ticket Triage', slug='ticket-triage', catalog_code='FRG-001', family='FORGE',
                  status='Archived', description='', dependencies=None, commands=None, owner_name=None,
                  owner_email=None, updated_at=None, ai_feedback=None, architecture_file_url=None, video_url=None,
                  video_urls=[], demo_url=None, manager_name=None, manager_email=None)
    return SimpleNamespace(**(values | changes))


class AssetQualityTests(unittest.TestCase):
    def test_missing_assets_included_and_no_division_by_zero(self):
        report = asyncio.run(build_quality_report([(asset(), None)]))
        a = report['assets'][0]
        self.assertEqual(a['status'], 'Archived')
        self.assertEqual(a['indices']['collateral'], 0)
        self.assertEqual(len([f for f in a['findings'] if f['area'] == 'Collateral']), 6)
        self.assertTrue(a['missing_items'] > 0)
        self.assertEqual(asyncio.run(build_quality_report([]))['assets'], [])

    def test_all_named_and_misc_references_and_legacy_architecture(self):
        raw = json.dumps({'overall_architecture': 'https://example.com/a.pdf', 'sales_pitch': 'https://example.com/s.pdf',
                          'miscellaneous': [{'name': 'Security', 'url': 'https://example.com/security.pdf'}, {'name': 'Other', 'url': 'https://example.com/other.html'}]})
        refs = references(asset(architecture_file_url=raw, video_url='https://example.com/video.mp4', video_urls=['https://example.com/video.mp4']))
        self.assertEqual(len(refs), 5)
        self.assertEqual(references(asset(architecture_file_url='https://example.com/old.pdf'))[0]['category'], 'Architecture')

    def test_optional_document_evidence_and_no_signed_urls_leak(self):
        async def check(url, category, title):
            return dict(link_status='Reachable', content_status='Text extracted', relevance_status='Title terms found - verify',
                        substantial=True, _text='Authentication is implemented through SSO. Tokens use Key Vault.')
        report = asyncio.run(build_quality_report([(asset(architecture_file_url='https://example.com/doc.pdf?sig=SECRET'), None)], verify=True, checker=check))
        a = report['assets'][0]
        authentication = next(f for f in a['findings'] if f['area'] == 'Compliance readiness' and f['criterion'] == 'Authentication')
        self.assertEqual(authentication['credit'], 0.5)
        self.assertIn('Document', authentication['evidence'])
        self.assertEqual(authentication['section'], 'security')
        self.assertTrue(any(e['field'] == 'document:doc.pdf' for e in authentication['evidence_sources']))
        self.assertEqual(a['security_scope']['documents_reviewed'], 1)
        self.assertEqual(a['security_scope']['documents_not_reviewed'], 0)
        self.assertNotIn('SECRET', json.dumps(report))
        self.assertNotIn('_text', json.dumps(report))
        self.assertAlmostEqual(a['indices']['collateral'], round(100/6, 1))

    def test_unverified_reference_does_not_earn_quality_credit(self):
        report = asyncio.run(build_quality_report([(asset(demo_url='https://example.com'), None)]))
        a = report['assets'][0]
        self.assertEqual(a['unverified_links'], 1)
        self.assertEqual(a['indices']['collateral'], 3.3)
        invalid = asyncio.run(build_quality_report([(asset(demo_url='javascript:alert(1)'), None)]))
        self.assertEqual(invalid['assets'][0]['indices']['collateral'], 0)

    def test_security_sources_include_stored_fields_and_unread_documents_are_explicit(self):
        report = asyncio.run(build_quality_report([(asset(
            dependencies='Secrets management uses Key Vault.', commands=['Configure RBAC roles.'],
            architecture_file_url='https://example.com/guide.pdf'), None)]))
        a = report['assets'][0]
        self.assertEqual(a['security_scope']['documents_provided'], 1)
        self.assertEqual(a['security_scope']['documents_reviewed'], 0)
        self.assertEqual(a['security_scope']['documents_not_reviewed'], 1)
        findings = {f['criterion']: f for f in a['findings'] if f.get('section') == 'security'}
        self.assertEqual(len(findings), 10)
        self.assertIn('dependencies:', findings['Secrets management']['evidence'])
        self.assertIn('commands:', findings['Authorization']['evidence'])
        self.assertEqual(findings['Authentication']['credit'], 0)

    def test_unreadable_attachment_is_not_assessed_and_negation_is_not_passed(self):
        async def blocked(url, category, title):
            return dict(link_status='Authentication required', content_status='Not inspected')
        report = asyncio.run(build_quality_report([(asset(description='Authentication is not implemented.',
            architecture_file_url='https://example.com/security.pdf'), None)], verify=True, checker=blocked))
        a = report['assets'][0]
        self.assertEqual(a['security_scope']['documents_not_reviewed'], 1)
        self.assertEqual(a['security_scope']['document_checks'][0]['link_status'], 'Authentication required')
        auth = next(f for f in a['findings'] if f['criterion'] == 'Authentication')
        self.assertEqual(auth['status'], 'Mention found - verify')
        self.assertEqual(auth['credit'], 0.5)

    def test_formula_safe_workbook_zero_values_and_all_sheets(self):
        import openpyxl
        report = asyncio.run(build_quality_report([(asset(title='=HYPERLINK("bad")', description='description\x00with invalid XML control'), None)]))
        wb = openpyxl.load_workbook(io.BytesIO(export_quality_xlsx(report)))
        self.assertEqual(wb.sheetnames, ['All Assets', 'Detailed Findings', 'Security Evidence', 'Collateral Checks', 'Owner Actions', 'Methodology'])
        self.assertTrue(wb['All Assets']['B2'].value.startswith("'="))
        self.assertEqual(wb['All Assets']['I2'].value, 0)
        self.assertEqual(wb['All Assets'].max_row, 2)
        self.assertEqual(wb['Security Evidence'].max_row, 11)
        self.assertIn(b'Owner action', export_quality_csv(report))

    def test_blocked_and_invalid_hosts_never_fetch(self):
        check = checker_for_hosts(['approved.example.com'])
        for url in ['http://127.0.0.1/secret', 'https://unapproved.example.com', 'file:///etc/passwd', 'https://user:pass@approved.example.com']:
            result = asyncio.run(check(url, 'Architecture', 'Example'))
            self.assertNotEqual(result['link_status'], 'Reachable')

    def test_html_scripts_not_executed_or_used_as_evidence(self):
        result = extract(b'<html><script>authentication secrets</script><p>Ticket Triage technical guide</p></html>', '.html', 'text/html')
        self.assertNotIn('authentication', result)
        self.assertIn('technical guide', result)

    def test_pptx_text_extraction(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as z:
            z.writestr('ppt/slides/slide1.xml', '<r xmlns:a="urn:test"><a:t>Ticket Triage</a:t></r>')
        self.assertIn('Ticket Triage', extract(buf.getvalue(), '.pptx', ''))

    def test_endpoint_requires_owner_and_downloads_empty_workbook(self):
        app = FastAPI(); app.include_router(quality_router)
        db = MagicMock(execute=AsyncMock(return_value=MagicMock(all=lambda: [])))
        async def session(): yield db
        app.dependency_overrides[get_db] = session
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role=UserRole.user)
        settings = SimpleNamespace(quality_report_allowed_hosts='', frontend_url='https://portal.example.com', blob_account_name='')
        with patch('app.config.get_settings', return_value=settings), TestClient(app) as client:
            self.assertEqual(client.get('/admin/asset-quality-report').status_code, 403)
            app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role=UserRole.owner)
            self.assertEqual(client.get('/admin/asset-quality-report').json()['assets'], [])
            self.assertEqual(client.get('/admin/asset-quality-report?format=xlsx').status_code, 200)
            self.assertEqual(client.get('/admin/asset-quality-report?format=invalid').status_code, 422)
