import re
from datetime import datetime
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, ConfigDict, Field, field_validator
from uuid import UUID


class MeetingInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    title:str=Field(default='',max_length=200)
    customer_name:str=Field(default='',max_length=200)
    project_name:str=Field(default='',max_length=200)
    vertical:str=Field(default='',max_length=100)
    requirements:str=Field(default='',max_length=5000)
    agenda:str=Field(default='',max_length=5000)
    starts_at:datetime | None=None
    duration_minutes:int=Field(default=60,ge=15,le=480)
    timezone:str=Field(default='UTC',max_length=100)
    attendees:list[str]=Field(default_factory=list,max_length=100)
    location:str=Field(default='',max_length=300)
    meeting_url:str=Field(default='',max_length=1000)
    platform_demo:bool=False
    asset_ids:list[UUID]=Field(default_factory=list,max_length=100)

    @field_validator('title','customer_name','project_name','vertical','requirements','agenda','location','meeting_url')
    @classmethod
    def trim(cls,v):return v.strip()

    @field_validator('starts_at')
    @classmethod
    def aware(cls,v):
        if v and (v.tzinfo is None or v.utcoffset() is None):raise ValueError('Meeting time must include a timezone offset.')
        return v

    @field_validator('timezone')
    @classmethod
    def zone(cls,v):
        try:ZoneInfo(v)
        except (ZoneInfoNotFoundError,ValueError):raise ValueError('Select a valid IANA timezone.')
        return v

    @field_validator('attendees')
    @classmethod
    def emails(cls,values):
        values=list(dict.fromkeys(v.strip().lower() for v in values))
        if any(not re.fullmatch(r'[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+',v) for v in values):raise ValueError('Provide valid attendee email addresses.')
        return values

    @field_validator('meeting_url')
    @classmethod
    def url(cls,v):
        if v:
            p=urlsplit(v)
            if p.scheme!='https' or not p.hostname or p.username or p.password:raise ValueError('Meeting link must use HTTPS without embedded credentials.')
        return v


class MeetingUpdate(MeetingInput):
    expected_revision:int=Field(ge=1)


class MeetingAction(BaseModel):
    model_config=ConfigDict(extra='forbid')
    expected_revision:int=Field(ge=1)
    confirmed:bool
    attendees_fingerprint:str | None=Field(default=None,max_length=64)


class PlannerChatRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    expected_revision:int=Field(ge=1)
    request_id:UUID
    message:str=Field(min_length=1,max_length=2000)

    @field_validator('message')
    @classmethod
    def nonempty(cls,value):
        if not value.strip():raise ValueError('Enter a question for the planner.')
        return value.strip()


class MeetingScheduleUpdate(BaseModel):
    """Scheduling may change after submission; asset/request fields remain immutable."""
    model_config=ConfigDict(extra='forbid')
    expected_revision:int=Field(ge=1)
    title:str | None=Field(default=None,max_length=200)
    requirements:str | None=Field(default=None,max_length=5000)
    asset_ids:list[UUID] | None=Field(default=None,max_length=100)
    starts_at:datetime
    duration_minutes:int=Field(default=60,ge=15,le=480)
    timezone:str=Field(default='UTC',max_length=100)
    attendees:list[str]=Field(default_factory=list,max_length=100)
    agenda:str=Field(default='',max_length=5000)
    location:str=Field(default='',max_length=300)
    meeting_url:str=Field(default='',max_length=1000)

    @field_validator('starts_at')
    @classmethod
    def aware(cls,v):return MeetingInput.aware(v)

    @field_validator('timezone')
    @classmethod
    def zone(cls,v):return MeetingInput.zone(v)

    @field_validator('attendees')
    @classmethod
    def emails(cls,v):return MeetingInput.emails(v)

    @field_validator('agenda','location','meeting_url')
    @classmethod
    def trim(cls,v):return v.strip()

    @field_validator('meeting_url')
    @classmethod
    def url(cls,v):return MeetingInput.url(v)


class StandaloneMeetingInput(MeetingInput):
    title:str=Field(min_length=1,max_length=200)
    starts_at:datetime
