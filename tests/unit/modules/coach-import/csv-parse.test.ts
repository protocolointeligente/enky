import { describe, expect, it } from "vitest";
import { parseCsv, validateClientImport } from "@/modules/coach-import/csv-parse";

describe("parseCsv", () => {
  it("parseia campos simples e várias linhas", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("respeita aspas com vírgula e aspas escapadas", () => {
    expect(parseCsv('nome,obs\n"Silva, João","diz ""oi"""')).toEqual([
      ["nome", "obs"],
      ["Silva, João", 'diz "oi"'],
    ]);
  });

  it("lida com CRLF e BOM, e descarta linhas vazias", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("validateClientImport", () => {
  it("exige a coluna nome", () => {
    expect(validateClientImport([["email"], ["x@y.com"]]).headerError).toMatch(/nome/i);
  });

  it("mapeia colunas por cabeçalho (pt/en) e valida", () => {
    const { headerError, rows } = validateClientImport([
      ["Nome", "E-mail", "Telefone"],
      ["Maria", "maria@x.com", "11999"],
      ["", "sem@nome.com", ""],
      ["João", "email-ruim", ""],
    ]);
    expect(headerError).toBeNull();
    expect(rows[0]).toEqual({ line: 2, data: { name: "Maria", email: "maria@x.com", phone: "11999", document: null }, error: null });
    expect(rows[1]!.error).toMatch(/vazio/i);
    expect(rows[2]!.error).toMatch(/mail/i);
  });

  it("barra arquivos gigantes", () => {
    const big = [["nome"], ...Array.from({ length: 1001 }, () => ["x"])];
    expect(validateClientImport(big).headerError).toMatch(/1000/);
  });
});
