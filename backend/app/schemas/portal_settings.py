from pydantic import BaseModel, Field
from typing import Optional


class WhyPillar(BaseModel):
    num: str = ""
    icon: str = ""
    color: str = "#0066cc"
    title: str = ""
    body: str = ""
    bullets: list[str] = Field(default_factory=list)
    footer: str = ""


class WhyBenefit(BaseModel):
    icon_key: str = ""  # maps to a lucide icon name on the frontend
    title: str = ""
    body: str = ""


class WhyClosing(BaseModel):
    heading: str = ""
    body1: str = ""
    body2: str = ""
    quote: str = ""


class WhyContent(BaseModel):
    executive_summary: str = ""
    pillars_heading: str = ""
    pillars_subheading: str = ""
    pillars: list[WhyPillar] = Field(default_factory=list)
    chips: list[str] = Field(default_factory=list)
    outcomes_heading: str = ""
    outcomes_body: str = ""
    benefits_heading: str = ""
    benefits: list[WhyBenefit] = Field(default_factory=list)
    closing: WhyClosing = Field(default_factory=WhyClosing)


class FamilyContent(BaseModel):
    id: str
    name: str
    tagline: str = ""
    description: str = ""
    summary: str = ""
    long_description: str = ""
    key_assets: list[str] = Field(default_factory=list)
    color: str = "#64748B"
    department: str = ""
    use_cases: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    enables: list[str] = Field(default_factory=list)


class PageBanner(BaseModel):
    title: str = ""
    subtitle: str = ""


class PortalContent(BaseModel):
    aiv_portal_name: str = "AIV Intelligence Portal"
    aiv_portal_description: str = "Access InfoVision's AI intelligence hub for insights, tools, and resources"
    aiv_portal_url: str = "https://aivportal.infovision.ai/"
    banners: dict[str, PageBanner] = Field(default_factory=dict)
    families: list[FamilyContent]
    family_order: list[str] = Field(default_factory=lambda: ["Atlas", "Forge", "Titan", "Sentinel"])
    why: Optional[WhyContent] = Field(default=None)
