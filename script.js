const fileInput = document.getElementById('vcfFile');
const pickContactBtn = document.getElementById('pickContactBtn');
const statusText = document.getElementById('status');
const tableBody = document.getElementById('contactsTableBody');
const sendToSheetsBtn = document.getElementById('sendToSheets');
const sendSuccess = document.getElementById('sendSuccess');
const reviewCommentInput = document.getElementById('reviewComment');
const reviewStatus = document.getElementById('reviewStatus');
const openGoogleReviewBtn = document.getElementById('openGoogleReviewBtn');
const starsContainer = document.getElementById('stars');

// Admin Elements
const adminBtn = document.getElementById('adminBtn');
const adminModal = document.getElementById('adminModal');
const closeModal = document.getElementById('closeModal');
const adminLoginView = document.getElementById('adminLoginView');
const adminDashboardView = document.getElementById('adminDashboardView');
const adminPasswordInput = document.getElementById('adminPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const dashTitle = document.getElementById('dashTitle');
const totalSentSpan = document.getElementById('totalSent');
const webhookUrlInput = document.getElementById('webhookUrl');
const googleReviewUrlInput = document.getElementById('googleReviewUrl');
const downloadCsvBtn = document.getElementById('downloadCsv');
const copyTsvBtn = document.getElementById('copyTsv');
const studentNameInput = document.getElementById('studentName');

let contacts = [];
let selectedRating = 0;
let currentProfessorSession = null;

const CONFIGURED_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxG-BiEH8B3wvV5v2f93kHIPvxeeZd4A7NrWv4c5eNipp_nGDzAw06-xR6ipLZi2FJHxw/exec';
const CONFIGURED_REVIEW_URL = 'https://www.google.com/search?q=cebrac+joinville&ludocid=13719213190831601754#lrd=0x94deb049a1245031:0xbe64b5338f17f85a,3';

// Carregar URLs salvas
window.addEventListener('DOMContentLoaded', () => {
  const savedWebhook = localStorage.getItem('webhookUrl');
  const savedReview = localStorage.getItem('googleReviewUrl');

  // Prioridade: 1. Hardcoded, 2. LocalStorage, 3. Default
  webhookUrlInput.value = CONFIGURED_WEBHOOK_URL || savedWebhook || '';
  googleReviewUrlInput.value = CONFIGURED_REVIEW_URL || savedReview || '';
});

// Admin Modal Toggle
adminBtn.addEventListener('click', () => {
  adminModal.classList.remove('hidden');
  adminPasswordInput.focus();
});

closeModal.addEventListener('click', () => {
  adminModal.classList.add('hidden');
  resetAdminView();
});

// Login Logic
loginBtn.addEventListener('click', handleLogin);
adminPasswordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLogin();
});

function handleLogin() {
  const pass = adminPasswordInput.value.trim().toLowerCase();

  if (pass === 'tatiana') {
    startAdminSession('Prof. Tati');
  } else if (pass === 'felipe') {
    startAdminSession('Prof. Felipe');
  } else {
    loginError.classList.remove('hidden');
    adminPasswordInput.value = '';
  }
}

function startAdminSession(profName) {
  currentProfessorSession = profName;
  adminLoginView.classList.add('hidden');
  adminDashboardView.classList.remove('hidden');
  dashTitle.textContent = `Painel: ${profName}`;
  loginError.classList.add('hidden');
  adminPasswordInput.value = '';
  updateDashStats();
}

function resetAdminView() {
  currentProfessorSession = null;
  adminLoginView.classList.remove('hidden');
  adminDashboardView.classList.add('hidden');
  adminPasswordInput.value = '';
}

logoutBtn.addEventListener('click', resetAdminView);

function updateDashStats() {
  if (!currentProfessorSession) return;
  const count = localStorage.getItem(`stats_${currentProfessorSession}`) || 0;
  totalSentSpan.textContent = count;
}

// Salvar URLs ao digitar
webhookUrlInput.addEventListener('input', (e) => {
  localStorage.setItem('webhookUrl', e.target.value.trim());
});
googleReviewUrlInput.addEventListener('input', (e) => {
  localStorage.setItem('googleReviewUrl', e.target.value.trim());
});

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  statusText.textContent = 'Processando arquivo...';
  try {
    const content = await file.text();
    const parsed = parseVcf(content);
    contacts = [...contacts, ...parsed];
    onContactsUpdated();
  } catch (err) {
    statusText.textContent = 'Erro ao ler arquivo VCF.';
    console.error(err);
  }
});

pickContactBtn.addEventListener('click', async () => {
  if (!('contacts' in navigator)) {
    statusText.textContent = 'Seu navegador não suporta seleção direta. Use o arquivo .vcf.';
    return;
  }

  try {
    const selected = await navigator.contacts.select(['name', 'tel'], { multiple: true });
    if (!selected.length) return;

    const newContacts = selected.map(item => ({
      name: (item.name?.[0] || '').trim(),
      phone: normalizePhone(item.tel?.[0] || '')
    })).filter(c => c.name && c.phone);

    contacts = [...contacts, ...newContacts];
    onContactsUpdated();
  } catch (error) {
    statusText.textContent = `Erro ao selecionar: ${error.message}`;
  }
});

