/* ====== Config ====== */
const COMPANY_NAME = 'Safári Diversão • TI';
const API_URL = 'https://script.google.com/macros/library/d/1920wa1gWYGVcDir42ph6UvZbjOTdchDaUUNUCtOF9SQC7xccm25VZ1th/2';

document.getElementById('companyName').textContent = COMPANY_NAME;
document.getElementById('year').textContent = new Date().getFullYear();

/* ====== Helpers ====== */
const $ = (s) => document.querySelector(s);
const toast = (msg, ms=1800) => {
  const t = $('#toast'); if(!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), ms);
};
// >>> fmtBR fora do toast (disponível para todo o arquivo)
const fmtBR = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : '';

/* Copiar com fallback (funciona sem HTTPS) */
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

/* ====== API (Apps Script) ====== */
const apiGet  = async (params={}) => {
  const r = await fetch(API_URL + '?' + new URLSearchParams(params));
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

const apiList   = () => apiGet({action:'list'});
const apiLookup = (protocolo) => apiGet({action:'lookup', protocolo});
const apiCreate = (data) => apiPost({action:'create', data});
const apiUpdate = (id, fields) => apiPost({action:'update', id, fields});
const apiDelete = (id) => apiPost({action:'delete', id});

/* =========================
   PÁGINA DO USUÁRIO
========================= */
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

        // Mostrar protocolo no card (compatível com dois layouts)
        if ($('#protocoloText')) {
          $('#protocoloText').textContent = created.protocolo;
          $('#confirmCard').hidden = false;
        } else if ($('#confirmCard') && $('#confirmText')) {
          $('#confirmCard').hidden = false;
          $('#confirmText').innerHTML =
            `Seu protocolo é <strong>${created.protocolo}</strong>. Guarde este código para acompanhar.`;
        }

        // Mostrar prazo (se existir no retorno e se o HTML tiver os elementos)
        if (created.prazoEm && $('#prazoText') && $('#confirmPrazo')) {
          $('#prazoText').textContent = fmtBR(created.prazoEm);
          $('#confirmPrazo').hidden = false;
        } else if ($('#confirmPrazo')) {
          $('#confirmPrazo').hidden = true;
        }

        // Guardar para botão "Copiar"
        window.__ultimoProtocolo = created.protocolo;

        toast('Chamado aberto!');
      }catch(err){
        console.error(err);
        toast('Falha ao abrir chamado.');
      }
    });
  }

  // Copiar protocolo
  $('#copiarProtocoloBtn')?.addEventListener('click', ()=>{
    const viaState  = window.__ultimoProtocolo;
    const viaStrong = $('#protocoloText')?.textContent;
    const viaRegex  = ( ($('#confirmText')?.textContent || '').match(/(CH-\d{6}-\d{3,}|TI-\d{8}-\d{3,4})/) || [] )[0];
    const codigo = viaState || viaStrong || viaRegex || '';
    if(!codigo){ toast('Nenhum protocolo para copiar.'); return; }
    copiar(codigo).then(()=> toast('Protocolo copiado!'));
  });

  // Abrir outro chamado
  $('#novoChamadoBtn')?.addEventListener('click', ()=>{
    $('#confirmCard').hidden = true;
  });

  // Consultar status
  $('#consultarBtn')?.addEventListener('click', async ()=>{
    const prot = ($('#consultaProtocolo').value||'').trim();
    if(!prot) return toast('Informe o protocolo.');
    try{
      const item = await apiLookup(prot);
      renderConsulta(item || null);
    }catch(err){ console.error(err); toast('Erro ao consultar.'); }
  });
}

