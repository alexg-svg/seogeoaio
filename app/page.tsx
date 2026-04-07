"use client";

import { useState } from "react";

interface AuditResult {
  auditId: string;
  projectId: string;
  status: string;
  inputUrl: string;
  inputType: string;
  discoveredUrlCount: number;
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [inputType, setInputType] = useState<"" | "HOMEPAGE" | "SITEMAP">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          ...(inputType ? { inputType } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setResult(data as AuditResult);
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold mb-6">SEO Audit — Pass 2A test</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            URL to audit
          </label>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com or https://example.com/sitemap.xml"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Input type <span className="text-gray-400">(leave blank to auto-detect)</span>
          </label>
          <select
            value={inputType}
            onChange={(e) =>
              setInputType(e.target.value as "" | "HOMEPAGE" | "SITEMAP")
            }
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
          >
            <option value="">Auto-detect</option>
            <option value="HOMEPAGE">Homepage / page URL</option>
            <option value="SITEMAP">Sitemap URL</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded px-4 py-2 text-sm"
        >
          {loading ? "Creating audit…" : "Start audit"}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded text-sm space-y-2">
          <p className="font-semibold text-green-800">Audit created ✓</p>
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(result).map(([k, v]) => (
                <tr key={k} className="border-t border-green-100">
                  <td className="py-1 pr-4 font-medium text-gray-600">{k}</td>
                  <td className="py-1 font-mono">{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-gray-500 pt-2">
            Poll:{" "}
            <code className="bg-white px-1 rounded">
              GET /api/audits/{result.auditId}?view=status
            </code>
          </p>
        </div>
      )}
    </main>
  );
}
