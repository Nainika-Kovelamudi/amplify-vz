"""consolidate Relay and Nexus into Titan and refresh FAST definitions

Revision ID: 029
Revises: 028
"""
import json
from alembic import op
import sqlalchemy as sa

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None

DEFINITIONS = (
    ("Forge", "AI Engineering & Development", "Forge builds, engineers and operationalizes AI solutions from idea to production.", "FORGE is the AI engineering and development family within AIMPLIFY, enabling organizations to design, build, test, deploy and continuously improve AI-powered solutions. It provides the engineering capabilities required across the AI Software Development Lifecycle, from experimentation and prototyping through production deployment and evolution.", ["AI Engineering", "AI Development", "AI SDLC", "GenAI", "Agentic AI", "AI Applications"], "#8B5CF6", "ai_sdlc"),
    ("Atlas", "AI Foundation & Platform", "ATLAS provides the data, models, knowledge, platform and infrastructure that power enterprise AI.", "ATLAS is the foundational layer of AIMPLIFY, providing the technology ecosystem required to build and operate enterprise AI at scale. It brings together AI infrastructure, data, models, knowledge, compute, platforms and reusable services into a scalable and composable AI foundation.", ["AI Foundation", "Data", "Models", "Knowledge", "Platform", "Infrastructure"], "#3B82F6", "dataops"),
    ("Sentinel", "AI Security, Risk & Governance", "SENTINEL secures, governs, monitors and assures AI across its entire lifecycle.", "SENTINEL is AIMPLIFY's AI Trust, Security and Governance family, designed to protect AI systems from emerging threats while ensuring responsible, compliant and controlled AI adoption. It provides continuous security, risk management, governance, guardrails and observability across models, agents, applications and AI workflows.", ["AI Security", "Red Team", "Guardrails", "Observability", "Risk", "Compliance", "Governance"], "#EF4444", "security"),
    ("Titan", "Agentic Automation & Functional AI", "TITAN puts AI to work through intelligent agents, automated workflows and AI-powered business operations.", "TITAN is the execution and business-value layer of AIMPLIFY. It transforms AI capabilities into autonomous and semi-autonomous digital workers that can reason, make decisions, orchestrate workflows and execute business processes across enterprise systems.", ["Agents", "Workflows", "Process Automation", "Functional AI", "Digital Workers", "Business Operations"], "#0EA5E9", "enterprise_ai"),
)


def upgrade() -> None:
    op.execute("UPDATE catalog_assets SET family = 'Titan' WHERE LOWER(TRIM(family)) IN ('relay', 'nexus')")
    op.execute("UPDATE submissions SET family = 'Titan' WHERE LOWER(TRIM(family)) IN ('relay', 'nexus')")

    bind = op.get_bind()
    raw = bind.execute(sa.text("SELECT value FROM portal_settings WHERE key = 'portal_content'")).scalar()
    if raw:
        content = json.loads(raw) if isinstance(raw, str) else dict(raw)
        existing = {item.get("id"): item for item in content.get("families", [])}
        families = []
        for family_id, specialization, summary, narrative, key_assets, color, department in DEFINITIONS:
            item = existing.get(family_id, {})
            families.append({
                **item,
                "id": family_id,
                "name": family_id,
                "tagline": specialization,
                "description": specialization,
                "summary": summary,
                "long_description": narrative,
                "key_assets": key_assets,
                "color": item.get("color", color),
                "department": item.get("department", department),
                "use_cases": item.get("use_cases", []),
                "depends_on": item.get("depends_on", []),
                "enables": item.get("enables", []),
            })
        content["families"] = families
        bind.execute(sa.text("UPDATE portal_settings SET value = CAST(:value AS JSON) WHERE key = 'portal_content'"), {"value": json.dumps(content)})


def downgrade() -> None:
    # Consolidation cannot be safely reversed because original and native Titan
    # records are indistinguishable after migration.
    pass
