import io
import json
import zipfile
from unittest.mock import patch
from xml.sax.saxutils import escape

import httpx
import pytest
from app.services.document_reader import _read_pptx, extract_document_text, MAX_CHARS_PER_DOC
from app.services.agents.document_validation_agent import DocumentValidationAgent

P='http://schemas.openxmlformats.org/presentationml/2006/main'
A='http://schemas.openxmlformats.org/drawingml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'


def deck(slides,order=None,extra=None):
    """In-memory OOXML fixture, with text/table/group structures used by real decks."""
    output=io.BytesIO();order=order or list(slides)
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('ppt/presentation.xml',f'<p:presentation xmlns:p="{P}" xmlns:r="{R}"><p:sldIdLst>'+''.join(f'<p:sldId id="{256+i}" r:id="rId{number}"/>' for i,number in enumerate(order))+'</p:sldIdLst></p:presentation>')
        archive.writestr('ppt/_rels/presentation.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(f'<Relationship Id="rId{number}" Type="{R}/slide" Target="slides/slide{number}.xml"/>' for number in slides)+'</Relationships>')
        for number,body in slides.items():
            archive.writestr(f'ppt/slides/slide{number}.xml',f'<p:sld xmlns:p="{P}" xmlns:a="{A}"><p:cSld><p:spTree>{body}</p:spTree></p:cSld></p:sld>')
        for name,value in (extra or {}).items():archive.writestr(name,value)
    return output.getvalue()


def paragraph(text):return f'<a:p><a:r><a:t>{escape(text)}</a:t></a:r></a:p>'


def test_extracts_slide_text_grouped_shapes_and_table_cells_in_presentation_order():
    table='<a:tbl><a:tr><a:tc><a:txBody>'+paragraph('Authentication')+'</a:txBody></a:tc><a:tc><a:txBody>'+paragraph('Microsoft Entra ID')+'</a:txBody></a:tc></a:tr></a:tbl>'
    raw=deck({1:'<p:grpSp><p:sp>'+paragraph('Guard AI security architecture')+'</p:sp></p:grpSp>'+table,
              2:paragraph('Deployment prerequisites')},order=[2,1],
             extra={'ppt/slideMasters/slideMaster1.xml':paragraph('Ignore master text')})
    text=_read_pptx(raw,6000)
    assert text.index('Deployment prerequisites')<text.index('Guard AI security architecture')
    assert 'Authentication' in text and 'Microsoft Entra ID' in text and 'Ignore master text' not in text


def test_pptx_cap_and_image_only_or_corrupt_deck():
    assert '[... document truncated ...]' in _read_pptx(deck({1:paragraph('Long slide '*1000)}),100)
    assert _read_pptx(deck({1:'<p:pic/>'}),6000)==''
    assert _read_pptx(b'not a zip file',6000)==''


def test_large_expanded_xml_is_rejected():
    assert _read_pptx(deck({1:paragraph('x'*(2*1024*1024))}),6000)==''


def test_xml_declarations_are_rejected_without_resolving_entities():
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w') as archive:
        archive.writestr('ppt/slides/slide1.xml','<!DOCTYPE x [<!ENTITY injected "secret">]><x>&injected;</x>')
    assert _read_pptx(output.getvalue(),6000)==''


@pytest.mark.asyncio
@pytest.mark.parametrize('url,content_type',[
    ('https://example.com/pitch.PPTX?sig=example','application/octet-stream'),
    ('https://example.com/document','application/vnd.openxmlformats-officedocument.presentationml.presentation'),
    ('https://example.com/pitch%2Epptx?download=1','application/octet-stream'),
])
async def test_pptx_detected_by_extension_or_mime_in_ai_extraction(url,content_type):
    response=httpx.Response(200,content=deck({1:paragraph('Healthcare Bot architecture and use cases')}),headers={'content-type':content_type},request=httpx.Request('GET',url))
    with patch('app.services.document_reader.httpx.AsyncClient') as factory:
        factory.return_value.__aenter__.return_value.get.return_value=response
        text,kind=await extract_document_text(url)
    assert kind=='pptx' and 'Healthcare Bot' in text


@pytest.mark.asyncio
async def test_sales_pitch_pptx_text_reaches_document_validation_prompt():
    url='https://example.com/sales.pptx'
    response=httpx.Response(200,content=deck({1:paragraph('Healthcare Bot handles patient queries and appointment workflows.')}),request=httpx.Request('GET',url))
    with patch('app.services.document_reader.httpx.AsyncClient') as factory:
        factory.return_value.__aenter__.return_value.get.return_value=response
        text,kind=await extract_document_text(json.dumps({'sales_pitch':url}))
    assert kind=='multi_doc:pptx'
    assert 'Sales Pitch Doc' in text and 'Healthcare Bot handles patient queries' in text
    prompt=DocumentValidationAgent().build_prompt({'title':'Healthcare Bot','description':'Patient query assistant','doc_text':text,'doc_file_type':kind})
    assert 'Healthcare Bot handles patient queries' in prompt


@pytest.mark.asyncio
async def test_existing_text_document_extraction_remains_supported():
    url='https://example.com/readme.txt'
    response=httpx.Response(200,content=b'Existing setup instructions',request=httpx.Request('GET',url))
    with patch('app.services.document_reader.httpx.AsyncClient') as factory:
        factory.return_value.__aenter__.return_value.get.return_value=response
        assert await extract_document_text(url)==('Existing setup instructions','text')
