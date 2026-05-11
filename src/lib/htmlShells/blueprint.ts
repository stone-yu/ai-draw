import { escapeHtml } from './index'

export function blueprintShell(svg: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Architecture Blueprint')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #0a1628; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    color: #bfdbfe;
    background-image:
      linear-gradient(rgba(96,165,250,0.10) 1px, transparent 1px),
      linear-gradient(90deg, rgba(96,165,250,0.10) 1px, transparent 1px);
    background-size: 32px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px;
    box-sizing: border-box;
  }
  .header { width: 100%; max-width: 1200px; padding-bottom: 12px; }
  .header h1 {
    font-size: 16px;
    font-weight: 500;
    color: #dbeafe;
    margin: 0;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .diagram-card {
    width: 100%;
    max-width: 1200px;
    border: 1px solid rgba(96,165,250,0.35);
    border-radius: 8px;
    padding: 20px;
    background: rgba(8,17,33,0.6);
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