downloadCsvBtn.addEventListener('click', () => {
  const csv = toCsv(contacts);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `indicações_${new Date().toLocaleDateString()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

copyTsvBtn.addEventListener('click', async () => {
  const professor = getSelectedProfessor();
  const student = studentNameInput.value.trim() || 'Desconhecido';
  const tsv = ['Aluno\tIndicação\tNúmero\tProfessor', ...contacts.map((c) => `${student}\t${c.name}\t${c.phone}\t${professor}`)].join('\n');
  try {
    await navigator.clipboard.writeText(tsv);
    statusText.textContent = '✅ Copiado para Planilhas!';
    statusText.classList.add('success');
  } catch (err) {
    statusText.textContent = 'Erro ao copiar dados.';
  }
});

sendToSheetsBtn.addEventListener('click', async () => {
  const student = studentNameInput.value.trim();
  const professor = getSelectedProfessor();
  const webhookUrl = webhookUrlInput.value.trim();

  if (!student) {
    statusText.textContent = '⚠️ Por favor, digite seu nome primeiro.';
    studentNameInput.focus();
    return;
  }

  if (contacts.length === 0) {
    statusText.textContent = '⚠️ Selecione pelo menos um amigo para enviar.';
    return;
  }

  sendToSheetsBtn.disabled = true;
  statusText.textContent = 'Enviando indicações para a planilha...';

  try {
    // Formata os contatos para garantir que temos apenas Nome e Telefone limpos
    const contactsPayload = contacts.map(c => ({
      name: c.name,
      phone: c.phone
    }));

    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' }, // text/plain ajuda a evitar problemas de CORS no Apps Script
      body: JSON.stringify({
        studentName: student,
        professor: professor,
        contacts: contactsPayload,
        timestamp: new Date().toISOString()
      })
    });

    // Atualizar estatísticas locais
    const currentCount = parseInt(localStorage.getItem(`stats_${professor}`) || '0');
    localStorage.setItem(`stats_${professor}`, currentCount + contacts.length);
    updateDashStats();

    sendSuccess.classList.remove('hidden');
    statusText.textContent = '✅ Sucesso! Agora você pode avaliar o curso abaixo.';
    statusText.classList.add('success');

    // Limpar contatos após sucesso para evitar re-envio acidental
    contacts = [];
    onContactsUpdated();

  } catch (error) {
    statusText.textContent = `❌ Erro na conexão: ${error.message}. Verifique se a URL do Web App está correta no painel.`;
    console.error('Erro no envio:', error);
  } finally {
    sendToSheetsBtn.disabled = false;
  }
});

starsContainer.addEventListener('click', (event) => {
  const starButton = event.target.closest('.star');
  if (!starButton) return;

  selectedRating = Number(starButton.dataset.value);
  paintStars(selectedRating);
});

openGoogleReviewBtn.addEventListener('click', () => {
  const url = googleReviewUrlInput.value.trim();
  if (!url) {
    reviewStatus.textContent = '⚠️ Modo Admin: Configure o link no painel do professor.';
    return;
  }

  const message = buildReviewMessage();
  navigator.clipboard.writeText(message).finally(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
    reviewStatus.textContent = 'Abrindo Google...';
  });
});

function getSelectedProfessor() {
  const checked = document.querySelector('input[name="professor"]:checked');
  return checked ? checked.value : 'Não especificado';
}

function onContactsUpdated() {
  renderTable(contacts);
  sendSuccess.classList.add('hidden');

  if (contacts.length > 0) {
    statusText.textContent = `${contacts.length} amigo(s) selecionado(s).`;
    statusText.classList.remove('success');
    sendToSheetsBtn.disabled = false;
  } else {
    statusText.textContent = 'Nenhum amigo selecionado.';
    sendToSheetsBtn.disabled = true;
  }
}

function buildReviewMessage() {
  const stars = selectedRating ? '⭐'.repeat(selectedRating) : '';
  const comment = reviewCommentInput.value.trim();
  const professor = getSelectedProfessor();

  let msg = `Curso com ${professor}: `;
  if (stars && comment) msg += `${stars}\n\n${comment}`;
  else if (stars) msg += stars;
  else msg += comment || 'Excelente escola!';

  return msg;
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
      const fnLine = lines.find((line) => line.toUpperCase().startsWith('FN:'));
      const nLine = lines.find((line) => line.toUpperCase().startsWith('N:'));
      const telLine = lines.find((line) => line.toUpperCase().startsWith('TEL'));

      let name = '';
      if (fnLine) name = fnLine.split(':').slice(1).join(':').trim();
      else if (nLine) {
        const parts = nLine.split(':').slice(1).join(':').split(';');
        name = parts.filter(Boolean).reverse().join(' ').trim();
      }

      const rawPhone = telLine ? telLine.split(':').slice(1).join(':') : '';
      const phone = normalizePhone(rawPhone);
      return { name, phone };
    })
    .filter((contact) => contact.name && contact.phone);
}

function normalizePhone(value) {
  let cleaned = value.replace(/[^\d+]/g, '').trim();
  if (cleaned.length === 11 && !cleaned.startsWith('+')) {
    cleaned = '+55' + cleaned;
  }
  return cleaned;
}

function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = '<tr><td colspan="2" class="empty">Ninguém selecionado ainda.</td></tr>';
    return;
  }

  tableBody.innerHTML = data
    .map((contact) => `
      <tr>
        <td style="font-weight: 500;">${escapeHtml(contact.name)}</td>
        <td style="font-family: monospace; color: var(--blue);">${escapeHtml(contact.phone)}</td>
      </tr>
    `)
    .join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toCsv(data) {
  const professor = getSelectedProfessor();
  const student = studentNameInput.value.trim() || 'Desconhecido';
  const header = ['Aluno', 'Indicação', 'Número', 'Professor'];
  const rows = data.map((contact) => [student, contact.name, contact.phone, professor]);

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
