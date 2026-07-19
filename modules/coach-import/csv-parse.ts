// Parser + validador de CSV de clientes (§26). PURO e testado — é o caminho de
// integridade de dado (uma linha mal parseada vira cliente errado). Colunas
// esperadas por cabeçalho (nome obrigatório; email/telefone/documento opcionais).
// Mapeamento livre de colunas fica para uma fatia futura.

// Parser RFC-4180-ish: aspas, aspas escapadas (""), vírgula e CRLF/LF.
export function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      endField();
      i++;
    } else if (ch === "\n") {
      endRow();
      i++;
    } else if (ch === "\r") {
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  if (field !== "" || row.length > 0) endRow();

  // Descarta linhas totalmente vazias.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ClientImportRow {
  line: number;
  data: { name: string; email: string | null; phone: string | null; document: string | null };
  error: string | null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateClientImport(rows: string[][]): {
  headerError: string | null;
  rows: ClientImportRow[];
} {
  if (rows.length === 0) return { headerError: "Arquivo vazio.", rows: [] };
  if (rows.length > 1001) return { headerError: "Máximo de 1000 linhas por importação.", rows: [] };

  const headers = rows[0]!.map((h) => h.trim().toLowerCase());
  const pick = (...names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iName = pick("nome", "name");
  if (iName < 0) return { headerError: "Coluna 'nome' não encontrada no cabeçalho.", rows: [] };
  const iEmail = pick("email", "e-mail");
  const iPhone = pick("telefone", "phone", "celular");
  const iDoc = pick("documento", "document", "cpf", "cnpj");

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const out: ClientImportRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    const name = cell(cells, iName);
    const email = cell(cells, iEmail);
    const phone = cell(cells, iPhone);
    const document = cell(cells, iDoc);

    let error: string | null = null;
    if (!name) error = "Nome vazio.";
    else if (name.length > 200) error = "Nome muito longo (máx. 200).";
    else if (email && !EMAIL_RE.test(email)) error = "E-mail inválido.";

    out.push({
      line: r + 1,
      data: { name, email: email || null, phone: phone || null, document: document || null },
      error,
    });
  }
  return { headerError: null, rows: out };
}
