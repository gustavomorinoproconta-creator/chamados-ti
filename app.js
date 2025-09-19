/* ====== Config ====== */
const COMPANY_NAME = 'Safári Diversão • TI';  // personalize
const API_URL = 'https://script.google.com/macros/s/AKfycbyExpbvMR7X1DQTtEah_taK_1EY2wvzoMdHUaE8oPAGaGzKL5RLa8kFQvwdjDQT5O7BOQ/exec';   // URL do Deploy do Apps Script (termina com /exec)

document.getElementById('companyName').textContent = COMPANY_NAME;
document.getElementById('year').textContent = new Date().getFullYear();

/* ====== Helpers ====== */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const toast = (msg, ms=1800) => { const t=$('#toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), ms); };

/* ====== API (Google Apps Script) ====== */
// Usamos text/plain para evitar preflight CORS em muitos cenários.
const apiGet = async (params={}) => {
  const url = API_URL + '?' + new URLSearchParams(params);
  const r = await fetch(url);
  const j = await r.json();
  if(!j.ok) throw new Error(j.error||'Erro API');
  return j.data;
};
const apiPost = async (payload={}) => {
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: {'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify(payload)
  });
  const j = await r.json();
  if(!j.ok) throw new Error(j.error||'Erro API');
  return j.data;
};

const apiList     = () => apiGet({action:'list'});
const apiLookup   = (protocolo) => apiGet({action:'lookup', protocolo});
const apiCreate   = (data) => apiPost({action:'create', data});
const apiUpdate   = (id, fields) => apiPost({action:'update', id, fields});
const apiDelete   = (id) => apiPost({action:'delete', id});

/* ====== USER PAGE ====== */
function initUser(){
  const form = $('#formChamado');
  const confirmCard = $('#confirmCard');
  const confirmText = $('#confirmText');
  const novoBtn = $('#novoChamadoBtn');

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
      if(!chamado.nome || !chamado.email || !chamado.setor || !chamado.problema){ toast('Preencha todos os campos.'); return; }

      try{
        const created = await apiCreate(chamado);
        form.reset();
        if(confirmCard && confirmText){
          confirmCard.hidden = false;
          confirmText.textContent = `Seu protocolo é ${created.protocolo}. Guarde este código para acompanhar.`;
        }
        toast('Chamado aberto!');
      }catch(err){
        console.error(err);
        toast('Falha ao abrir chamado.');
      }
    });
  }

  novoBtn?.addEventListener('click', ()=>{ if(confirmCard) confirmCard.hidden = true; });

  // Se você adicionou a seção "Consultar status por protocolo" no index.html:
  const consultarBtn = $('#consultarBtn');
  const inputProt = $('#consultaProtocolo');
  consultarBtn?.addEventListener('click', async ()=>{
    const prot = (inputProt.value||'').trim();
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

/* ====== ADMIN PAGE ====== */
function initAdmin(){
  const loginCard = $('#loginCard');
  const dashCard  = $('#dashboardCard');

  $('#entrarBtn')?.addEventListener('click', ()=>{
    const val = $('#pinInput').value.trim();
    if(!val){ toast('Informe um PIN.'); return; }
    // PIN simples local (não muda com Sheets)
    const stored = localStorage.getItem('ti_pin');
    if(!stored){ localStorage.setItem('ti_pin', val); }
    else if(stored !== val){ toast('PIN incorreto.'); return; }

    if(loginCard && dashCard){ loginCard.hidden = true; dashCard.hidden = false; }
    renderAdmin();
  });

  $('#busca')?.addEventListener('input', renderAdmin);
  $('#filtroStatus')?.addEventListener('change', renderAdmin);
  $('#filtroPrio')?.addEventListener('change', renderAdmin);

  $('#exportCsvBtn')?.addEventListener('click', async ()=>{
    try{
      const dados = await apiList();
      if(!dados.length) return toast('Nada para exportar.');
      const header = ['protocolo','status','prioridade','categoria','nome','email','setor','problema','criadoEm','atualizadoEm'];
      const lines = [header.join(',')];
      dados.forEach(r=>{
        lines.push([r.protocolo,r.status,r.prioridade,r.categoria,r.nome,r.email,r.setor,r.problema,
          new Date(r.criadoEm).toLocaleString('pt-BR'),
          r.atualizadoEm ? new Date(r.atualizadoEm).toLocaleString('pt-BR') : ''
        ].map(x=>`"${String(x).replaceAll('"','""')}"`).join(','));
      });
      const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8;'}));
      a.download=`chamados_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    }catch(err){ console.error(err); toast('Erro ao exportar.'); }
  });

  $('#limparTudoBtn')?.addEventListener('click', ()=>{
    toast('Para apagar tudo de uma vez, use a planilha (mais rápido).');
  });
}

async function renderAdmin(){
  const lista = $('#listaChamados');
  const vazio = $('#vazio');
  if(lista) lista.innerHTML = '<p class="muted">Carregando…</p>';

  let dados = [];
  try{ dados = await apiList(); }
  catch(err){ console.error(err); toast('Erro ao carregar chamados.'); if(lista) lista.innerHTML=''; return; }

  // KPIs
  $('#kpiTotal') && ($('#kpiTotal').textContent = dados.length);
  $('#kpiAbertos') && ($('#kpiAbertos').textContent = dados.filter(x=>x.status==='Aberto').length);
  $('#kpiAndamento') && ($('#kpiAndamento').textContent = dados.filter(x=>x.status==='Em andamento').length);
  $('#kpiConcluidos') && ($('#kpiConcluidos').textContent = dados.filter(x=>x.status==='Concluído').length);

  // Filtros
  const termo = ($('#busca')?.value || '').toLowerCase();
  const st = $('#filtroStatus')?.value || 'Todos';
  const pr = $('#filtroPrio')?.value || 'Todas';

  if(st!=='Todos') dados = dados.filter(x=>x.status===st);
  if(pr!=='Todas') dados = dados.filter(x=>x.prioridade===pr);
  if(termo){
    dados = dados.filter(x=>
      x.protocolo.toLowerCase().includes(termo) ||
      x.nome.toLowerCase().includes(termo) ||
      x.setor.toLowerCase().includes(termo) ||
      x.email.toLowerCase().includes(termo) ||
      x.problema.toLowerCase().includes(termo)
    );
  }
  dados.sort((a,b)=> new Date(b.criadoEm) - new Date(a.criadoEm));

  if(lista) lista.innerHTML = '';
  if(!dados.length){ if(vazio) vazio.hidden=false; return; } else { if(vazio) vazio.hidden=true; }

  dados.forEach(item=>{
    const li = document.createElement('li');
    li.className = 'ticket';
    const prioClass = {Baixa:'prio-baixa','Média':'prio-media','Alta':'prio-alta','Crítica':'prio-critica'}[item.prioridade] || 'prio-media';
    const statusClass = {Aberto:'status-aberto','Em andamento':'status-andamento','Concluído':'status-concluido'}[item.status] || 'status-aberto';

    li.innerHTML = `
      <div class="ticket-head">
        <div class="badges">
          <span class="badge ${statusClass}">${item.status}</span>
          <span class="badge ${prioClass}">Prioridade: ${item.prioridade}</span>
          <span class="badge">Prot.: ${item.protocolo}</span>
          <span class="badge">Categoria: ${item.categoria}</span>
        </div>
      </div>
      <div class="ticket-body">
        <strong>${item.nome}</strong> • ${item.setor} • <a href="mailto:${item.email}">${item.email}</a>
        <p style="margin:.35rem 0 0">${item.problema}</p>
      </div>
      <div class="ticket-meta">
        Aberto em ${new Date(item.criadoEm).toLocaleString('pt-BR')}
        ${item.atualizadoEm ? ' • Atualizado: '+ new Date(item.atualizadoEm).toLocaleString('pt-BR') : ''}
      </div>
      <div class="ticket-actions">
        ${item.status!=='Em andamento' ? `<button class="btn" data-ac="andamento" data-id="${item.id}">Iniciar</button>`:''}
        ${item.status!=='Concluído' ? `<button class="btn" data-ac="concluir" data-id="${item.id}">Concluir</button>`:''}
        <button class="btn" data-ac="editar" data-id="${item.id}">Editar</button>
        <button class="btn ghost" data-ac="remover" data-id="${item.id}">Excluir</button>
      </div>
    `;
    lista && lista.appendChild(li);
  });

  // Ações dos botões
  if(lista){
    lista.onclick = async (e)=>{
      const btn = e.target.closest('button[data-ac]'); if(!btn) return;
      const ac = btn.dataset.ac, id = btn.dataset.id;
      try{
        if(ac==='remover'){
          if(confirm('Excluir este chamado?')){ await apiDelete(id); toast('Chamado excluído.'); renderAdmin(); }
        } else if(ac==='andamento'){
          await apiUpdate(id, {status:'Em andamento'}); toast('Status alterado.'); renderAdmin();
        } else if(ac==='concluir'){
          await apiUpdate(id, {status:'Concluído'}); toast('Chamado concluído.'); renderAdmin();
        } else if(ac==='editar'){
          // Carrega dados atuais e abre modal
          const item = (await apiList()).find(x=>x.id===id);
          $('#editId').value = item.id;
          $('#editNome').value = item.nome;
          $('#editEmail').value = item.email;
          $('#editSetor').value = item.setor;
          $('#editPrioridade').value = item.prioridade;
          $('#editStatus').value = item.status;
          $('#editCategoria').value = item.categoria;
          $('#editProblema').value = item.problema;
          $('#editModal').showModal();
        }
      }catch(err){ console.error(err); toast('Falha na ação.'); }
    };
  }

  // Salvar edições (modal)
  $('#salvarEdicaoBtn')?.addEventListener('click', async ()=>{
    const id = $('#editId').value;
    const fields = {
      nome: $('#editNome').value.trim(),
      email: $('#editEmail').value.trim(),
      setor: $('#editSetor').value.trim(),
      prioridade: $('#editPrioridade').value,
      status: $('#editStatus').value,
      categoria: $('#editCategoria').value.trim(),
      problema: $('#editProblema').value.trim()
    };
    try{
      await apiUpdate(id, fields);
      $('#editModal').close();
      toast('Chamado atualizado.');
      renderAdmin();
    }catch(err){ console.error(err); toast('Erro ao salvar.'); }
  });
}

/* ====== Boot ====== */
const page = document.body.dataset.page;
if(page==='user') initUser();
if(page==='admin') initAdmin();

