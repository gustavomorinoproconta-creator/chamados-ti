
/* ====== Config ====== */
const COMPANY_NAME = 'Safári Diversão • TI';
const API_URL = 'https://script.google.com/macros/s/AKfycbyExpbvMR7X1DQTtEah_taK_1EY2wvzoMdHUaE8oPAGaGzKL5RLa8kFQvwdjDQT5O7BOQ/exec';

document.getElementById('companyName').textContent = COMPANY_NAME;
document.getElementById('year').textContent = new Date().getFullYear();

/* ====== Helpers ====== */
const $ = (s) => document.querySelector(s);
const toast = (msg, ms=1800) => { const t=$('#toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), ms); };

/* Copiar com fallback (funciona sem HTTPS também) */
async function copiar(texto){
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(texto);
  } else {
    const ta = document.createElement('textarea');
    ta.value = texto; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
  }
}

/* ====== API ====== */
const apiGet  = async (params={}) => { const r = await fetch(API_URL+'?'+new URLSearchParams(params)); const j=await r.json(); if(!j.ok) throw new Error(j.error||'Erro API'); return j.data; };
const apiPost = async (payload={}) => { const r = await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)}); const j=await r.json(); if(!j.ok) throw new Error(j.error||'Erro API'); return j.data; };

const apiList   = () => apiGet({action:'list'});
const apiLookup = (protocolo) => apiGet({action:'lookup', protocolo});
const apiCreate = (data) => apiPost({action:'create', data});
const apiUpdate = (id, fields) => apiPost({action:'update', id, fields});
const apiDelete = (id) => apiPost({action:'delete', id});

/* ====== USER PAGE ====== */
function initUser(){
  const form = $('#formChamado');

  if(form){
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const chamado = {
        nome: $('#nome').value.trim(),
        email: $('#email').value.trim(),
        setor: $('#setor').value.trim(),
        prioridade: $('#prioridade').value,
        categoria: $('#categoria').value,
        problema: $('#problema').value.trim()
      };
      if(!chamado.nome || !chamado.email || !chamado.setor || !chamado.problema){
        toast('Preencha todos os campos.'); return;
      }

      try{
        const created = await apiCreate(chamado);
        form.reset();

        // Mostrar protocolo no card
        document.getElementById('protocoloText').textContent = created.protocolo;
        document.getElementById('confirmCard').hidden = false;

        // Guardar para botão "Copiar"
        window.__ultimoProtocolo = created.protocolo;

        toast('Chamado aberto!');
      }catch(err){
        console.error(err); toast('Falha ao abrir chamado.');
      }
    });
  }

  // Copiar protocolo
  document.getElementById('copiarProtocoloBtn')?.addEventListener('click', ()=>{
    const codigo = window.__ultimoProtocolo || document.getElementById('protocoloText')?.textContent || '';
    if(!codigo){ toast('Nenhum protocolo para copiar.'); return; }
    copiar(codigo).then(()=> toast('Protocolo copiado!'));
  });

  // Abrir outro chamado
  document.getElementById('novoChamadoBtn')?.addEventListener('click', ()=>{
    document.getElementById('confirmCard').hidden = true;
  });

  // Consultar status
  document.getElementById('consultarBtn')?.addEventListener('click', async ()=>{
    const prot = (document.getElementById('consultaProtocolo').value||'').trim();
    if(!prot) return toast('Informe o protocolo.');
    try{
      const item = await apiLookup(prot);
      renderConsulta(item || null);
    }catch(err){ console.error(err); toast('Erro ao consultar.'); }
  });
}

function renderConsulta(chamado){
  const box = document.getElementById('consultaResultado');
  if(!box) return;
  if(!chamado){
    box.hidden = false;
    box.className = 'empty';
    box.innerHTML = `<p>Nenhum chamado encontrado com esse protocolo.</p>`;
    return;
  }
  const prioClass = {Baixa:'prio-baixa','Média':'prio-media','Alta':'prio-alta','Crítica':'prio-critica'}[chamado.prioridade] || 'prio-media';
  const statusClass = {Aberto:'status-aberto','Em andamento':'status-andamento','Concluído':'status-concluido'}[chamado.status] || 'status-aberto';

  box.hidden = false;
  box.className = 'ticket';
  box.innerHTML = `
    <div class="ticket-head">
      <div class="badges">
        <span class="badge ${statusClass}">${chamado.status}</span>
        <span class="badge ${prioClass}">Prioridade: ${chamado.prioridade}</span>
        <span class="badge">Prot.: ${chamado.protocolo}</span>
        <span class="badge">Categoria: ${chamado.categoria}</span>
      </div>
    </div>
    <div class="ticket-body">
      <strong>${chamado.nome}</strong> • ${chamado.setor} • <a href="mailto:${chamado.email}">${chamado.email}</a>
      <p style="margin:.35rem 0 0">${chamado.problema}</p>
    </div>
    <div class="ticket-meta">
      Aberto em ${new Date(chamado.criadoEm).toLocaleString('pt-BR')}
      ${chamado.atualizadoEm ? ' • Atualizado: '+ new Date(chamado.atualizadoEm).toLocaleString('pt-BR') : ''}
    </div>
  `;
}

/* ====== ADMIN PAGE (inalterado) ====== */
function initAdmin(){ /* ... o mesmo do seu projeto ... */ }

/* ====== Boot ====== */
const page = document.body.dataset.page;
if(page==='user') initUser();
if(page==='admin') initAdmin();
