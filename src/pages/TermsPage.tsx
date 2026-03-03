import { Link } from 'react-router-dom';
import { Radio, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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

        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground">Service Description</h2>
            <p className="text-muted-foreground">
              CitiSignal is a property compliance monitoring platform that aggregates publicly available NYC violation data and provides AI-powered analysis tools for property owners, managers, and expeditors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Not Legal Advice</h2>
            <p className="text-muted-foreground">
              CitiSignal provides compliance information, not legal advice. AI-generated analysis of leases, violations, and compliance requirements is for informational purposes only. Always consult a licensed attorney or expeditor for legal matters.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Data Accuracy</h2>
            <p className="text-muted-foreground">
              Violation data is sourced from NYC Open Data and may have delays. CitiSignal is not responsible for data accuracy from city sources. Users should verify critical compliance deadlines independently.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Account Responsibility</h2>
            <p className="text-muted-foreground">
              Users are responsible for the accuracy of property and tenant information they enter. Users must not share invite codes or account access with unauthorized parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Acceptable Use</h2>
            <p className="text-muted-foreground">
              The service is intended for legitimate property management purposes only. Automated scraping, bulk data extraction, or redistribution of data is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Intellectual Property</h2>
            <p className="text-muted-foreground">
              CitiSignal's compliance engine, UI, and AI prompts are proprietary. NYC Open Data and publicly available city records remain in the public domain.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Limitation of Liability</h2>
            <p className="text-muted-foreground">
              CitiSignal is not liable for missed deadlines, penalties, or fines resulting from reliance on the platform's data or analysis. The service is provided "as is" without warranties of any kind.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Termination</h2>
            <p className="text-muted-foreground">
              We reserve the right to terminate accounts that violate these terms. Users may delete their account at any time by contacting{' '}
              <a href="mailto:support@citisignal.com" className="text-primary hover:underline">support@citisignal.com</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
