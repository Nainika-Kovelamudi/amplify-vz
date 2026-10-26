"""Bounded, unauthenticated checks of explicitly approved HTTP hosts."""
import asyncio
import ipaddress
import re
import socket
import zipfile
from io import BytesIO
from html.parser import HTMLParser
from urllib.parse import urlsplit
from datetime import datetime, timezone
import httpx

MAX_BYTES = 5 * 1024 * 1024


class PlainHTML(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []; self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.hidden += 1
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.hidden = max(0, self.hidden - 1)
    def handle_data(self, data):
        if not self.hidden: self.parts.append(data)


def extract(raw, suffix, content_type):
    if suffix == '.pdf':
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(raw))
        return '\n'.join((page.extract_text() or '') for page in list(reader.pages)[:15])[:20000]
    if suffix in ('.docx', '.pptx', '.xlsx'):
        from xml.etree import ElementTree
        with zipfile.ZipFile(BytesIO(raw)) as archive:
            selected = [n for n in archive.namelist() if n == 'word/document.xml' or
                        (n.startswith('ppt/slides/slide') and n.endswith('.xml')) or n == 'xl/sharedStrings.xml'][:20]
            parts = []; total = 0
            for name in selected:
                info = archive.getinfo(name); total += info.file_size
                if total > MAX_BYTES: raise ValueError('Expanded document exceeds limit')
                root = ElementTree.fromstring(archive.read(name))
                parts.extend(n.text or '' for n in root.iter() if n.tag.rsplit('}', 1)[-1] in ('t',))
            return ' '.join(parts)[:20000]
    if suffix in ('.html', '.htm') or 'text/html' in content_type:
        parser = PlainHTML(); parser.feed(raw.decode('utf-8', errors='replace'))
        return ' '.join(parser.parts)[:20000]
    if suffix in ('.txt', '.md', '.rst') or content_type.startswith('text/plain'):
        return raw.decode('utf-8', errors='replace')[:20000]
    return ''


def checker_for_hosts(allowed_hosts):
    allowed = {h.lower().strip() for h in allowed_hosts if h.strip()}
    async def check(url, category, title):
        result = dict(link_status='Not verified', content_status='Not inspected', relevance_status='Not inspected',
                      substantial=False, checked_at=datetime.now(timezone.utc).isoformat())
        try:
            p = urlsplit(url)
            if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password or p.port not in (None, 80, 443):
                result['link_status'] = 'Invalid or unsupported URL'; return result
            if p.hostname.lower() not in allowed:
                result['link_status'] = 'Not verified - host not approved'; return result
            # Exact configured host allowlist plus public-address validation. No wildcard hosts/redirect following.
            addresses = await asyncio.get_running_loop().getaddrinfo(p.hostname, p.port or (443 if p.scheme == 'https' else 80), type=socket.SOCK_STREAM)
            if not addresses or any(not ipaddress.ip_address(row[4][0]).is_global for row in addresses):
                result['link_status'] = 'Not verified - private/reserved address'; return result
            async with httpx.AsyncClient(timeout=4, follow_redirects=False, trust_env=False) as client:
                method = 'HEAD' if category == 'Demo video' else 'GET'
                async with client.stream(method, url) as response:
                    code = response.status_code
                    if code in (401, 403): result['link_status'] = 'Authentication required'; return result
                    if 300 <= code < 400: result['link_status'] = 'Not verified - redirect requires review'; return result
                    if code in (404, 410): result['link_status'] = f'Broken reference - HTTP {code}'; return result
                    if code >= 400: result['link_status'] = f'Check failed - HTTP {code}'; return result
                    result['link_status'] = 'Reachable'
                    ct = response.headers.get('content-type', '').lower()
                    if category == 'Demo video':
                        result['content_status'] = 'Expected video content' if ct.startswith('video/') else 'Video content type not verified'
                        return result
                    data = bytearray()
                    async for chunk in response.aiter_bytes():
                        data.extend(chunk)
                        if len(data) > MAX_BYTES:
                            result['content_status'] = 'Not inspected - exceeds 5 MB limit'; return result
            suffix = '.' + p.path.rsplit('.', 1)[-1].lower() if '.' in p.path else ''
            try:
                content = await asyncio.wait_for(asyncio.to_thread(extract, bytes(data), suffix, ct), 5)
            except Exception:
                result['content_status'] = 'Not verified - text extraction failed'; return result
            if not content.strip():
                result['content_status'] = 'Not verified - unsupported, scanned or empty content'; return result
            result['content_status'] = 'HTML response' if category == 'Demo link' and 'html' in ct else 'Text extracted'
            tokens = {w for w in re.findall(r'[a-z0-9]+', title.lower()) if len(w) > 3 and w not in ('framework', 'platform', 'solution')}
            result['relevance_status'] = 'Title terms found - verify' if tokens and any(w in content.lower() for w in tokens) else 'Relevance requires manual review'
            result['substantial'] = len(content.split()) >= 80
            result['_text'] = content
            # HTML can be a login/error shell. Reachability alone never proves a functional demo.
            if re.search(r'\b(sign in|log in|access denied|page not found)\b', content, re.I):
                result['content_status'] = 'Possible login/error page - review'
                result['relevance_status'] = 'Relevance requires manual review'; result['substantial'] = False
                result.pop('_text', None)
            return result
        except Exception:
            result['link_status'] = 'Not verified - network or parsing failure'; return result
    return check
