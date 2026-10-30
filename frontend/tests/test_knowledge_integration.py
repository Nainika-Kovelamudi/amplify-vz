import ast
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.deps.rbac import get_current_user
from app.db.base import get_db
from app.db.models import UserRole
from app.routers.assistant import router
from scripts.knowledge_bot_packaging import INTEGRATION_FILES, add_to_package


class AssistantTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router)
        self.app.dependency_overrides[get_db] = lambda: None
        self.client = TestClient(self.app)

    def test_requires_authentication(self):
        response = self.client.post('/assistant/chat', json={'message': 'Hello'})
        self.assertIn(response.status_code, (401, 403))

    def test_uses_verified_user_and_rejects_empty_message(self):
        user = SimpleNamespace(id='verified-user', email='test@example.com', role=UserRole.user)
        self.app.dependency_overrides[get_current_user] = lambda: user
        answer = {'answer': 'Test reply', 'sources': [], 'is_confident': True}
        with patch('app.routers.assistant.get_settings', return_value=SimpleNamespace(chatbot_enabled=True)), \
             patch('app.routers.assistant.answer_question', new=AsyncMock(return_value=answer)) as mock:
            response = self.client.post('/assistant/chat', json={'message': ' Hi ', 'user_id': 'someone-else'})
            self.assertEqual(response.status_code, 200, response.text)
            mock.assert_awaited_once_with('Hi', history=[], user_id='verified-user')
            self.assertEqual(self.client.post('/assistant/chat', json={'message': '  '}).status_code, 422)

    def test_disabled_chatbot_reports_off_and_rejects_chat(self):
        user = SimpleNamespace(id='verified-user', email='test@example.com', role=UserRole.user)
        self.app.dependency_overrides[get_current_user] = lambda: user
        with patch('app.routers.assistant.get_settings', return_value=SimpleNamespace(chatbot_enabled=False)):
            self.assertEqual(self.client.get('/assistant/config').json(), {'enabled': False})
            response = self.client.post('/assistant/chat', json={'message': 'Hello'})
            self.assertEqual(response.status_code, 503)

    def test_package_keeps_existing_backend_and_includes_bot(self):
        root = Path(__file__).resolve().parents[1]
        entries = {name: (root / name).read_bytes() for name in INTEGRATION_FILES}
        entries['unrelated'] = b'preserve existing content'
        add_to_package(entries, str(root))
        first = dict(entries)
        add_to_package(entries, str(root))
        self.assertEqual(entries, first)
        self.assertEqual(entries['unrelated'], b'preserve existing content')
        self.assertIn('app/services/knowledge/assistant_agent.py', entries)
        for name, content in entries.items():
            if name.endswith('.py'):
                ast.parse(content, filename=name)


if __name__ == '__main__':
    unittest.main()
