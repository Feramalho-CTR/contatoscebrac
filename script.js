const fileInput = document.getElementById('vcfFile');
const pickContactBtn = document.getElementById('pickContactBtn');
const statusText = document.getElementById('status');
const tableBody = document.getElementById('contactsTableBody');
const downloadCsvBtn = document.getElementById('downloadCsv');
const copyTsvBtn = document.getElementById('copyTsv');
const sendToSheetsBtn = document.getElementById('sendToSheets');
const webhookUrlInput = document.getElementById('webhookUrl');
const sendSuccess = document.getElementById('sendSuccess');
const googleReviewUrlInput = document.getElementById('googleReviewUrl');
const reviewCommentInput = document.getElementById('reviewComment');
const reviewStatus = document.getElementById('reviewStatus');
const copyReviewBtn = document.getElementById('copyReviewBtn');
const openGoogleReviewBtn = document.getElementById('openGoogleReviewBtn');
const starsContainer = document.getElementById('stars');

let contacts = [];
let selectedRating = 0;

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const content = await file.text();
  contacts = parseVcf(content);
  onContactsUpdated();
});

pickContactBtn.addEventListener('click', async () => {
  if (!('contacts' in navigator) || !('ContactsManager' in window)) {
    statusText.textContent =
      'Seu navegador não suporta seleção direta de contato. Use o upload .vcf abaixo.';
    return;
  }

  try {
    const selected = await navigator.contacts.select(['name', 'tel'], { multiple: false });
    if (!selected.length) return;

    const item = selected[0];
    const name = (item.name?.[0] || '').trim();
    const phone = normalizePhone(item.tel?.[0] || '');

    if (!name || !phone) {
      statusText.textContent = 'Contato sem nome ou telefone válido.';
      return;
    }

    contacts = [{ name, phone }];
    onContactsUpdated();
  } catch (error) {
    statusText.textContent = `Não foi possível selecionar contato: ${error.message}`;
  }
});

downloadCsvBtn.addEventListener('click', () => {
  const csv = toCsv(contacts);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'contatos.csv';
  link.click();
  URL.revokeObjectURL(url);
});

copyTsvBtn.addEventListener('click', async () => {
  const tsv = ['Nome\tTelefone', ...contacts.map((c) => `${c.name}\t${c.phone}`)].join('\n');
  await navigator.clipboard.writeText(tsv);
  statusText.textContent = 'Dados copiados! Cole diretamente no Google Planilhas.';
});

sendToSheetsBtn.addEventListener('click', async () => {
  const webhookUrl = webhookUrlInput.value.trim();
  if (!webhookUrl) {
    statusText.textContent = 'Informe a URL do seu Web App no Google Apps Script.';
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts })
    });

    if (!response.ok) {
      throw new Error(`Falha HTTP ${response.status}`);
    }

    sendSuccess.classList.remove('hidden');
    statusText.textContent = 'Contato enviado com sucesso. Você já pode avaliar a escola abaixo.';
  } catch (error) {
    sendSuccess.classList.add('hidden');
    statusText.textContent = `Erro ao enviar: ${error.message}`;
  }
});

starsContainer.addEventListener('click', (event) => {
  const starButton = event.target.closest('.star');
  if (!starButton) return;

  selectedRating = Number(starButton.dataset.value);
  paintStars(selectedRating);
});

copyReviewBtn.addEventListener('click', async () => {
  const message = buildReviewMessage();
  await navigator.clipboard.writeText(message);
  reviewStatus.textContent = 'Avaliação copiada! Agora basta colar no Google.';
});

openGoogleReviewBtn.addEventListener('click', () => {
  const url = googleReviewUrlInput.value.trim();
  if (!url) {
    reviewStatus.textContent = 'Informe o link da avaliação no Google para continuar.';
    return;
  }

  const message = buildReviewMessage();
  navigator.clipboard
    .writeText(message)
    .then(() => {
      reviewStatus.textContent =
        'Comentário copiado. Abrindo Google para você definir estrelas e colar o texto.';
      window.open(url, '_blank', 'noopener,noreferrer');
    })
    .catch(() => {
      reviewStatus.textContent = 'Abrindo Google. Se necessário, copie seu comentário manualmente.';
      window.open(url, '_blank', 'noopener,noreferrer');
    });
});

function onContactsUpdated() {
  renderTable(contacts);
  sendSuccess.classList.add('hidden');

  if (contacts.length > 0) {
    statusText.textContent = `${contacts.length} contato(s) pronto(s) para envio.`;
    downloadCsvBtn.disabled = false;
    copyTsvBtn.disabled = false;
    sendToSheetsBtn.disabled = false;
  } else {
    statusText.textContent = 'Nenhum contato válido encontrado.';
    downloadCsvBtn.disabled = true;
    copyTsvBtn.disabled = true;
    sendToSheetsBtn.disabled = true;
  }
}

function buildReviewMessage() {
  const starsText = selectedRating ? `${'⭐'.repeat(selectedRating)} (${selectedRating}/5)` : 'Sem estrelas';
  const comment = reviewCommentInput.value.trim() || 'Sem comentário';
  return `Avaliação: ${starsText}\nComentário: ${comment}`;
}

function paintStars(rating) {
  document.querySelectorAll('.star').forEach((star) => {
    const value = Number(star.dataset.value);
    star.classList.toggle('active', value <= rating);
  });
}

function parseVcf(vcfText) {
  const cards = vcfText
    .replace(/\r\n/g, '\n')
    .split('END:VCARD')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return cards
    .map((card) => {
      const lines = card.split('\n').map((line) => line.trim());
      const fnLine = lines.find((line) => line.startsWith('FN:'));
      const nLine = lines.find((line) => line.startsWith('N:'));
      const telLine = lines.find((line) => line.startsWith('TEL'));

      const name = (fnLine?.split(':')[1] || nLine?.split(':')[1] || '').trim();
      const rawPhone = telLine?.split(':')[1] || '';
      const phone = normalizePhone(rawPhone);
      return { name, phone };
    })
    .filter((contact) => contact.name && contact.phone);
}

function normalizePhone(value) {
  return value.replace(/[^\d+]/g, '').trim();
}

function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = '<tr><td colspan="2" class="empty">Sem dados para exibir.</td></tr>';
    return;
  }

  tableBody.innerHTML = data
    .map((contact) => `<tr><td>${escapeHtml(contact.name)}</td><td>${escapeHtml(contact.phone)}</td></tr>`)
    .join('');
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toCsv(data) {
  const rows = data.map((contact) => [contact.name, contact.phone]);
  const header = ['Nome', 'Telefone'];

  return [header, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
