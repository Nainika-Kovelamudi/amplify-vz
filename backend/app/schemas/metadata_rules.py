"""Shared input rules for browser, direct API and deployment packaging paths."""
import re
import json
from urllib.parse import urlsplit
from pydantic import BaseModel, field_validator, model_validator

CLOUDS = {'azure': 'Azure', 'aws': 'AWS', 'gcp': 'GCP', 'on-premise': 'On-Premise',
          'on-prem': 'On-Premise', 'on premises': 'On-Premise', 'on-premises': 'On-Premise',
          'hybrid': 'Hybrid', 'multi-cloud': 'Multi-Cloud', 'multi cloud': 'Multi-Cloud'}


def corporate_repo(value):
    if value is None: return value
    if not value.strip(): raise ValueError('Repository URL cannot be blank.')
    value = value.strip(); p = urlsplit(value); parts = p.path.strip('/').split('/')
    github = p.hostname in ('github.com', 'www.github.com') and len(parts) >= 2 and bool(parts[1]) and (
        parts[0].lower() in ('infovision', 'ivl') or parts[0].lower().startswith(('infovision-', 'ivl-')))
    azure = p.hostname == 'dev.azure.com' and len(parts) >= 3 and parts[0].lower() == 'infovision'
    other = p.hostname in ('infovision.visualstudio.com', 'gitlab.infovision.com') and len(parts) >= 2
    if p.scheme != 'https' or p.username or p.password or p.port not in (None, 443) or not (github or azure or other):
        raise ValueError('Use an HTTPS InfoVision corporate repository URL without credentials.')
    return value


def cloud_values(value):
    if value is None: return None
    if not value.strip(): return None
    result = []
    for token in value.split(','):
        normalized = CLOUDS.get(token.strip().lower())
        if not normalized: raise ValueError('Unsupported cloud provider. Use Azure, AWS, GCP, On-Premise, Hybrid or Multi-Cloud.')
        if normalized not in result: result.append(normalized)
    return ', '.join(result)


class MetadataRules(BaseModel):
    @field_validator('video_urls', check_fields=False)
    @classmethod
    def video_urls_value(cls, value):
        if value is None: return value
        return list(dict.fromkeys(cls.safe_url(url) for url in value))

    @field_validator('architecture_file_url', check_fields=False)
    @classmethod
    def document_urls_value(cls, value):
        if not value: return value
        if not value.lstrip().startswith('{'): return cls.safe_url(value)
        try: slots = json.loads(value)
        except ValueError as exc: raise ValueError('Invalid document reference JSON.') from exc
        for name in ('overall_architecture','sales_pitch','marketing_collateral','technical_delivery'):
            if slots.get(name):
                item = slots[name]
                cls.safe_url(item.get('url') if isinstance(item,dict) else item)
        misc=slots.get('miscellaneous',[])
        if not isinstance(misc,list): raise ValueError('Miscellaneous documents must be a list.')
        for item in misc:
            if not isinstance(item,dict) or not item.get('url'): raise ValueError('Each document requires a URL.')
            cls.safe_url(item['url'])
        return value
    @field_validator('title','description','department','family','maturity','owner_name','owner_email','manager_name','manager_email','designation','category','repo_url', check_fields=False)
    @classmethod
    def cannot_clear(cls, value):
        if value is None: raise ValueError('This required field cannot be cleared.')
        return value
    @field_validator('title', 'description', 'department', 'category', 'designation', 'owner_name', 'manager_name', check_fields=False)
    @classmethod
    def meaningful(cls, value):
        if value is not None and (not value.strip() or value.strip().lower() in ('tbd', 'unknown')):
            raise ValueError('Provide a nonblank value when updating this field.')
        return value.strip() if isinstance(value, str) else value

    @field_validator('tech_stack', check_fields=False)
    @classmethod
    def tech_values(cls, value):
        if not value or any(not item.strip() for item in value): raise ValueError('Provide at least one nonblank technology.')
        return list(dict.fromkeys(item.strip() for item in value))

    @field_validator('family', check_fields=False)
    @classmethod
    def family_value(cls, value):
        if value is None: return value
        value = value.strip().lower()
        if value not in ('forge', 'atlas', 'sentinel', 'titan'): raise ValueError('Select a valid FAST family.')
        return value.title()

    @field_validator('maturity', check_fields=False)
    @classmethod
    def maturity_value(cls, value):
        if value is None: return value
        choices = {'experimental':'Experimental', 'battle-tested':'Battle-Tested', 'production':'Production'}
        if value.strip().lower() not in choices: raise ValueError('Select Experimental, Battle-Tested or Production.')
        return choices[value.strip().lower()]

    _cloud = field_validator('cloud_provider', check_fields=False)(cloud_values)
    _repo = field_validator('repo_url', check_fields=False)(corporate_repo)

    @field_validator('owner_email', 'manager_email', check_fields=False)
    @classmethod
    def email_value(cls, value):
        if value is None: return value
        value = value.strip().lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value): raise ValueError('Provide a valid email address.')
        return value

    @field_validator('demo_url', 'video_url', check_fields=False)
    @classmethod
    def safe_url(cls, value):
        if not value: return value
        if not isinstance(value,str): raise ValueError('Document references must contain URL strings.')
        p = urlsplit(value)
        if p.scheme not in ('http','https') or not p.hostname or p.username or p.password:
            raise ValueError('Use an HTTP(S) URL without embedded credentials.')
        return value.strip()

    @model_validator(mode='after')
    def distinct_owner_manager(self):
        for fields in (('owner_email','manager_email'), ('owner_name','manager_name')):
            values = [getattr(self, f, None) for f in fields]
            if all(values) and values[0].strip().casefold() == values[1].strip().casefold():
                raise ValueError('Owner and manager must be different people.')
        manager = getattr(self, 'manager_email', None)
        if manager and not manager.endswith('@infovision.com'): raise ValueError('Manager email must use @infovision.com.')
        return self


def validate_patch_pair(entity, changes):
    """Validate changed owner/manager pairs against saved fields, without blocking unrelated legacy edits."""
    from fastapi import HTTPException
    for first, second in (('owner_email','manager_email'),('owner_name','manager_name')):
        if first not in changes and second not in changes: continue
        a, b = changes.get(first, getattr(entity, first, None)), changes.get(second, getattr(entity, second, None))
        if a and b and a.strip().casefold() == b.strip().casefold():
            raise HTTPException(status_code=422, detail='Owner and manager must be different people.')


def require_create_metadata(value):
    for field in ('title','description','family','department','maturity','owner_name','owner_email',
                  'manager_name','manager_email','designation','category','tech_stack','repo_url'):
        if not getattr(value,field,None): raise ValueError(f'{field} is required for new assets.')
    return value


def cloud_filter(column, value):
    from sqlalchemy import func, or_
    from fastapi import HTTPException
    try:
        normalized = cloud_values(value)
        if not normalized: raise ValueError('Cloud filter cannot be blank.')
        tokens = normalized.split(', ')
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    aliases = {key.replace(' ','') for key, canonical in CLOUDS.items() if canonical in tokens}
    compact = func.replace(func.lower(column), ' ', '')
    return or_(*(func.concat(',', compact, ',').like('%,' + token + ',%') for token in aliases))
