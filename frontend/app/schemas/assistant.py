from pydantic import BaseModel, Field, field_validator


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatTurn] = Field(default_factory=list)

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        if len(v) > 2000:
            raise ValueError("Message must be under 2000 characters")
        return v


class ChatSource(BaseModel):
    title: str
    link: str
    source_type: str | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]
    is_confident: bool
