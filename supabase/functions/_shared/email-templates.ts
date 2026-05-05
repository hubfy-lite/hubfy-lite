// Shared email HTML template builders
// Maintains consistent visual identity across all Hubfy emails.
//
// Design system:
//   - White background, max-width 600px
//   - Font: system stack (-apple-system, …)
//   - Dark text #1a1a1a, muted #999999
//   - CTA button: bg #1a1a1a, text white, rounded-full
//   - Divider: #eeeeee

import {
  type EmailLanguage,
  type EmailTranslations,
  getEmailTranslations,
} from "./email-i18n.ts";
import { resolvePublicSiteUrl } from "./site-url.ts";

/* ─── Style constants ─── */

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const COLOR_TEXT = "#1a1a1a";
const COLOR_MUTED = "#999999";
const COLOR_DIVIDER = "#eeeeee";
const COLOR_BTN_BG = "#1a1a1a";
const COLOR_BTN_TEXT = "#ffffff";

/* ─── Shared HTML shell ─── */

function emailShell(title: string, innerHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: ${FONT_STACK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
${innerHtml}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ─── Reusable blocks ─── */

function greetingBlock(text: string): string {
  return `        <p style="font-size: 16px; font-weight: 700; color: ${COLOR_TEXT}; margin: 0 0 12px 0;">${text}</p>`;
}

function paragraphBlock(text: string, marginBottom = "24px"): string {
  return `        <p style="font-size: 16px; color: ${COLOR_TEXT}; margin: 0 0 ${marginBottom}; line-height: 1.5;">${text}</p>`;
}

function ctaButton(href: string, label: string): string {
  return `        <a href="${href}" target="_blank" style="display: inline-block; background-color: ${COLOR_BTN_BG}; color: ${COLOR_BTN_TEXT}; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 9999px; margin: 0 0 32px 0;">${label}</a>`;
}

function mutedText(text: string, marginBottom = "8px"): string {
  return `        <p style="font-size: 14px; color: ${COLOR_MUTED}; margin: 0 0 ${marginBottom}; line-height: 1.5;">${text}</p>`;
}

function divider(): string {
  return `        <hr style="border: none; border-top: 1px solid ${COLOR_DIVIDER}; margin: 0 0 24px 0;">`;
}

function hubfyFooter(): string {
  const siteUrl = resolvePublicSiteUrl(null);
  return `        <p style="font-size: 16px; font-weight: 700; color: ${COLOR_TEXT}; margin: 0;">
          <a href="${siteUrl}" style="text-decoration: none; color: ${COLOR_TEXT};">Hubfy</a>
        </p>`;
}

function tenantFooter(
  tenantName: string,
  viaLabel: string,
): string {
  const siteUrl = resolvePublicSiteUrl(null);
  return `        <p style="font-size: 16px; font-weight: 700; color: ${COLOR_TEXT}; margin: 0;">
          ${tenantName} <span style="font-weight: 400; color: ${COLOR_MUTED}; font-size: 14px;">${viaLabel}</span> <a href="${siteUrl}" style="text-decoration: none; color: ${COLOR_TEXT};">Hubfy</a>
        </p>`;
}

function poweredByFooter(label: string): string {
  const siteUrl = resolvePublicSiteUrl(null);
  return `        <p style="font-size: 13px; font-weight: 400; color: #b0b0b0; margin: 0;">
          ${label} <a href="${siteUrl}" style="text-decoration: none; color: #b0b0b0; font-weight: 700;">Hubfy</a>
        </p>`;
}

export function logoBlock(
  logoUrl: string | null,
  name: string,
): string {
  if (logoUrl) {
    return `        <img src="${logoUrl}" alt="${name}" width="48" height="48" style="display: block; width: 48px; height: 48px; border-radius: 8px; object-fit: cover; background-color: #f5f5f5; margin: 0 0 24px 0;" />`;
  }
  return `        <p style="font-size: 18px; font-weight: 600; color: ${COLOR_TEXT}; margin-bottom: 24px;">${name}</p>`;
}

/* ═══════════════════════════════════════════
   AUTH EMAILS (Hubfy branding)
   ═══════════════════════════════════════════ */

export function buildSignupConfirmationEmail(
  lang: EmailLanguage,
  name: string,
  confirmUrl: string,
): string {
  const t = getEmailTranslations(lang);
  const inner = [
    greetingBlock(t.common.greeting(name)),
    paragraphBlock(t.signup.body),
    ctaButton(confirmUrl, t.signup.cta),
    mutedText(t.common.expiry24h),
    mutedText(t.common.ignore, "48px"),
    divider(),
    hubfyFooter(),
  ].join("\n\n");
  return emailShell(t.signup.subject, inner);
}

export function buildRecoveryEmail(
  lang: EmailLanguage,
  name: string,
  resetUrl: string,
): string {
  const t = getEmailTranslations(lang);
  const inner = [
    greetingBlock(t.common.greeting(name)),
    paragraphBlock(t.recovery.body),
    ctaButton(resetUrl, t.recovery.cta),
    mutedText(t.common.expiry24h),
    mutedText(t.common.ignore, "48px"),
    divider(),
    hubfyFooter(),
  ].join("\n\n");
  return emailShell(t.recovery.subject, inner);
}

export function buildEmailChangeEmail(
  lang: EmailLanguage,
  name: string,
  confirmUrl: string,
): string {
  const t = getEmailTranslations(lang);
  const inner = [
    greetingBlock(t.common.greeting(name)),
    paragraphBlock(t.emailChange.body),
    ctaButton(confirmUrl, t.emailChange.cta),
    mutedText(t.common.expiry24h),
    mutedText(t.common.ignore, "48px"),
    divider(),
    hubfyFooter(),
  ].join("\n\n");
  return emailShell(t.emailChange.subject, inner);
}

export function buildMagicLinkEmail(
  lang: EmailLanguage,
  name: string,
  magicUrl: string,
): string {
  const t = getEmailTranslations(lang);
  const inner = [
    greetingBlock(t.common.greeting(name)),
    paragraphBlock(t.magicLink.body),
    ctaButton(magicUrl, t.magicLink.cta),
    mutedText(t.common.expiry24h),
    mutedText(t.common.ignore, "48px"),
    divider(),
    hubfyFooter(),
  ].join("\n\n");
  return emailShell(t.magicLink.subject, inner);
}

/* ═══════════════════════════════════════════
   TEAM EMAILS (Hubfy branding — no tenant logo)
   ═══════════════════════════════════════════ */

export function buildTeamInviteEmail(
  lang: EmailLanguage,
  memberName: string,
  tenantName: string,
  inviteLink: string,
  role: "owner" | "editor",
): string {
  const t = getEmailTranslations(lang);
  const roleLabel = role === "owner" ? t.teamInvite.roleAdmin : t.teamInvite.roleEditor;
  const inner = [
    greetingBlock(t.common.greeting(memberName)),
    paragraphBlock(t.teamInvite.body(roleLabel, tenantName)),
    ctaButton(inviteLink, t.teamInvite.cta),
    mutedText(t.common.ignore, "48px"),
    divider(),
    hubfyFooter(),
  ].join("\n\n");
  return emailShell(t.teamInvite.subject(tenantName), inner);
}

export function buildTeamAccessEmail(
  lang: EmailLanguage,
  memberName: string,
  tenantName: string,
  loginLink: string,
  role: "owner" | "editor",
): string {
  const t = getEmailTranslations(lang);
  const roleLabel = role === "owner" ? t.teamAccess.roleAdmin : t.teamAccess.roleEditor;
  const inner = [
    greetingBlock(t.common.greeting(memberName)),
    paragraphBlock(t.teamAccess.body(roleLabel, tenantName)),
    ctaButton(loginLink, t.teamAccess.cta),
    mutedText(t.common.ignore, "48px"),
    divider(),
    hubfyFooter(),
  ].join("\n\n");
  return emailShell(t.teamAccess.subject(tenantName), inner);
}

/* ═══════════════════════════════════════════
   CREATOR UPGRADE EMAIL (Hubfy branding)
   ═══════════════════════════════════════════ */

export function buildCreatorWelcomeEmail(
  lang: EmailLanguage,
  name: string,
  accessUrl: string,
): string {
  const t = getEmailTranslations(lang);
  const inner = [
    greetingBlock(t.common.greeting(name)),
    paragraphBlock(t.creatorWelcome.body),
    ctaButton(accessUrl, t.creatorWelcome.cta),
    mutedText(t.common.expiry24h),
    mutedText(t.common.ignore, "48px"),
    divider(),
    hubfyFooter(),
  ].join("\n\n");
  return emailShell(t.creatorWelcome.subject, inner);
}

/* ═══════════════════════════════════════════
   CUSTOMER EMAILS (Tenant branding)
   ═══════════════════════════════════════════ */

export function buildCustomerInviteEmail(
  lang: EmailLanguage,
  customerName: string,
  tenantName: string,
  tenantLogoUrl: string | null,
  inviteLink: string,
): string {
  const t = getEmailTranslations(lang);
  const inner = [
    logoBlock(tenantLogoUrl, tenantName),
    greetingBlock(t.common.greeting(customerName)),
    paragraphBlock(t.customerInvite.body(tenantName), "12px"),
    paragraphBlock(t.customerInvite.body2),
    ctaButton(inviteLink, t.customerInvite.cta),
    mutedText(t.common.ignore, "48px"),
    divider(),
    tenantFooter(tenantName, t.common.via),
  ].join("\n\n");
  return emailShell(t.customerInvite.subject(tenantName), inner);
}

export function buildCustomerAccessEmail(
  lang: EmailLanguage,
  customerName: string,
  tenantName: string,
  tenantLogoUrl: string | null,
  loginLink: string,
): string {
  const t = getEmailTranslations(lang);
  const inner = [
    logoBlock(tenantLogoUrl, tenantName),
    greetingBlock(t.common.greeting(customerName)),
    paragraphBlock(t.customerAccess.body(tenantName), "12px"),
    paragraphBlock(t.customerAccess.body2),
    ctaButton(loginLink, t.customerAccess.cta),
    mutedText(t.common.ignore, "48px"),
    divider(),
    tenantFooter(tenantName, t.common.via),
  ].join("\n\n");
  return emailShell(t.customerAccess.subject(tenantName), inner);
}

export function buildPortalAccessEmail(
  lang: EmailLanguage,
  customerName: string,
  tenantName: string,
  tenantLogoUrl: string | null,
  actionLink: string,
  portalLoginUrl: string,
): string {
  const t = getEmailTranslations(lang);
  const inner = [
    logoBlock(tenantLogoUrl, tenantName),
    greetingBlock(t.common.greeting(customerName)),
    paragraphBlock(t.portalAccess.body(tenantName)),
    ctaButton(actionLink, t.portalAccess.cta),
    mutedText(t.portalAccess.expiryNote),
    mutedText(t.portalAccess.expiredLink(portalLoginUrl)),
    mutedText(t.portalAccess.ignoreNote, "48px"),
    divider(),
    poweredByFooter(t.common.poweredBy),
  ].join("\n\n");
  return emailShell(t.portalAccess.subject(tenantName), inner);
}
