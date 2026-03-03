import html2pdf from 'html2pdf.js';
import { format } from 'date-fns';

interface NoticeParams {
  tenantName: string;
  contactName: string | null;
  unitNumber: string | null;
  propertyAddress: string;
  violationNumber: string;
  agency: string;
  issuedDate: string;
  description: string | null;
}

export const generateViolationNoticePDF = async (params: NoticeParams) => {
  const today = format(new Date(), 'MMMM d, yyyy');
  const issued = format(new Date(params.issuedDate), 'MMMM d, yyyy');

  const html = `
    <div style="font-family: 'Times New Roman', serif; padding: 40px; color: #111; max-width: 700px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 32px; border-bottom: 2px solid #111; padding-bottom: 16px;">
        <h1 style="font-size: 20px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Notice of Violation</h1>
        <p style="font-size: 12px; color: #555; margin-top: 4px;">Property Management Notice</p>
      </div>

      <div style="margin-bottom: 24px; font-size: 13px; line-height: 1.6;">
        <p><strong>Date:</strong> ${today}</p>
        <p><strong>To:</strong> ${params.contactName || params.tenantName}</p>
        <p><strong>Company:</strong> ${params.tenantName}</p>
        ${params.unitNumber ? `<p><strong>Unit/Suite:</strong> ${params.unitNumber}</p>` : ''}
        <p><strong>Property:</strong> ${params.propertyAddress}</p>
      </div>

      <div style="margin-bottom: 24px; font-size: 13px; line-height: 1.8;">
        <p>Dear ${params.contactName || 'Tenant'},</p>
        <p style="margin-top: 12px;">
          This letter is to formally notify you that a violation has been issued by the 
          <strong>${params.agency}</strong> affecting the premises located at 
          <strong>${params.propertyAddress}</strong>${params.unitNumber ? `, Unit ${params.unitNumber}` : ''}.
        </p>
      </div>

      <div style="margin-bottom: 24px; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; padding: 16px;">
        <h3 style="font-size: 14px; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px; color: #333;">Violation Details</h3>
        <table style="font-size: 13px; line-height: 1.6; width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666; width: 140px;">Violation Number:</td><td style="padding: 4px 0; font-weight: bold;">${params.violationNumber}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Issuing Agency:</td><td style="padding: 4px 0;">${params.agency}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Date Issued:</td><td style="padding: 4px 0;">${issued}</td></tr>
          ${params.description ? `<tr><td style="padding: 4px 12px 4px 0; color: #666; vertical-align: top;">Description:</td><td style="padding: 4px 0;">${params.description}</td></tr>` : ''}
        </table>
      </div>

      <div style="margin-bottom: 24px; font-size: 13px; line-height: 1.8;">
        <p>
          As a tenant, you are hereby notified of this violation and may be required to take corrective action 
          as specified in your lease agreement. Please review the violation details and contact property management 
          immediately to discuss resolution steps.
        </p>
        <p style="margin-top: 12px;">
          Failure to address this matter promptly may result in additional penalties, fines, or other enforcement 
          actions by the issuing agency. Your cooperation in resolving this matter is appreciated.
        </p>
      </div>

      <div style="margin-top: 48px; font-size: 13px; line-height: 1.6;">
        <p>Sincerely,</p>
        <div style="margin-top: 40px; border-top: 1px solid #999; width: 250px; padding-top: 4px;">
          <p style="margin: 0; font-size: 12px; color: #666;">Property Management</p>
        </div>
      </div>

      <div style="margin-top: 48px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #999; text-align: center;">
        <p>This notice was generated on ${today}. Please retain this document for your records.</p>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await html2pdf()
      .set({
        margin: [0.5, 0.5],
        filename: `Violation-Notice-${params.violationNumber}-${params.tenantName.replace(/\s+/g, '-')}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
};
