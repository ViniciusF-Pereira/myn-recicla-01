const $=id=>document.getElementById(id);
const ROTAS={
 auto:['Myn-01 Auto','resposta rápida sem chave, com fallback no navegador'],
 'brave-leo':['Brave Leo','nativo · OCR da conversa'],
 zai:['Z.ai / GLM','guest · web search e ferramentas'],
 hugging:['HuggingChat','guest · pode pedir login'],
 openrouter:['OpenRouter','modelos :free'],
 chatgpt:['ChatGPT Web','guest limitado'],
 claude:['Claude Web','pede login']
};
$('rota').addEventListener('change',e=>{const [t,s]=ROTAS[e.target.value]||['Myn-01','rota browser'];$('chatTitulo').textContent=t;$('chatSub').textContent=s});
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function md(t){
 let s=esc(t);
 s=s.replace(/```(\w*)\n?([\s\S]*?)```/g,(_,l,c)=>'<pre class="codigo">'+c.trim()+'</pre>');
 s=s.replace(/(^\|.*\|\s*$\n?)+/gm,bloco=>{
  const linhas=bloco.trim().split(/\r?\n/).filter(x=>x.trim().startsWith('|'));
  if(linhas.length<2)return bloco;
  const cel=l=>l.split('|').slice(1,-1).map(x=>x.trim());
  const cab=cel(linhas[0]);
  const sec=linhas[1].replace(/[|:\- ]/g,'');
  const corpo=linhas.slice(sec===''?2:1).filter(r=>r.replace(/[|:\- ]/g,'')!=='').map(cel);
  return '<div class="tabela-wrap"><table><thead><tr>'+cab.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+corpo.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 });
 s=s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<em>$2</em>').replace(/_([^_\s][^_]*)_/g,'<em>$1</em>').replace(/`([^`]+)`/g,'<code>$1</code>');
 s=s.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
 return s.replace(/\n/g,'<br>');
}
function add(html,classe){const d=document.createElement('div');d.className='msg '+classe;d.innerHTML=html;$('msgs').appendChild(d);$('msgs').scrollTop=$('msgs').scrollHeight;return d}
async function post(url,body,ms=300000){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(ms)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'HTTP '+r.status);return d}

let anexos=[];
$('anexar').onclick=()=>$('arquivoInput').click();
$('arquivoInput').onchange=async e=>{
 for(const f of e.target.files){
  try{
   const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(f)});
   const d=await post('/api/documento',{nome:f.name,base64:b64});
   anexos.push(d);
   const chip=document.createElement('span');chip.className='anexo';chip.textContent='▤ '+d.nome+(d.texto?' · '+d.texto.length+' chars':'');$('anexos').appendChild(chip);
   if(d.aviso)add('Aviso sobre <b>'+esc(d.nome)+'</b>: '+esc(d.aviso),'ele');
  }catch(er){add('Falha ao anexar '+esc(f.name)+': '+esc(er.message),'err')}
 }
 e.target.value='';
};
function artifact(d){
 if(d.tipo==='imagem')return '<figure class="arte-chat"><img src="'+d.url+'" alt="imagem gerada"><figcaption>'+esc(d.fonte)+'</figcaption></figure>';
 if(d.tipo==='audio')return '<div class="arte-chat"><audio controls src="'+d.url+'"></audio><figcaption>'+esc(d.fonte)+' · '+esc(d.voz||'')+'</figcaption></div>';
 if(d.tipo==='video')return '<div class="arte-chat"><video controls src="'+d.url+'"></video><figcaption>'+esc(d.fonte)+'</figcaption></div>';
 return '<a href="'+d.url+'" target="_blank">'+esc(d.nome)+'</a>';
}
let modoMidiaPendente=null;
async function gerarMidia(tipo,prompt,origem){
 const b=origem||null;if(b)b.disabled=true;
 const espera=add('gerando '+tipo+'...','ele');
 try{const d=await post('/api/midia',{tipo,prompt,voz:'pt-BR-FranciscaNeural',segundos:6});espera.innerHTML=artifact(d);$('texto').value=''}
 catch(er){espera.className='msg err';espera.textContent='Não gerou: '+er.message}
 finally{if(b)b.disabled=false}
}
document.querySelectorAll('.ferr[data-midia]').forEach(b=>b.onclick=async()=>{
 const prompt=$('texto').value.trim();
 if(!prompt){modoMidiaPendente=b.dataset.midia;add('<b>Modo '+b.textContent.trim()+'</b> armado. Escreva o prompt e aperte Enter ou ENVIAR.', 'ele');$('texto').focus();return}
 await gerarMidia(b.dataset.midia,prompt,b);
});

