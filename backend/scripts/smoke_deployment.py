"""Fail deployment if the backend is unhealthy or running incomplete route code."""
import json
import sys
import time
from urllib.request import urlopen

base = sys.argv[1].rstrip('/')
for attempt in range(12):
    try:
        with urlopen(base + '/health', timeout=15) as response:
            assert json.load(response)['status'] == 'ok'
        with urlopen(base + '/openapi.json', timeout=15) as response:
            paths = json.load(response)['paths']
        for route in ('/auth/login', '/catalog', '/demo-requests/my', '/admin/users/{user_id}', '/assistant/config',
                      '/admin/platform-operations/inventory', '/admin/platform-operations/remediations',
                      '/admin/asset-quality-report'):
            assert route in paths, f'Missing deployed route: {route}'
        print('Backend health and route checks passed')
        break
    except Exception as exc:
        if attempt == 11:
            raise SystemExit(f'Backend smoke check failed: {type(exc).__name__}') from None
        time.sleep(10)
