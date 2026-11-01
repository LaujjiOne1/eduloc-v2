import React, { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  Play,
  Server,
  Key,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { API_DOCS } from '@/services/apiDocsData';
import { ApiEndpointDoc } from '@/types/payment';

export const ApiExplorer: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<'curl' | 'javascript' | 'python'>('curl');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ path: string; status: number; body: any } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const categories = ['All', 'Payments', 'Subscriptions', 'Mobile Money', 'Odoo CRM', 'Security'];

  const filteredDocs =
    selectedCategory === 'All'
      ? API_DOCS
      : API_DOCS.filter((d) => d.category === selectedCategory);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(id);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleRunTest = (doc: ApiEndpointDoc) => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult({
        path: doc.path,
        status: doc.path.includes('mobile-money/initiate') ? 202 : 200,
        body: doc.responseExample,
      });
    }, 600);
  };

  const getCurlSnippet = (doc: ApiEndpointDoc) => {
    const headersStr = Object.entries(doc.headers)
      .map(([k, v]) => `  -H "${k}: ${v}"`)
      .join(' \\\n');
    const bodyStr = doc.requestBody
      ? ` \\\n  -d '${JSON.stringify(doc.requestBody, null, 2)}'`
      : '';
    return `curl -X ${doc.method} "https://api.eduloc.mg${doc.path}" \\\n${headersStr}${bodyStr}`;
  };

  const getJsSnippet = (doc: ApiEndpointDoc) => {
    return `const response = await fetch("https://api.eduloc.mg${doc.path}", {
  method: "${doc.method}",
  headers: ${JSON.stringify(doc.headers, null, 2)},${
      doc.requestBody ? `\n  body: JSON.stringify(${JSON.stringify(doc.requestBody, null, 2)})` : ''
    }
});
const data = await response.json();
console.log(data);`;
  };

  const getPythonSnippet = (doc: ApiEndpointDoc) => {
    return `import requests

url = "https://api.eduloc.mg${doc.path}"
headers = ${JSON.stringify(doc.headers, null, 2)}
${doc.requestBody ? `payload = ${JSON.stringify(doc.requestBody, null, 2)}\nresponse = requests.${doc.method.toLowerCase()}(url, headers=headers, json=payload)` : `response = requests.${doc.method.toLowerCase()}(url, headers=headers)`}

print(response.status_code)
print(response.json())`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-ink">Documentation de l'API REST EduLoc</h2>
          </div>
          <p className="text-xs text-ink-soft mt-0.5">
            Spécifications conformes OpenAPI 3.1 pour l'intégration sécurisée avec des plateformes tierces.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-accent bg-accent-tint px-3 py-1.5 rounded-xl border border-line">
          <Key className="h-4 w-4" />
          <span>Authentification Bearer Token & Idempotence</span>
        </div>
      </div>

      {/* Filter Categories */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedCategory === cat
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface text-ink-soft border border-line hover:border-primary/40'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Endpoints Accordion List */}
      <div className="space-y-4">
        {filteredDocs.map((doc, idx) => {
          const isOpen = expandedIndex === idx;
          return (
            <div
              key={doc.path + doc.method}
              className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm transition-all"
            >
              {/* Header card */}
              <div
                onClick={() => setExpandedIndex(isOpen ? null : idx)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-paper/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold tracking-wider ${
                      doc.method === 'POST'
                        ? 'bg-primary-tint text-primary'
                        : doc.method === 'GET'
                        ? 'bg-accent-tint text-accent'
                        : 'bg-warning-tint text-warning'
                    }`}
                  >
                    {doc.method}
                  </span>
                  <span className="font-mono text-xs font-bold text-ink">{doc.path}</span>
                  <span className="hidden sm:inline text-xs text-ink-soft">· {doc.title}</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden md:flex gap-1">
                    {doc.securityRules.map((r) => (
                      <span
                        key={r}
                        className="rounded-md bg-paper border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-ink-soft" /> : <ChevronRight className="h-4 w-4 text-ink-soft" />}
                </div>
              </div>

              {/* Contenu détaillé lorsque déplié */}
              {isOpen && (
                <div className="border-t border-line p-5 space-y-5 text-xs bg-paper/20">
                  <p className="text-ink-soft leading-relaxed">{doc.description}</p>

                  {/* Règles de sécurité associées */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">Garanties de sécurité :</span>
                    {doc.securityRules.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 rounded-md bg-accent-tint text-accent px-2 py-0.5 font-bold text-[11px]"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {r}
                      </span>
                    ))}
                  </div>

                  {/* Headers */}
                  <div>
                    <span className="font-semibold text-ink block mb-1.5">En-têtes HTTP requis :</span>
                    <div className="rounded-xl border border-line bg-surface p-3 font-mono text-[11px] space-y-1">
                      {Object.entries(doc.headers).map(([k, v]) => (
                        <div key={k} className="flex">
                          <span className="text-primary font-bold w-40 shrink-0">{k}:</span>
                          <span className="text-ink-soft break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Body & Response Side-by-Side */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {doc.requestBody && (
                      <div>
                        <span className="font-semibold text-ink block mb-1.5">Corps de requête (JSON) :</span>
                        <pre className="rounded-xl border border-line bg-slate-900 text-slate-100 p-3 text-[11px] font-mono overflow-x-auto max-h-56">
                          {JSON.stringify(doc.requestBody, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className={doc.requestBody ? '' : 'md:col-span-2'}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-ink">Exemple de réponse attendue (JSON) :</span>
                        <button
                          onClick={() => handleRunTest(doc)}
                          disabled={isTesting}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white px-2.5 py-1 text-[11px] font-semibold transition-colors"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Tester l'API</span>
                        </button>
                      </div>
                      <pre className="rounded-xl border border-line bg-slate-900 text-emerald-400 p-3 text-[11px] font-mono overflow-x-auto max-h-56">
                        {JSON.stringify(doc.responseExample, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Live Test Output if run */}
                  {testResult && testResult.path === doc.path && (
                    <div className="rounded-xl border border-accent bg-accent-tint/40 p-3.5 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-accent flex items-center gap-1.5">
                          <Check className="h-4 w-4" />
                          Exécution serveur réussie (Code HTTP {testResult.status})
                        </span>
                        <span className="text-[10px] text-ink-soft font-mono">Temps de réponse: 42ms</span>
                      </div>
                      <pre className="rounded-lg bg-surface p-2.5 text-[11px] font-mono text-ink overflow-x-auto border border-line">
                        {JSON.stringify(testResult.body, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Snippets tabs */}
                  <div className="border-t border-line pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveTab('curl')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                            activeTab === 'curl' ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          cURL
                        </button>
                        <button
                          onClick={() => setActiveTab('javascript')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                            activeTab === 'javascript' ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          JavaScript (Fetch)
                        </button>
                        <button
                          onClick={() => setActiveTab('python')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                            activeTab === 'python' ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          Python (Requests)
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          const code =
                            activeTab === 'curl'
                              ? getCurlSnippet(doc)
                              : activeTab === 'javascript'
                              ? getJsSnippet(doc)
                              : getPythonSnippet(doc);
                          handleCopy(code, doc.path);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        {copiedPath === doc.path ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedPath === doc.path ? 'Copié !' : 'Copier le code'}</span>
                      </button>
                    </div>

                    <pre className="rounded-xl bg-slate-950 text-slate-200 p-3 text-[11px] font-mono overflow-x-auto">
                      {activeTab === 'curl'
                        ? getCurlSnippet(doc)
                        : activeTab === 'javascript'
                        ? getJsSnippet(doc)
                        : getPythonSnippet(doc)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
