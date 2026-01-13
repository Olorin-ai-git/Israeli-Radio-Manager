"""
Report Generator Service
Generates and sends email reports for audits
"""
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


async def send_audit_report(
    report: Dict[str, Any],
    admin_emails: List[str],
    language: str = "en"
) -> bool:
    """
    Send audit report email to admins.

    Args:
        report: Audit report data
        admin_emails: List of admin email addresses
        language: Language code (en, he)

    Returns:
        True if sent successfully
    """
    try:
        from app.services.email_service import send_email
        
        # Generate email content
        subject, html_content = generate_email_content(report, language)
        
        # Send email to all admins
        for email in admin_emails:
            await send_email(
                to_email=email,
                subject=subject,
                html_content=html_content
            )
        
        logger.info(f"Audit report sent to {len(admin_emails)} admins")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send audit report: {e}")
        return False


def generate_email_content(report: Dict[str, Any], language: str = "en") -> tuple:
    """
    Generate email subject and HTML content from audit report.

    Args:
        report: Audit report data
        language: Language code (en, he)

    Returns:
        Tuple of (subject, html_content)
    """
    audit_type = report.get("audit_type", "unknown")
    summary = report.get("summary", {})
    total_items = summary.get("total_items", 0)
    issues_found = summary.get("issues_found", 0)
    issues_fixed = summary.get("issues_fixed", 0)
    
    if language == "he":
        subject = f"דוח ביקורת ספרייה - {issues_found} בעיות נמצאו"
        html_content = f"""
        <html dir="rtl">
        <body style="font-family: Arial, sans-serif; direction: rtl;">
            <h1>דוח ביקורת ספרייה</h1>
            <h2>סיכום</h2>
            <ul>
                <li>סה"כ פריטים נבדקו: {total_items}</li>
                <li>בעיות נמצאו: {issues_found}</li>
                <li>בעיות תוקנו: {issues_fixed}</li>
            </ul>
            <p>סוג ביקורת: {audit_type}</p>
        </body>
        </html>
        """
    else:
        subject = f"Library Audit Report - {issues_found} issues found"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h1>Library Audit Report</h1>
            <h2>Summary</h2>
            <ul>
                <li>Total items checked: {total_items}</li>
                <li>Issues found: {issues_found}</li>
                <li>Issues fixed: {issues_fixed}</li>
            </ul>
            <p>Audit type: {audit_type}</p>
        </body>
        </html>
        """
    
    return (subject, html_content)
