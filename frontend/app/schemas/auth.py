from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AzureTokenRequest(BaseModel):
    azure_token: str


class AppJWTResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 86400  # 24 hours in seconds


class UserMeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: Optional[str] = None
    role: str
    department: Optional[str] = None
    last_login: Optional[datetime] = None
