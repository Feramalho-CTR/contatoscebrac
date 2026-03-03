# Separador de Contatos (.vcf)

Site simples para importar contatos do celular e separar **nome** e **telefone** para uso em planilhas.

## O que o site faz

- Seleção direta de **1 contato do celular** (quando o navegador suporta Contact Picker API).
- Upload de arquivo `.vcf` como alternativa universal.
- Exportação para **Excel** por CSV.
- Cópia para **Google Planilhas** por TSV.
- Envio opcional para Google Planilhas via Apps Script.
- Fluxo de avaliação da escola na mesma página:
  - escolher estrelas,
  - escrever comentário,
  - copiar avaliação,
  - abrir o link de avaliação do Google.

## Como usar

1. Abra `index.html` no navegador (preferencialmente no celular).
2. Clique em **Selecionar contato do celular** ou envie um `.vcf`.
3. Para envio automático, preencha a URL do Web App e clique em **Enviar contato agora**.
4. Após a mensagem de sucesso, faça a avaliação da escola:
   - selecione as estrelas,
   - escreva o comentário,
   - use **Abrir Google para publicar**.

## Exemplo de Apps Script (opcional)

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Contatos');

  data.contacts.forEach((c) => {
    sheet.appendRow([c.name, c.phone]);
  });

  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, total: data.contacts.length })
  ).setMimeType(ContentService.MimeType.JSON);
}
```
