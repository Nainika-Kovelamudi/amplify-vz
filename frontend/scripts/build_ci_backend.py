"""Build a backend ZIP using only this checkout; never include local secrets."""
from pathlib import Path
import ast
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
LEGACY_MIGRATION = 'app/db/migrations/versions/add_vertical_additional_details_to_demo_requests.py'


def build():
    files = [p for p in (ROOT / 'app').rglob('*') if p.is_file()
             and '__pycache__' not in p.parts and p.suffix != '.pyc']
    files += [ROOT / name for name in ('requirements.txt', 'alembic.ini', 'startup.sh', 'migrate.sh')]
    files = sorted(p for p in files if p.relative_to(ROOT).as_posix() != LEGACY_MIGRATION)
    entries = {}
    for path in files:
        name = path.relative_to(ROOT).as_posix()
        if path.name.startswith('.env') or path.suffix.lower() in ('.pem', '.key', '.pfx'):
            raise ValueError(f'Secret-like file cannot be packaged: {name}')
        content = path.read_bytes()
        if path.suffix == '.py':
            ast.parse(content, filename=name)
        entries[name] = content
    # Validate the exact migration set being shipped, not the legacy standalone revision.
    revisions = {}
    for name, content in entries.items():
        if '/versions/' not in name or not name.endswith('.py'):
            continue
        values = {}
        for node in ast.parse(content).body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id in ('revision', 'down_revision'):
                        values[target.id] = ast.literal_eval(node.value)
        if 'revision' in values:
            revision = values['revision']
            if revision in revisions:
                raise ValueError(f'Duplicate revision: {revision}')
            revisions[revision] = values.get('down_revision')
    parents = set()
    for revision, parent in revisions.items():
        if parent is not None:
            if parent not in revisions:
                raise ValueError(f'Missing predecessor {parent} for {revision}')
            parents.add(parent)
    heads = set(revisions) - parents
    if len(heads) != 1:
        raise ValueError(f'Expected one migration head, got {sorted(heads)}')
    output = ROOT / 'ci_artifacts'
    output.mkdir(exist_ok=True)
    with zipfile.ZipFile(output / 'backend.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    (output / 'backend-manifest.json').write_text(json.dumps({
        'migration_head': next(iter(heads)),
        'files': {name: hashlib.sha256(content).hexdigest() for name, content in entries.items()},
    }, indent=2), encoding='utf-8')
    print(f'Built backend.zip: {len(entries)} files; migration head {next(iter(heads))}')


if __name__ == '__main__':
    build()
