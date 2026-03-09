export function emailHeader(subtitle: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
        <td style="background:#334155;border-radius:10px;padding:8px;vertical-align:middle;width:40px;height:40px;text-align:center;">
          <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNC45IDE5LjFDMSAxNS4yIDEgOC44IDQuOSA0LjkiPjwvcGF0aD48cGF0aCBkPSJNNy44IDE2LjJjLTIuMy0yLjMtMi4zLTYuMSAwLTguNSI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi4yIDcuOGMyLjMgMi4zIDIuMyA2LjEgMCA4LjUiPjwvcGF0aD48cGF0aCBkPSJNMTkuMSA0LjljMy45IDMuOSAzLjkgMTAuMiAwIDE0LjEiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIyIj48L2NpcmNsZT48L3N2Zz4K" alt="CitiSignal" style="width:24px;height:24px;display:block;margin:0 auto;" />
        </td>
        <td style="padding-left:12px;vertical-align:middle;"><span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">CitiSignal</span></td>
      </tr></table>
      <div style="color:#94a3b8;font-size:13px;margin-top:4px;">${subtitle}</div>
    </div>`;
}

export function emailBody(content: string): string {
  return `
    <div style="background:#ffffff;padding:28px 32px;border:1px solid #e2e8f0;border-top:0;">
      ${content}
    </div>`;
}

export function emailFooter(options?: { showGLE?: boolean; showPreferences?: boolean; appUrl?: string }): string {
  const { showGLE = false, showPreferences = false, appUrl = "https://app.citisignal.com" } = options || {};

  const gleBlock = showGLE ? `
    <div style="background:linear-gradient(135deg,#fef3c7,#fff7ed);padding:28px 32px;text-align:center;border:1px solid #fde68a;border-top:0;">
      <p style="color:#92400e;font-size:16px;font-weight:700;margin:0 0 8px 0;">Need help with compliance?</p>
      <p style="color:#78350f;font-size:13px;margin:0 0 16px 0;line-height:1.5;">
        Green Light Expediting LLC specializes in NYC DOB violations, permits, and code compliance.
      </p>
      <a href="mailto:info@greenlightexpediting.com?subject=Compliance%20Help" style="display:inline-block;background:#ea580c;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
        ✉️ Contact Green Light Expediting
      </a>
      <p style="color:#b45309;font-size:11px;margin:12px 0 0;">
        Green Light Expediting LLC · <a href="https://www.greenlightexpediting.com" style="color:#b45309;text-decoration:underline;">www.greenlightexpediting.com</a>
      </p>
    </div>` : '';

  const prefsLink = showPreferences
    ? `<p style="color:#94a3b8;font-size:12px;margin:0 0 8px 0;">
        <a href="${appUrl}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Manage preferences</a>
        &nbsp;·&nbsp;
        <a href="${appUrl}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
      </p>`
    : '';

  return `
    ${gleBlock}
    <div style="padding:20px 32px;text-align:center;border-radius:0 0 16px 16px;background:#ffffff;border:1px solid #e2e8f0;border-top:0;">
      ${prefsLink}
      <p style="color:#cbd5e1;font-size:11px;margin:0;">© ${new Date().getFullYear()} CitiSignal. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}
