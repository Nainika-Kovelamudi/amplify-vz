from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from azure.core.exceptions import ResourceExistsError
from app.services.artifact_migration import _copy_stream


class AzureLikeChunks:
    def __iter__(self):
        raise TypeError('Async stream must be iterated asynchronously.')

    async def __aiter__(self):
        for chunk in (b'first', b'second'):
            yield chunk


@pytest.mark.asyncio
async def test_copy_uses_async_only_stream_and_retains_upload_protection():
    source=SimpleNamespace(download_blob=AsyncMock(return_value=SimpleNamespace(chunks=lambda:AzureLikeChunks())))
    settings=object()
    received=[]
    async def upload(data, **kwargs):
        # Match Azure SDK dispatch: sync iteration is checked first.
        assert not hasattr(data,'__iter__')
        assert hasattr(data,'__aiter__')
        async for chunk in data:
            received.append(chunk)
        assert kwargs=={'length':11,'overwrite':False,'content_settings':settings,
                        'metadata':{'migration_source_sha256':'expected-hash'}}
    await _copy_stream(source,SimpleNamespace(upload_blob=upload),settings,'expected-hash',11)
    assert b''.join(received)==b'firstsecond'


@pytest.mark.asyncio
async def test_copy_does_not_suppress_existing_destination_error():
    source=SimpleNamespace(download_blob=AsyncMock(return_value=SimpleNamespace(chunks=lambda:AzureLikeChunks())))
    destination=SimpleNamespace(upload_blob=AsyncMock(side_effect=ResourceExistsError('exists')))
    with pytest.raises(ResourceExistsError):
        await _copy_stream(source,destination,None,'hash',11)
    assert destination.upload_blob.call_args.kwargs['overwrite'] is False