function renderConsulta(chamado){
  const box = $('#consultaResultado');
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
        ${chamado.prazoEm ? `<span class="badge">Prazo: ${fmtBR(chamado.prazoEm)}</span>` : ``}
      </div>
    </div>
    <div class="ticket-body">
      <strong>${chamado.nome}</strong> • ${chamado.setor} • <a href="mailto:${chamado.email}">${chamado.email}</a>
      <p style="margin:.35rem 0 0">${chamado.problema}</p>
    </div>
    <div class="ticket-meta">
      Aberto em ${fmtBR(chamado.criadoEm)}
      ${chamado.atualizadoEm ? ' • Atualizado: '+ fmtBR(chamado.atualizadoEm) : ''}
    </div>
  `;
}

/* =========================
   PAINEL DO TI (ADMIN)
========================= */
function initAdmin(){
  const loginCard = $('#loginCard');
  const dashCard  = $('#dashboardCard');
  const DEFAULT_PIN = 'agua3214';

  // Reset rápido via URL: .../ti.html?resetpin=1
  const qs = new URLSearchParams(location.search);
  if (qs.get('resetpin') === '1') {
    localStorage.removeItem('ti_pin');
  }
  // Garante um PIN salvo (usa o padrão se não houver)
  if (!localStorage.getItem('ti_pin')) {
    localStorage.setItem('ti_pin', DEFAULT_PIN);
  }

  // Entrar
  $('#entrarBtn')?.addEventListener('click', ()=>{
    const val = ($('#pinInput')?.value || '').trim();
    if(!val){ toast('Informe o PIN.'); return; }
    const saved = localStorage.getItem('ti_pin') || DEFAULT_PIN;
    if (val !== saved) { toast('PIN incorreto. Dica: agua3214 ou use ?resetpin=1'); return; }
    if(loginCard && dashCard){ loginCard.hidden = true; dashCard.hidden = false; }
    renderAdmin();
    toast('Bem-vindo!');
  });

  // Enter no campo também entra
  $('#pinInput')?.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'){ e.preventDefault(); $('#entrarBtn')?.click(); }
  });

  // Filtros & botões
  $('#busca')?.addEventListener('input', renderAdmin);
  $('#filtroStatus')?.addEventListener('change', renderAdmin);
  $('#filtroPrio')?.addEventListener('change', renderAdmin);

  $('#exportCsvBtn')?.addEventListener('click', async ()=>{
    try{
      const dados = await apiList();
      if(!dados.length) return toast('Nada para exportar.');
      const header = ['protocolo','status','prioridade','categoria','nome','email','setor','problema','criadoEm','atualizadoEm','prazoEm'];
      const rows = [header.join(',')];
      dados.forEach(r=>{
        rows.push([r.protocolo,r.status,r.prioridade,r.categoria,r.nome,r.email,r.setor,r.problema,
          fmtBR(r.criadoEm),
          r.atualizadoEm ? fmtBR(r.atualizadoEm) : '',
          r.prazoEm ? fmtBR(r.prazoEm) : ''
        ].map(x=>`"${String(x).replaceAll('"','""')}"`).join(','));
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
      a.download = `chamados_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
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
  catch(e){ console.error(e); toast('Erro ao carregar chamados.'); if(lista) lista.innerHTML=''; return; }

  // KPIs
  $('#kpiTotal')     && ($('#kpiTotal').textContent     = dados.length);
  $('#kpiAbertos')   && ($('#kpiAbertos').textContent   = dados.filter(x=>x.status==='Aberto').length);
  $('#kpiAndamento') && ($('#kpiAndamento').textContent = dados.filter(x=>x.status==='Em andamento').length);
  $('#kpiConcluidos')&& ($('#kpiConcluidos').textContent= dados.filter(x=>x.status==='Concluído').length);

  // filtros
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

  if(lista) lista.innerHTML='';
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
          ${item.prazoEm ? `<span class="badge">Prazo: ${fmtBR(item.prazoEm)}</span>` : ``}
        </div>
      </div>
      <div class="ticket-body">
        <strong>${item.nome}</strong> • ${item.setor} • <a href="mailto:${item.email}">${item.email}</a>
        <p style="margin:.35rem 0 0">${item.problema}</p>
      </div>
      <div class="ticket-meta">
        Aberto em ${fmtBR(item.criadoEm)}
        ${item.atualizadoEm ? ' • Atualizado: '+ fmtBR(item.atualizadoEm) : ''}
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
if(page==='user')  initUser();
if(page==='admin') initAdmin();



