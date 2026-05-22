"""Public access-request form: sends email via SMTP (no auth)."""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..config import settings

router = APIRouter(tags=["public"])
logger = logging.getLogger("app.access_requests")


class AccessRequestIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=254)
    organization: str = Field(..., min_length=1, max_length=200)
    message: str = Field(default="", max_length=5000)
    # Honeypot: must stay empty; bots often fill hidden fields.
    website: str = Field(default="", max_length=500)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or v.count("@") != 1:
            raise ValueError("Invalid email address")
        local, _, domain = v.partition("@")
        if not local or not domain or "." not in domain:
            raise ValueError("Invalid email address")
        return v


class AccessRequestOut(BaseModel):
    ok: bool = True


def _smtp_configured() -> bool:
    return bool(
        settings.smtp_host.strip()
        and settings.smtp_from.strip()
        and settings.access_request_email_to.strip()
    )


def _send_access_request_email(*, name: str, email: str, organization: str, message: str) -> None:
    to_addrs = [a.strip() for a in settings.access_request_email_to.split(",") if a.strip()]
    if not to_addrs:
        raise HTTPException(status_code=503, detail="Access request email is not configured.")

    body_lines = [
        f"Name: {name}",
        f"Email: {email}",
        f"Organization: {organization}",
        "",
        "Message:",
        message if message.strip() else "(none)",
    ]
    text = "\n".join(body_lines)

    msg = EmailMessage()
    msg["Subject"] = f"[Solvency Dashboard] Access request from {name}"
    msg["From"] = settings.smtp_from.strip()
    msg["To"] = ", ".join(to_addrs)
    msg["Reply-To"] = email
    msg.set_content(text)

    host = settings.smtp_host.strip()
    port = int(settings.smtp_port)
    user = settings.smtp_user.strip()
    password = settings.smtp_password

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=30) as smtp:
                if user:
                    smtp.login(user, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as smtp:
                smtp.ehlo()
                if smtp.has_extn("starttls"):
                    smtp.starttls()
                    smtp.ehlo()
                if user:
                    smtp.login(user, password)
                smtp.send_message(msg)
    except OSError as e:
        logger.exception("SMTP send failed (network): %s", e)
        raise HTTPException(status_code=503, detail="Could not send email. Try again later.") from e
    except smtplib.SMTPException as e:
        logger.exception("SMTP send failed: %s", e)
        raise HTTPException(status_code=503, detail="Could not send email. Try again later.") from e


@router.post("/access-request", response_model=AccessRequestOut)
def submit_access_request(body: AccessRequestIn) -> AccessRequestOut:
    if body.website.strip():
        logger.info("Access request honeypot triggered; discarding.")
        return AccessRequestOut(ok=True)

    if not _smtp_configured():
        logger.warning("Access request submitted but SMTP is not fully configured.")
        raise HTTPException(
            status_code=503,
            detail="Access requests are not available (email not configured on server).",
        )

    _send_access_request_email(
        name=body.name.strip(),
        email=body.email,
        organization=body.organization.strip(),
        message=body.message.strip(),
    )
    return AccessRequestOut(ok=True)
