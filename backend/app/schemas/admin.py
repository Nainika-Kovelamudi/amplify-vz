from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class AdminStatsResponse(BaseModel):
    pending_approvals: int   # Manual_Approval — awaiting admin review
    awaiting_publish: int    # Approved — awaiting owner to publish
    published_assets: int
    pending_clones: int
    total_users: int


class ApprovalActionRequest(BaseModel):
    notes: Optional[str] = None


class ExecutiveSummary(BaseModel):
    total_assets: int
    published_assets: int
    awaiting_review: int
    l1_waiting_approval: int
    l2_waiting_approval: int
    new_submissions: int
    ai_passed: int
    ai_needs_changes: int
    ai_failures: int
    approved: int
    published: int
    rejected: int
    pending_approvals: int
    awaiting_publish: int
    on_hold: int
    average_ai_score: float
    ai_pass_rate: float
    approval_rate: float
    publication_rate: float
    average_review_hours: float
    oldest_pending_hours: float


class ReportTrendPoint(BaseModel):
    date: date
    submitted: int = 0
    approved: int = 0
    published: int = 0
    needs_changes: int = 0


class ReportBreakdown(BaseModel):
    name: str
    submitted: int
    approved: int
    published: int
    average_ai_score: float


class ExecutiveEngagement(BaseModel):
    catalog_views: int
    artifact_downloads: int
    demo_views: int
    clone_requests: int
    demo_requests: int
    active_users: int


class ExecutiveFamilyMetric(BaseModel):
    name: str
    asset_count: int
    percentage: float


class ExecutiveEventMetric(BaseModel):
    key: str
    label: str
    count: int


class ExecutiveTrendingAsset(BaseModel):
    id: str
    slug: str
    title: str
    family: str
    views: int
    downloads: int
    clone_requests: int
    demo_requests: int
    engagement_score: int


class ExecutiveActiveUser(BaseModel):
    user_id: str
    name: str
    email: str
    events: int
    last_active: datetime


class ExecutiveReportResponse(BaseModel):
    generated_at: datetime
    period_start: datetime
    period_end: datetime
    days: int
    summary: ExecutiveSummary
    status_funnel: dict[str, int]
    daily_trend: list[ReportTrendPoint]
    departments: list[ReportBreakdown]
    families: list[ReportBreakdown]
    engagement: ExecutiveEngagement
    family_assets: list[ExecutiveFamilyMetric]
    top_events: list[ExecutiveEventMetric]
    trending_assets: list[ExecutiveTrendingAsset]
    active_users: list[ExecutiveActiveUser]
