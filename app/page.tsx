import { BarChart3, CheckCircle2, Globe, Zap } from "lucide-react";
import { UrlSubmitForm } from "@/components/url-submit-form";

const FEATURES = [
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Comprehensive scoring",
    desc: "Six categories: Technical, On-Page, Local, Schema, AEO, and Content.",
  },
  {
    icon: <CheckCircle2 className="h-5 w-5" />,
    title: "Actionable recommendations",
    desc: "Step-by-step fixes with effort and impact ratings so you know what to do first.",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Quick wins",
    desc: "Instantly surfaces high-impact, low-effort improvements.",
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: "Local SEO & AEO",
    desc: "Checks NAP signals, LocalBusiness schema, question headings, and direct-answer patterns.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="font-bold tracking-tight">SEO Audit</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16 space-y-16">
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Deterministic SEO audits,
            <br className="hidden md:block" />
            <span className="text-primary"> in seconds.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Paste any URL and get a full audit covering technical SEO, on-page signals,
            local SEO, structured data, and answer-engine readiness.
          </p>
          <div className="mx-auto max-w-2xl bg-background border rounded-xl shadow-sm p-6">
            <UrlSubmitForm />
          </div>
          <p className="text-xs text-muted-foreground">
            Crawls up to 50 pages. No account required.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-background border rounded-lg p-4 space-y-2">
              <div className="text-primary">{f.icon}</div>
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
