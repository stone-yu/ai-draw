import { escapeHtml } from './index'

export function flatIconShell(svg: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Technical Diagram')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #ffffff; }
  body {
    font-family: 'Inter', system-ui, -apple-system, Segoe UI, sans-serif;
    color: #0f172a;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px;
    box-sizing: border-box;
  }
  .header { width: 100%; max-width: 1100px; padding-bottom: 12px; }
  .header h1 { font-size: 18px; font-weight: 600; margin: 0; color: #111827; }
  .diagram-card {
    width: 100%;
    max-width: 1100px;
    background: #ffffff;
    padding: 16px 0;
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
