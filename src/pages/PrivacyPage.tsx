import { Link } from 'react-router-dom';
import { Radio, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Radio className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">CitiSignal</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground">Data We Collect</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">Account information:</strong> email, name, phone, company name</li>
              <li><strong className="text-foreground">Property information:</strong> addresses, BIN/BBL, building characteristics</li>
              <li><strong className="text-foreground">Uploaded documents:</strong> leases, insurance certificates, and other files you upload (including extracted text content)</li>
              <li><strong className="text-foreground">Tenant information:</strong> names, contact details, lease terms you enter</li>
              <li><strong className="text-foreground">Usage data:</strong> queries, AI conversations, sync activity</li>
              <li><strong className="text-foreground">Messaging data:</strong> Telegram chat ID for bot integration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>To query NYC Open Data APIs on your behalf (violation lookups, permit checks, property data enrichment)</li>
              <li>To power AI-assisted property intelligence (lease Q&A, damage assessment, compliance analysis) via Google Gemini</li>
              <li>To send violation alerts, compliance reminders, and daily summaries via email and Telegram</li>
              <li>To calculate Local Law compliance obligations based on property characteristics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Data Storage & Security</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Data is stored with row-level security policies enforcing per-user isolation</li>
              <li>All API communications use HTTPS encryption</li>
              <li>We do not store payment information directly</li>
              <li>Backend functions run in isolated serverless environments</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Third-Party Services</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Cloud database and authentication infrastructure</li>
              <li>Google Gemini (AI processing — property queries, lease analysis, document extraction)</li>
              <li>Telegram Bot API (messaging integration)</li>
              <li>NYC Open Data / Socrata (public violation and building data)</li>
              <li>Resend (transactional email)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">What We Don't Do</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>We do not sell your data to third parties</li>
              <li>We do not use your data for advertising</li>
              <li>We do not share tenant PII with other users outside your organization</li>
              <li>We do not provide legal advice — compliance information is for informational purposes only</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Data Retention</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Account data is retained while your account is active</li>
              <li>You can request deletion of your account and all associated data by contacting support@citisignal.com</li>
              <li>API call logs are retained for 90 days for debugging purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Contact</h2>
            <p className="text-muted-foreground">
              For questions about this privacy policy or your data, contact us at{' '}
              <a href="mailto:support@citisignal.com" className="text-primary hover:underline">support@citisignal.com</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