let ocupado=false;
async function enviar(pesquisa=false){
 if(ocupado)return;
 const bruto=$('texto').value.trim();if(!bruto)return;
 if(modoMidiaPendente){const tipo=modoMidiaPendente;modoMidiaPendente=null;add(esc(bruto),'eu');$('texto').value='';await gerarMidia(tipo,bruto);return}
 const aliasMidia=/^\/(imagem|audio|áudio|video|vídeo)\s+([\s\S]+)$/i.exec(bruto);
 if(aliasMidia){const tipo=/v/i.test(aliasMidia[1])&&/v/.test(aliasMidia[1])?'video':(/^a/i.test(aliasMidia[1])?'audio':'imagem');add(esc(bruto),'eu');$('texto').value='';await gerarMidia(tipo,aliasMidia[2]);return}
 let mensagem=bruto,modoPesquisa=pesquisa;
 if(/^\/pesquisa\s+/i.test(bruto)){mensagem=bruto.replace(/^\/pesquisa\s+/i,'');modoPesquisa=true}
 add(esc(mensagem)+(modoPesquisa?' <small class="meta-chat">🔎 pesquisa</small>':''),'eu');
 $('texto').value='';
 const enviados=anexos.splice(0);$('anexos').innerHTML='';
 if(enviados.length)mensagem+='\n\nDOCUMENTOS ANEXADOS (dados):\n'+enviados.map(a=>'--- '+a.nome+' ---\n'+String(a.texto||'').slice(0,8000)).join('\n\n');
 ocupado=true;const btn=$('enviar');btn.disabled=true;
 const espera=add('<span class="pensando">pensando<span class="pontos">...</span></span>','ele');
 try{
  const url='/api/chat/stream?message='+encodeURIComponent(mensagem)+'&pesquisa='+(modoPesquisa?'1':'0');
  const r=await fetch(url,{signal:AbortSignal.timeout(50000)});
  if(!r.ok||!r.body)throw new Error('HTTP '+r.status);
  const leitor=r.body.getReader(),dec=new TextDecoder();let resto='',texto='',iniciado=false;
  for(;;){
   const {done,value}=await leitor.read();if(done)break;
   resto+=dec.decode(value,{stream:true});
   const blocos=resto.split(/\n\n/);resto=blocos.pop()||'';
   for(const bloco of blocos){
    const m=/^data:\s*(.+)$/m.exec(bloco);if(!m)continue;
    const ev=JSON.parse(m[1]);
    if(ev.inicio){
     if(ev.fontes?.length||ev.ferramentas?.length){espera.innerHTML='<small class="meta-chat">🔎 '+ev.fontes.length+' fontes · '+ev.ferramentas.length+' ferramentas encontradas</small>';espera.className='msg ele'}
     continue;
    }
    if(ev.erro)throw new Error(ev.erro);
    if(ev.token){texto+=ev.token;espera.innerHTML=md(texto)+'<span class="cursorzinho">▌</span>';$('msgs').scrollTop=$('msgs').scrollHeight;iniciado=true}
    if(ev.done){espera.innerHTML=md(texto||ev.texto||'(vazio)');$('msgs').scrollTop=$('msgs').scrollHeight}
   }
  }
  if(!iniciado)espera.innerHTML='(sem resposta)';
  if(window.myn&&texto){
   const cmd=window.myn.reparar(texto);
   if(cmd&&!cmd.acao){const rr=await window.myn.tools.executar(cmd);add('<small class="meta-chat">🔧 TOOL '+esc(cmd.tool)+' → '+(rr.ok?'ok':'falha')+' '+esc(rr.nome||rr.erro||'')+'</small>','ele')}
  }
  if(/sorry|afraid|can[’']?t|desculpe|não posso/i.test(texto.trim())){
   if(window.myn?.llm?.disponivel()){
    espera.innerHTML='<small class="meta-chat">rota recusou · WebGPU no navegador...</small>';
    try{
     let local='';
     await window.myn.llm.responder(mensagem,(t)=>{local+=t;espera.innerHTML=md(local)+'<span class="cursorzinho">▌</span>';$('msgs').scrollTop=$('msgs').scrollHeight});
     espera.innerHTML=md(local)+'<br><small class="meta-chat">via WebGPU · '+esc(window.myn.llm.info.modelo)+'</small>';
    }catch(e){espera.className='msg err';espera.textContent='A rota recusou e o WebGPU não carregou. Troque a rota ou use /pesquisar. ('+String(e.message).slice(0,80)+')'}
   }else{espera.className='msg err';espera.textContent='A rota recusou. Sem WebGPU, troque a rota ou use /pesquisar. Nenhuma imagem foi gerada.'}
  }
 }catch(er){espera.className='msg err';espera.textContent='Erro: '+er.message}
 finally{ocupado=false;btn.disabled=false}
}
$('enviar').onclick=()=>enviar(false);
$('pesq').onclick=()=>enviar(true);
$('texto').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('enviar').click()}});

