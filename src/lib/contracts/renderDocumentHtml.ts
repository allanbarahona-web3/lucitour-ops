export interface BrandedDocumentOptions {
  bodyText: string;
  logoPath?: string;
  companyName?: string;
  companyId?: string;
  companyPhone?: string;
  companyEmail?: string;
  canaturLabel?: string;
}

const DEFAULTS = {
  logoPath: "/logo/logo-lucitour.png",
  companyName: "VIAJES LUCITOURS AGENCIA DE VIAJES TURISMO INTERNACIONAL S. A.",
  companyId: "3-101-874546",
  companyPhone: "+506 6015-9906",
  companyEmail: "lucitours1211@gmail.com",
  canaturLabel: "AFILIADO A CANATUR",
} as const;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const isClauseHeading = (line: string): boolean =>
  /^[A-Z0-9ÁÉÍÓÚÜÑ\s]+:\s*.*$/.test(line) && line.length <= 140;

const toContentHtml = (bodyText: string): string => {
  const lines = bodyText.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (!listType) {
      return;
    }
    output.push(listType === "ul" ? "</ul>" : "</ol>");
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      output.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      output.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      output.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }

    if (line === "CLAUSULAS" || line === "FIRMAS") {
      closeList();
      output.push(`<h2>${escapeHtml(line)}</h2>`);
      continue;
    }

    if (isClauseHeading(line)) {
      closeList();
      output.push(`<h3>${escapeHtml(line)}</h3>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (listType !== "ul") {
        closeList();
        output.push("<ul>");
        listType = "ul";
      }
      output.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }

    const ordered = line.match(/^(\d+)\.\s+(.+)$/);
    if (ordered) {
      if (listType !== "ol") {
        closeList();
        output.push("<ol>");
        listType = "ol";
      }
      output.push(`<li>${escapeHtml(ordered[2])}</li>`);
      continue;
    }

    closeList();
    output.push(`<p>${escapeHtml(line)}</p>`);
  }

  closeList();
  return output.join("\n");
};

export const renderBrandedDocumentHtml = (options: BrandedDocumentOptions): string => {
  const logoPath = options.logoPath ?? DEFAULTS.logoPath;
  const companyName = options.companyName ?? DEFAULTS.companyName;
  const companyId = options.companyId ?? DEFAULTS.companyId;
  const companyPhone = options.companyPhone ?? DEFAULTS.companyPhone;
  const companyEmail = options.companyEmail ?? DEFAULTS.companyEmail;
  const canaturLabel = options.canaturLabel ?? DEFAULTS.canaturLabel;

  const contentHtml = toContentHtml(options.bodyText);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Documento Lucitours</title>
    <style>
      :root {
        --ink: #111827;
        --muted: #6b7280;
        --line: #e5e7eb;
        --accent: #059669;
      }

      * { box-sizing: border-box; }

      @page {
        size: A4;
        margin: 18mm 14mm 20mm;
      }

      body {
        margin: 0;
        color: var(--ink);
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        background: #f3f4f6;
      }

      .sheet {
        position: relative;
        margin: 0 auto;
        background: #fff;
        width: 210mm;
        min-height: 297mm;
        padding: 30mm 0 24mm;
      }

      .page-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 24mm;
        padding: 5mm 14mm 2mm;
        border-bottom: 1px solid var(--line);
        background: #fff;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10mm;
      }

      .page-header img {
        width: 44mm;
        height: auto;
        object-fit: contain;
      }

      .company {
        text-align: right;
        font-size: 10.5px;
        color: var(--muted);
        line-height: 1.35;
      }

      .company .name {
        font-size: 11px;
        font-weight: 700;
        color: #4b5563;
        text-transform: uppercase;
      }

      .page-footer {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: 18mm;
        padding: 2mm 14mm 4mm;
        border-top: 1px solid var(--line);
        background: #fff;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .footer-note {
        font-size: 10px;
        color: var(--muted);
      }

      .canatur-badge {
        border: 1px solid #a7f3d0;
        color: #065f46;
        background: #ecfdf5;
        border-radius: 999px;
        padding: 3px 10px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.03em;
      }

      .document-body {
        padding: 0 14mm;
        font-size: 12.5px;
        line-height: 1.55;
      }

      h1, h2, h3 {
        margin: 0.8em 0 0.35em;
        color: #111827;
      }

      h1 {
        font-size: 18px;
        text-transform: uppercase;
      }

      h2 {
        font-size: 14px;
        text-transform: uppercase;
      }

      h3 {
        font-size: 12.5px;
        text-transform: uppercase;
        font-weight: 700;
      }

      p {
        margin: 0 0 0.7em;
      }

      ul, ol {
        margin: 0.2em 0 0.8em 1.2em;
        padding: 0;
      }

      li {
        margin-bottom: 0.3em;
      }

      @media print {
        body {
          background: #fff;
        }

        .sheet {
          margin: 0;
          width: auto;
          min-height: auto;
          padding: 0;
        }

        .document-body {
          padding-top: 26mm;
          padding-bottom: 20mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <header class="page-header">
        <img src="${escapeHtml(logoPath)}" alt="Logo Lucitours" />
        <div class="company">
          <div class="name">${escapeHtml(companyName)}</div>
          <div>${escapeHtml(companyId)}</div>
          <div>${escapeHtml(companyPhone)}</div>
          <div>${escapeHtml(companyEmail)}</div>
        </div>
      </header>

      <main class="document-body">
        ${contentHtml}
      </main>

      <footer class="page-footer">
        <div class="footer-note">Documento contractual generado por Lucitours.</div>
        <div class="canatur-badge">${escapeHtml(canaturLabel)}</div>
      </footer>
    </div>
  </body>
</html>`;
};
