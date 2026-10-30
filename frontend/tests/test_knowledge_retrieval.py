import unittest
from unittest.mock import AsyncMock, patch

from app.services.knowledge.assistant_agent import answer_question


class KnowledgeAnswerTests(unittest.IsolatedAsyncioTestCase):
    async def test_stored_details_reach_answer_model(self):
        record = {
            'title': 'Healthcare Bot', 'source_type': 'catalog_asset',
            'text': 'Supports patients and hospital staff with role-specific answers.',
            'summary': '', 'tags': [], 'link': '/catalog/healthcare-bot',
        }
        with patch('app.services.asset_lifecycle.filter_live_catalog_results', new=AsyncMock(side_effect=lambda rows: rows)), \
             patch('app.services.knowledge.assistant_agent.hybrid_search',
                   new=AsyncMock(return_value={'results': [record], 'is_confident': True})), \
             patch('app.services.knowledge.assistant_agent.call_llm_text',
                   new=AsyncMock(return_value='Healthcare bot details')) as llm:
            response = await answer_question('Tell me about the healthcare bot')
            self.assertIn(record['text'], llm.call_args.args[1])
            self.assertEqual(response['sources'][0]['title'], record['title'])

    async def test_empty_search_does_not_invent_publication_status(self):
        with patch('app.services.asset_lifecycle.filter_live_catalog_results', new=AsyncMock(side_effect=lambda rows: rows)), \
             patch('app.services.knowledge.assistant_agent.hybrid_search',
                   new=AsyncMock(return_value={'results': [], 'is_confident': False})), \
             patch('app.services.knowledge.assistant_agent.call_llm_text', new=AsyncMock()) as llm:
            response = await answer_question('Healthcare bot details')
            llm.assert_not_awaited()
            self.assertFalse(response['is_confident'])
            self.assertEqual(response['sources'], [])
            self.assertIn("doesn't mean", response['answer'])


if __name__ == '__main__':
    unittest.main()