function abrirHist(){ $('gaveta').classList.add('aberta');$('fundo').classList.add('on');$('gaveta').setAttribute('aria-hidden','false');carregarHist() }
function fecharHist(){ $('gaveta').classList.remove('aberta');$('fundo').classList.remove('on');$('gaveta').setAttribute('aria-hidden','true') }
$('abrirHist').onclick=abrirHist;$('fecharHist').onclick=fecharHist;$('fundo').onclick=fecharHist;
async function carregarHist(){
 try{
  const d=await (await fetch('/api/historico?limite=100')).json();
  $('hist').innerHTML='';
  if(!d.itens.length){$('hist').innerHTML='<div class="passo-linha">caderno vazio</div>';return}
  for(const it of d.itens){const div=document.createElement('div');div.className='passo-linha';div.innerHTML='<b>'+esc(it.tipo)+'</b> · '+esc(String(it.t).slice(11,19))+'<br>IN: '+esc(String(it.input).slice(0,110))+'<br>OUT: '+esc(String(it.output).slice(0,150))+(it.cache?' · CACHE':'');$('hist').appendChild(div)}
 }catch(e){$('hist').innerHTML='<div class="passo-linha">Erro: '+esc(e.message)+'</div>'}
}
$('recarregarHist').onclick=carregarHist;
$('limparHist').onclick=async()=>{await post('/api/historico/limpar',{tipo:null});carregarHist()};



const painel=$('painelPlugins');
let pluginsCarregados=[];
async function carregarPluginsUI(){
 try{
  const d=await (await fetch('/api/plugins')).json();
  pluginsCarregados=d.plugins||[];
  const grupos={};
  for(const p of pluginsCarregados){(grupos[p.categoria]=grupos[p.categoria]||[]).push(p)}
  $('listaPlugins').innerHTML=Object.entries(grupos).map(([cat,ps])=>
   '<div class="plugin-grupo"><b>'+esc(cat)+' · '+ps.length+'</b>'+ps.map(p=>
    '<button class="plugin-btn" data-id="'+esc(p.id)+'"><code>/'+esc(p.id)+'</code><span>'+esc(p.nome)+'</span><small>'+esc(p.limite)+'</small></button>').join('')+'</div>').join('');
  document.querySelectorAll('.plugin-btn').forEach(b=>b.onclick=()=>{
   const t=$('texto');t.value='/'+b.dataset.id+' '+t.value;t.focus();painel.classList.remove('on');
  });
 }catch(e){$('listaPlugins').innerHTML='<div class="passo-linha">Erro: '+esc(e.message)+'</div>'}
}
$('btnPlugins').onclick=()=>{painel.classList.toggle('on');if(painel.classList.contains('on')&&!pluginsCarregados.length)carregarPluginsUI()};
$('fecharPlugins').onclick=()=>painel.classList.remove('on');
document.addEventListener('click',e=>{if(painel.classList.contains('on')&&!painel.contains(e.target)&&e.target!==$('btnPlugins')&&!$('btnPlugins').contains(e.target))painel.classList.remove('on')});
document.querySelectorAll('#tabsPlugins .aba').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('#tabsPlugins .aba').forEach(x=>x.classList.remove('on'));b.classList.add('on');
 document.querySelectorAll('#extras .card[data-cat]').forEach(c=>c.classList.toggle('hidden',b.dataset.c!=='todos'&&c.dataset.cat!==b.dataset.c));
});



