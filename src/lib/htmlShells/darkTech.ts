import { escapeHtml } from './index'

export function darkTechShell(svg: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Architecture Diagram')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #020617; }
  body {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #e2e8f0;
    background-image:
      linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px);
    background-size: 40px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px;
    box-sizing: border-box;
  }
  .header { width: 100%; max-width: 1200px; padding-bottom: 16px; }
  .header h1 {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #f1f5f9;
    margin: 0;
  }
  .diagram-card {
    width: 100%;
    max-width: 1200px;
    background: rgba(15,23,42,0.6);
    border: 1px solid rgba(148,163,184,0.15);
    border-radius: 12px;
    padding: 24px;
    box-sizing: border-box;
  }
  .diagram-card svg { width: 100%; height: auto; display: block; }
</style>
</head>
<body>
  <div class="header"><h1>${safeTitle}</h1></div>
  <div class="diagram-card">${svg}</div>
</body>
</html>`
}
