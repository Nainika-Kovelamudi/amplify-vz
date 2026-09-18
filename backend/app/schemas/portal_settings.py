from pydantic import BaseModel, Field


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