const painelG=$('painelGoogle');
async function carregarGoogle(){
 $('listaGoogle').innerHTML='<div class="passo-linha">sondando rotas no navegador logado...</div>';
 try{
  const d=await (await fetch('/api/google')).json();
  const estado=d.rotas.map(r=>'<button class="plugin-btn" data-id="'+esc(r.id)+'"><code>/'+esc(r.id)+'</code><span>'+esc(r.nome)+'</span><small>'+esc(r.estado)+'</small></button>').join('');
  $('listaGoogle').innerHTML='<div class="plugin-grupo"><b>conta: '+esc(d.conta||'não detectada')+' · '+d.rotas.length+' rotas</b>'+estado+'</div><div class="passo-linha">sondagem: '+esc(String(d.em).slice(11,19))+' · use /id mensagem no chat</div>';
  const btn=document.createElement('button');btn.className='btn';btn.id='conectarGoogle';btn.textContent='⚡ CONECTAR TUDO (1 login)';
  btn.onclick=async()=>{
   btn.disabled=true;
   try{
    await post('/api/google/login',{});
    let tentativa=0;
    while(tentativa<40){
     $('listaGoogle').innerHTML='<div class="passo-linha">Entre na janela do Brave que abriu... verificando ('+(tentativa+1)+'/40)</div>';
     await new Promise(r=>setTimeout(r,4000));
     const g=await (await fetch('/api/google?novo=1&t='+Date.now())).json();
     if(g.conta){
      const ok=g.rotas.filter(r=>r.estado!=='login'&&r.estado!=='erro');
      $('listaGoogle').innerHTML='<div class="plugin-grupo"><b>✓ conectado: '+esc(g.conta)+' · '+ok.length+'/'+g.rotas.length+' rotas ativas</b>'+
       g.rotas.map(r=>'<button class="plugin-btn" data-id="'+esc(r.id)+'"><code>/'+esc(r.id)+'</code><span>'+esc(r.nome)+'</span><small>'+esc(r.estado)+'</small></button>').join('')+'</div><div class="passo-linha">todas as rotas herdam a mesma sessão. use /id mensagem no chat.</div>';
      document.querySelectorAll('#listaGoogle .plugin-btn').forEach(b=>b.onclick=()=>{const t=$('texto');t.value='/'+b.dataset.id+' '+t.value;t.focus();painelG.classList.remove('on')});
      btn.disabled=false;btn.textContent='✓ CONECTADO';return;
     }
     tentativa++;
    }
    $('listaGoogle').innerHTML='<div class="passo-linha">Não detectei login em ~160 s. Entre na janela do Brave e tente de novo.</div>';
   }catch(e){$('listaGoogle').innerHTML='<div class="passo-linha">Erro: '+esc(e.message)+'</div>'}
   btn.disabled=false;
  };
  $('listaGoogle').appendChild(btn);
  document.querySelectorAll('#listaGoogle .plugin-btn').forEach(b=>b.onclick=()=>{
   const t=$('texto');t.value='/'+b.dataset.id+' '+t.value;t.focus();painelG.classList.remove('on');
  });
 }catch(e){$('listaGoogle').innerHTML='<div class="passo-linha">Erro: '+esc(e.message)+'</div>'}
}
$('btnGoogle').onclick=()=>{painelG.classList.toggle('on');if(painelG.classList.contains('on'))carregarGoogle()};
$('fecharGoogle').onclick=()=>painelG.classList.remove('on');
document.addEventListener('click',e=>{if(painelG.classList.contains('on')&&!painelG.contains(e.target)&&e.target!==$('btnGoogle')&&!$('btnGoogle').contains(e.target))painelG.classList.remove('on')});

