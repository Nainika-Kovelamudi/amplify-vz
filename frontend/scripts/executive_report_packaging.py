"""Replace only the executive report handler in a legacy deployment router."""
import ast
from pathlib import Path


def patch_executive_report_router(source, repo_dir):
    canonical = (Path(repo_dir) / 'app/routers/admin.py').read_text(encoding='utf-8')
    def find(text, name):
        matches = [node for node in ast.parse(text).body
                   if isinstance(node, ast.AsyncFunctionDef) and node.name == name]
        if len(matches) != 1:
            raise ValueError('Expected exactly one handler: ' + name)
        return matches[0]
    for name in ('get_executive_report', 'download_executive_report'):
        replacement = ast.get_source_segment(canonical, find(canonical,name))
        target = find(source,name)
        lines = source.splitlines(keepends=True)
        source = ''.join(lines[:target.lineno-1]) + replacement + '\n' + ''.join(lines[target.end_lineno:])
    return source


def patch_admin_decision_router(source, repo_dir):
    canonical = (Path(repo_dir) / 'app/routers/admin.py').read_text(encoding='utf-8')
    for name in ('reject_submission', 'final_reject_submission', 'hold_submission'):
        old = [n for n in ast.parse(source).body if isinstance(n, ast.AsyncFunctionDef) and n.name == name]
        new = [n for n in ast.parse(canonical).body if isinstance(n, ast.AsyncFunctionDef) and n.name == name]
        if len(old) != 1 or len(new) != 1:
            raise ValueError('Expected exactly one decision handler: ' + name)
        lines = source.splitlines(keepends=True)
        source = ''.join(lines[:old[0].lineno-1]) + ast.get_source_segment(canonical,new[0]) + '\n' + ''.join(lines[old[0].end_lineno:])
    if 'from fastapi import BackgroundTasks' not in source:
        source = source.replace('from __future__ import annotations',
            'from __future__ import annotations\nfrom fastapi import BackgroundTasks', 1)
    return source
