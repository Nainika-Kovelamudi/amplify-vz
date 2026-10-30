import importlib
import io
import unittest
from unittest.mock import patch

from alembic.migration import MigrationContext
from alembic.operations import Operations


class PlatformStorageMigrationTests(unittest.TestCase):
    def test_postgres_migration_creates_tables_and_preserves_existing_audit_data(self):
        migration = importlib.import_module('app.db.migrations.versions.034_platform_feedback_and_demo_batches')
        output = io.StringIO()
        context = MigrationContext.configure(dialect_name='postgresql', opts={'as_sql': True, 'output_buffer': output})
        with patch.object(migration, 'op', Operations(context)):
            migration.upgrade()
        sql = output.getvalue()
        self.assertIn('CREATE TABLE platform_feedback', sql)
        self.assertIn('CREATE TABLE demo_request_batches', sql)
        self.assertIn('FOREIGN KEY(batch_id) REFERENCES demo_request_batches', sql)
        self.assertIn('INSERT INTO platform_feedback', sql)
        self.assertIn('INSERT INTO demo_request_batches', sql)
        self.assertIn('UPDATE demo_requests request SET batch_id', sql)
        self.assertEqual(migration.down_revision, '033')

    def test_asset_target_migration_preserves_existing_feedback(self):
        migration=importlib.import_module('app.db.migrations.versions.037_feedback_asset_target')
        output=io.StringIO()
        context=MigrationContext.configure(dialect_name='postgresql',opts={'as_sql':True,'output_buffer':output})
        with patch.object(migration,'op',Operations(context)):
            migration.upgrade()
        sql=output.getvalue()
        self.assertIn('ADD COLUMN asset_id UUID',sql)
        self.assertIn('ADD COLUMN asset_title VARCHAR',sql)
        self.assertIn('ON DELETE SET NULL',sql)
        self.assertNotIn('DELETE FROM',sql)
        self.assertEqual(migration.down_revision,'036')


if __name__ == '__main__':
    unittest.main()
