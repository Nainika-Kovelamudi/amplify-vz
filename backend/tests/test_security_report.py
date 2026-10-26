import csv
import io
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.db.base import get_db
from app.deps.rbac import get_current_user
from app.db.models import UserRole
from app.routers.security_report import router
from app.services.security_report_service import assess_asset, build_report, export_csv, CONTROLS


def asset(**changes):
    values = dict(id=uuid.uuid4(), title='Example', slug='example', family='FORGE', status='Published',
                  description='', dependencies=None, commands=None, owner_name=None, owner_email=None,
                  updated_at=None, ai_feedback=None)
    return SimpleNamespace(**(values | changes))


class SecurityReportTests(unittest.TestCase):
    def test_empty_metadata_is_missing_evidence_not_failed_security(self):
        result = assess_asset(asset())
        self.assertEqual(result['not_documented'], len(CONTROLS))
        self.assertTrue(all(f['status'] == 'Not documented in reviewed fields' for f in result['findings']))
        self.assertEqual(result['existing_ai_security_status'], 'Not evaluated')

    def test_negated_and_planned_statements_never_become_verified(self):
        result = assess_asset(asset(description='Authentication is not implemented. RBAC is planned.'))
        self.assertEqual(result['mentions'], 2)
        for finding in result['findings'][:2]:
            self.assertEqual(finding['status'], 'Mention found - verify')
        self.assertIn('not implemented', result['findings'][0]['evidence'][0]['excerpt'])

    def test_owner_fallback_and_all_asset_statuses(self):
        report = build_report([(asset(status='Archived'), SimpleNamespace(display_name='Owner', email='owner@example.com')),
                               (asset(status='Draft'), None)])
        self.assertEqual(len(report['assets']), 2)
        self.assertEqual(report['assets'][0]['owner_email'], 'owner@example.com')
        self.assertEqual(report['assets'][1]['not_documented'], len(CONTROLS))

    def test_commands_and_ai_verdict_are_separate_evidence(self):
        result = assess_asset(asset(commands=['Run dependency scanning'], ai_feedback={'checklist': {'security': {'status': 'pass'}}}))
        self.assertEqual(result['mentions'], 1)
        self.assertEqual(result['existing_ai_security_status'], 'pass')
        self.assertEqual(result['unverified_controls'], len(CONTROLS))

    def test_csv_exports_each_control_and_neutralizes_formulas(self):
        report = build_report([(asset(title='=HYPERLINK("bad")'), None)])
        rows = list(csv.reader(io.StringIO(export_csv(report).decode('utf-8-sig'))))
        self.assertEqual(len(rows), len(CONTROLS) + 1)
        self.assertTrue(rows[1][1].startswith("'="))
        self.assertIn('not inspected', rows[1][-1])

    def test_owner_only_endpoint_and_empty_export(self):
        app = FastAPI()
        app.include_router(router)
        db = MagicMock(execute=AsyncMock(return_value=MagicMock(all=lambda: [])))
        async def session():
            yield db
        app.dependency_overrides[get_db] = session
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role=UserRole.user)
        with TestClient(app) as client:
            self.assertEqual(client.get('/admin/security-report').status_code, 403)
            app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role=UserRole.owner)
            response = client.get('/admin/security-report')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['assets'], [])
            self.assertEqual(client.get('/admin/security-report?format=csv').status_code, 200)
            self.assertEqual(client.get('/admin/security-report?format=invalid').status_code, 422)
