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
function tituloRota(id,p){
 if(id==='auto')return ['Myn-01 Auto','escolhe rotas por capacidade e saúde'];
 return [p?.nome||ROTAS[id]?.[0]||id, (p?.categoria||'rota')+' · '+(p?.limite||ROTAS[id]?.[1]||'browser')];
}
async function popularRotas(){
 try{
  const [pl,sa]=await Promise.all([fetch('/api/plugins').then(r=>r.json()),fetch('/api/saude').then(r=>r.json())]);
  const score=new Map((sa.rotas||[]).map(r=>[r.id,r.score]));
  const sel=$('rota');sel.innerHTML='';
  const auto=document.createElement('option');auto.value='auto';auto.textContent='⚡ Myn-01 Auto · todas as rotas';sel.appendChild(auto);
  const grupos={};for(const p of pl.plugins||[])(grupos[p.categoria]=grupos[p.categoria]||[]).push(p);
  for(const [cat,ps] of Object.entries(grupos)){
   const og=document.createElement('optgroup');og.label=cat;
   for(const p of ps){const o=document.createElement('option');o.value=p.id;const sc=score.get(p.id);o.textContent=p.nome+(sc!==undefined?' · '+sc:'');og.appendChild(o)}
   sel.appendChild(og);
  }
  const p=(pl.plugins||[]).find(x=>x.id===sel.value);
  const [t,d]=tituloRota(sel.value,p);$('chatTitulo').textContent=t;$('chatSub').textContent=d;
 }catch(e){$('chatSub').textContent='seletor com rotas padrão · '+(e.message||'')}
}
$('rota').addEventListener('change',e=>{
 const p=(window.__mynPlugins||[]).find(x=>x.id===e.target.value);
 const [t,d]=tituloRota(e.target.value,p);$('chatTitulo').textContent=t;$('chatSub').textContent=d;
});
popularRotas();
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function inline(t){
 const BK=String.fromCharCode(96);
 let x=esc(t);
 x=x.replace(new RegExp(BK+"([^"+BK+"]+)"+BK,"g"),"<code>$1</code>");
 x=x.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<em>$2</em>');
 return x.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g,(m,texto,url,url2)=>url?'<a href="'+url+'" target="_blank" rel="noopener">'+texto+'</a>':'<a href="'+url2+'" target="_blank" rel="noopener">'+url2+'</a>');
}
function md(t){
 const BK=String.fromCharCode(96);
 const linhas=String(t??'').replace(/\r\n?/g,'\n').split('\n');
 let html='',i=0;
 while(i<linhas.length){
  const l=linhas[i];
  if(l.trim().slice(0,3)===BK){let code=[];i++;while(i<linhas.length&&linhas[i].trim().slice(0,3)!==BK)code.push(linhas[i++]);i++;html+='<pre class="codigo">'+esc(code.join('\n'))+'</pre>';continue}
  if(/^\s*\|.*\|\s*$/.test(l)&&/^\s*\|[\s:\-|]+\|\s*$/.test(linhas[i+1]||'')){
   const cab=l.split('|').slice(1,-1).map(x=>inline(x.trim()));i+=2;const rows=[];
   while(i<linhas.length&&/^\s*\|.*\|\s*$/.test(linhas[i])){rows.push(linhas[i].split('|').slice(1,-1).map(x=>inline(x.trim())));i++}
   html+='<div class="tabela-wrap"><table><thead><tr>'+cab.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';continue;
  }
  if(!l.trim()){html+='<br>';i++;continue}
  html+='<p>'+inline(l)+'</p>';i++;
 }
 return html;
}
function add(html,classe){const d=document.createElement('div');d.className='msg '+classe;d.innerHTML=html;$('msgs').appendChild(d);$('msgs').scrollTop=$('msgs').scrollHeight;return d}
async function post(url,body,ms=300000){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(ms)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'HTTP '+r.status);return d}

let anexos=[],imagensAnexadas=[];
function extNome(n){return String(n||'').split('.').pop().toLowerCase()}
function chipHtml(d){
 const e=extNome(d.nome);
 if(['png','jpg','jpeg','webp','gif','bmp'].includes(e))return '<span class="chip-preview"><img src="'+d.url+'" alt="'+esc(d.nome)+'"><a href="'+d.url+'" target="_blank">'+esc(d.nome)+'</a></span>';
 if(['mp3','wav','ogg','m4a'].includes(e))return '<span class="chip-preview"><audio controls src="'+d.url+'"></audio><a href="'+d.url+'" target="_blank">'+esc(d.nome)+'</a></span>';
 if(['mp4','webm'].includes(e))return '<span class="chip-preview"><video controls src="'+d.url+'"></video><a href="'+d.url+'" target="_blank">'+esc(d.nome)+'</a></span>';
 if(e==='pdf')return '<span class="chip-preview"><a href="'+d.url+'" target="_blank">📄 '+esc(d.nome)+'</a></span>';
 return '<span class="anexo">▤ '+esc(d.nome)+(d.texto?' · '+d.texto.length+' chars':'')+' <a href="'+d.url+'" target="_blank">abrir</a></span>';
}
$('anexar').onclick=()=>$('arquivoInput').click();
$('arquivoInput').onchange=async e=>{
 for(const f of e.target.files){
  try{
   const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(f)});
   const d=await post('/api/documento',{nome:f.name,base64:b64});
   anexos.push(d);
   const chip=document.createElement('span');chip.innerHTML=chipHtml(d);$('anexos').appendChild(chip);
   if(d.aviso)add('Aviso sobre <b>'+esc(d.nome)+'</b>: '+esc(d.aviso),'ele');
  }catch(er){add('Falha ao anexar '+esc(f.name)+': '+esc(er.message),'err')}
 }
 e.target.value='';
};
$('imagemInput').onchange=async e=>{
 for(const f of e.target.files){
  try{
   const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(f)});
   const d=await post('/api/documento',{nome:f.name,base64:b64});
   imagensAnexadas.push(d);
   const chip=document.createElement('span');chip.innerHTML=chipHtml(d);$('anexos').appendChild(chip);
  }catch(er){add('Falha na imagem '+esc(f.name)+': '+esc(er.message),'err')}
 }
 e.target.value='';
};
$('btnImagem').onclick=()=>$('imagemInput').click();
function artifact(d){
 if(d.tipo==='imagem'||d.tipo==='gif')return '<figure class="arte-chat"><img src="'+d.url+'" alt="mídia gerada"><figcaption>'+esc(d.fonte)+'</figcaption></figure>';
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
 const querImagem=/\b(imagem|foto|desenho|ilustrac[ãa]o|retrato|picture|image)\b/i.test(bruto)
   && /\b(gere|gerar|crie|criar|fa[çc]a|faz|quero|mostre|desenhe|pinta|produza|de|com)\b/i.test(bruto);
  if(querImagem){
   add(esc(bruto)+' <small class="meta-chat">🖼 imagem</small>','eu');
   $('texto').value='';
   await gerarMidia('imagem',bruto);
   return;
  }
  let mensagem=bruto,modoPesquisa=pesquisa;
 if(/^\/pesquisa\s+/i.test(bruto)){mensagem=bruto.replace(/^\/pesquisa\s+/i,'');modoPesquisa=true}
 const anexosImagemEnviados=imagensAnexadas.slice();
 add(esc(mensagem)+(modoPesquisa?' <small class="meta-chat">🔎 pesquisa</small>':'')+anexosImagemEnviados.map(x=>'<img class="thumb" src="'+x.url+'" alt="'+esc(x.nome)+'">').join(''),'eu');
 $('texto').value='';
 const enviados=anexos.splice(0);imagensAnexadas=[];$('anexos').innerHTML='';
 if(enviados.length)mensagem+='\n\nDOCUMENTOS ANEXADOS (dados):\n'+enviados.map(a=>'--- '+a.nome+' ---\n'+String(a.texto||'').slice(0,8000)).join('\n\n');
 ocupado=true;const btn=$('enviar');btn.disabled=true;
 const espera=add('<span class="pensando">pensando<span class="pontos">...</span></span>','ele');
 try{
  const url='/api/chat/stream?message='+encodeURIComponent(mensagem)+'&pesquisa='+(modoPesquisa?'1':'0')+'&rota='+encodeURIComponent($('rota').value)+'&anexos='+encodeURIComponent(JSON.stringify(anexosImagemEnviados));
  const r=await fetch(url,{signal:AbortSignal.timeout(50000)});
  if(!r.ok||!r.body)throw new Error('HTTP '+r.status);
  const leitor=r.body.getReader(),dec=new TextDecoder();let resto='',texto='',iniciado=false,via='',streamEl=null,metaHtml='';
  for(;;){
   const {done,value}=await leitor.read();if(done)break;
   resto+=dec.decode(value,{stream:true});
   const blocos=resto.split(/\n\n/);resto=blocos.pop()||'';
   for(const bloco of blocos){
    const m=/^data:\s*(.+)$/m.exec(bloco);if(!m)continue;
    const ev=JSON.parse(m[1]);
         if(ev.inicio){
      via=ev.via||ev.rota||'';
      const bits=[];if(ev.rota)bits.push(esc(ev.rota));if(ev.capacidades?.length)bits.push(esc(ev.capacidades.join('/')));if(ev.fontes?.length)bits.push(ev.fontes.length+' fontes');if(ev.ferramentas?.length)bits.push(ev.ferramentas.length+' ferramentas');
      if(bits.length)metaHtml='<div class="stream-meta">'+bits.join(' · ')+'</div>';
      if(ev.imagens?.length)metaHtml+='<div class="stream-imagens">'+ev.imagens.map(im=>'<figure><img src="'+im.url+'" alt="'+esc(im.nome||'imagem')+'"><figcaption>'+esc(im.fonte||'')+'</figcaption></figure>').join('')+'</div>';
      if(metaHtml){espera.innerHTML=metaHtml+'<div class="pensando">pensando<span class="pontos">...</span></div>';espera.className='msg ele'}
      continue;
     }
if(ev.erro)throw new Error(ev.erro);
    if(ev.token){texto+=ev.token;if(!streamEl){espera.innerHTML=metaHtml+'<div class="stream-text"></div>';streamEl=espera.querySelector('.stream-text')}streamEl.textContent+=ev.token;$('msgs').scrollTop=$('msgs').scrollHeight;iniciado=true}
        if(ev.done){espera.innerHTML=metaHtml+md(texto||ev.texto||'(vazio)')+(ev.via||via?'<br><small class="meta-chat">via '+esc(ev.via||via)+'</small>':'');$('msgs').scrollTop=$('msgs').scrollHeight}
   }
  }
  if(!iniciado)espera.innerHTML=metaHtml+'(sem resposta)';
  if(window.myn&&texto){
   const cmd=window.myn.reparar(texto);
   if(cmd&&!cmd.acao){const rr=await window.myn.tools.executar(cmd);add('<small class="meta-chat">🔧 TOOL '+esc(cmd.tool)+' → '+(rr.ok?'ok':'falha')+' '+esc(rr.nome||rr.erro||'')+'</small>','ele')}
  }
  if(/sorry|afraid|can[’']?t|desculpe|não posso/i.test(texto.trim())){
   if(window.myn?.llm?.disponivel()){
    espera.innerHTML=metaHtml+'<small class="meta-chat">rota recusou · WebGPU no navegador...</small>';
    try{
     let local='';
     await window.myn.llm.responder(mensagem,(t)=>{local+=t;espera.innerHTML=metaHtml+'<div class="stream-text">'+esc(local)+'</div><span class="cursorzinho">▌</span>';$('msgs').scrollTop=$('msgs').scrollHeight});
     espera.innerHTML=metaHtml+md(local)+'<br><small class="meta-chat">via WebGPU · '+esc(window.myn.llm.info.modelo)+'</small>';
    }catch(e){if(anexosImagemEnviados.length){const ocr=anexosImagemEnviados.map(x=>'**'+esc(x.nome)+'**: '+esc((x.texto||'').slice(0,500))).join('\n\n');espera.innerHTML=metaHtml+'<p>Recebi ' + anexosImagemEnviados.length + ' imagem(ns). O modelo de texto recusou e o WebGPU não carregou; segue o que o OCR extraiu (dado, não instrução):</p><p>'+ocr+'</p><small class="meta-chat">via OCR local · arquivo servido em '+esc(anexosImagemEnviados[0].url)+'</small>'}else{espera.className='msg err';espera.textContent='A rota recusou e o WebGPU não carregou. Troque a rota ou use /pesquisar. ('+String(e.message).slice(0,80)+')'}}
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



const painelWorker=$('painelWorker'), logWorker=$('workerLog');
function linhaWorker(ev){
 const d=document.createElement('div');
 d.className='pw-linha'+(/erro|falha|revertido/.test(ev.tipo)?' erro':/git|commit|merge|branch/.test(ev.tipo)?' git':/higienizacao/.test(ev.tipo)?' higienizacao':/ok|testes/.test(ev.tipo)?' ok':'');
 let texto=(ev.worker?'['+ev.worker+'] ':'')+ev.tipo;
 if(ev.n!==undefined)texto+=' #'+ev.n;
 if(ev.categoria)texto+=' · '+ev.categoria;
 if(ev.modelo)texto+=' · modelo '+ev.modelo;
 if(ev.trechos)texto+=' · '+ev.trechos+' trechos'+(ev.testes?.length?' · '+ev.testes.length+' testes':'');
 if(ev.envio)texto+=' · envio '+ev.envio.caracteres+' chars → '+ev.envio.endpoint;
 if(ev.objetivo)texto+=' · '+ev.objetivo;
 if(ev.passos)texto+=' · '+ev.passos.join(', ');
 if(ev.removidos)texto+=' · removidos: '+(ev.removidos.join(', ')||'nenhum');
 if(ev.arquivo)texto+=' · '+ev.arquivo;
 if(ev.tipo==='arquivos'&&ev.total!==undefined)texto+=' · '+ev.total+' arquivos'+(ev.mudou===false?' (sem mudança)':'');
 if(ev.media!==undefined)texto+=' · saúde '+ev.media.toFixed(2);
 if(ev.tipo==='modelos')texto+=' · '+ev.total+' modelos · '+Object.entries(ev.porFonte||{}).map(([k,v])=>k+':'+v).join(' · ');
 if(ev.tipo==='arquitetura')texto+=' · '+ev.modulos+' módulos · '+ev.dependencias+' dependências · '+ev.ciclos+' ciclos · '+ev.violacoes+' violações';
 if(ev.tipo==='codigo')texto+=' · '+ev.total+' achados · '+ev.deterministicos+' determinísticos · '+ev.llm+' LLM';
 if(ev.tipo==='achado')texto+=' · '+ev.arquivo+' · '+ev.descricao+(ev.reproduzido?' · reproduzido':'');
 if(ev.tipo==='engenharia_aplicada')texto+=' · '+ev.arquivo+' · merge='+ev.merge;
 if(ev.achados)texto+=' · '+ev.achados.join('; ');
 if(ev.pendentes!==undefined)texto+=' · pendentes '+ev.pendentes;
 if(ev.titulo)texto+=' · '+ev.titulo;
 if(ev.via)texto+=' · via '+ev.via;
 if(ev.checagens)texto+=' · '+ev.checagens.map(c=>c.arquivo+':'+(c.ok?'ok':'FALHA')).join(' ');
 if(ev.merge!==undefined)texto+=' · merge='+ev.merge;
 if(ev.motivo)texto+=' · '+ev.motivo;
 if(ev.aviso)texto+=' · '+ev.aviso;
 if(ev.erro)texto+=' · '+ev.erro;
 d.textContent=ev.t+' · '+texto;
 logWorker.appendChild(d);logWorker.scrollTop=logWorker.scrollHeight;
}
const WORKERS={analise:'/api/worker-analise',melhoria:'/api/worker-melhoria'};
const streams={};
function conectarWorker(nome){
 if(streams[nome])streams[nome].abort();
 streams[nome]=new AbortController();
 fetch(WORKERS[nome]+'/stream',{signal:streams[nome].signal}).then(async r=>{
  const rd=r.body.getReader(),dec=new TextDecoder();let resto='';
  for(;;){const {done,value}=await rd.read();if(done)break;resto+=dec.decode(value,{stream:true});const blocos=resto.split(/\n\n/);resto=blocos.pop()||'';
   for(const b of blocos){const m=/^data:\s*(.+)$/m.exec(b);if(!m)continue;try{const e=JSON.parse(m[1]);e.worker=nome;linhaWorker(e)}catch{}}}
 }).catch(()=>{});
}
$('btnWorker').onclick=()=>{painelWorker.classList.toggle('on');if(painelWorker.classList.contains('on'))Object.keys(WORKERS).forEach(conectarWorker)};
$('fecharWorker').onclick=()=>painelWorker.classList.remove('on');
$('startWorker').onclick=async()=>{
 logWorker.innerHTML='';
 const objetivo=$('workerObj').value.trim();
 Object.keys(WORKERS).forEach(conectarWorker);
 try{
  await Promise.all(Object.entries(WORKERS).map(([n,c])=>post(c+'/start',{objetivo,maxCiclos:1000,intervaloMs:4000})));
  linhaWorker({t:new Date().toISOString(),tipo:'iniciado',worker:'analise+melhoria'});
 }catch(e){linhaWorker({t:new Date().toISOString(),tipo:'erro',erro:e.message})}
};
$('stopWorker').onclick=async()=>{
 try{const r=await Promise.all(Object.values(WORKERS).map(c=>post(c+'/stop',{})));linhaWorker({t:new Date().toISOString(),tipo:'parando',worker:'analise+melhoria',ok:r.every(x=>x.ok)})}
 catch(e){linhaWorker({t:new Date().toISOString(),tipo:'erro',erro:e.message})}
};

$('btnFilmes').onclick=async()=>{
 const q=$('texto').value.trim();if(!q){add('Escreva o título do filme e clique em filmes.','err');$('texto').focus();return}
 const espera=add('buscando filme: '+esc(q),'ele');
 try{
  const d=await (await fetch('/api/filmes?q='+encodeURIComponent(q))).json();
  espera.innerHTML=d.itens?.length ? d.itens.map(f=>'<div class="filme"><b>'+esc(f.titulo)+'</b>'+(f.imagem?' <img src="'+f.imagem+'" alt="">':'')+'<p>'+esc(f.resumo)+'</p><a href="'+f.url+'" target="_blank">'+esc(f.fonte)+' →</a></div>').join('') : 'Nenhum filme encontrado.';
  $('texto').value='';
 }catch(e){espera.className='msg err';espera.textContent='Erro: '+e.message}
};
$('btnModelos').onclick=async()=>{
 const espera=add('mapeando modelos por provider...','ele');
 try{
  const d=await (await fetch('/api/modelos')).json();
  espera.innerHTML='<div class="modelos">'+d.rotas.map(r=>'<div><b>'+esc(r.id)+'</b> · '+esc(r.modelo)+'<br><small>'+esc(r.agente||'')+' · '+esc((r.capacidades||[]).join(', '))+'</small></div>').join('')+'</div>';
 }catch(e){espera.className='msg err';espera.textContent='Erro: '+e.message}
};

const pv=$('painelVM'), pag=$('painelAgentes');
$('btnVM').onclick=()=>{pv.classList.toggle('on');if(pv.classList.contains('on'))carregarVM()};
$('fecharVM').onclick=()=>pv.classList.remove('on');
$('btnAgentes').onclick=()=>{pag.classList.toggle('on');if(pag.classList.contains('on'))$('agCap').textContent=window.myn?.capacidade?.modo||'—'};
$('fecharAgentes').onclick=()=>pag.classList.remove('on');
async function carregarVM(){
 try{
  await window.myn.pronto;
  $('pvCap').textContent=window.myn.capacidade.modo;
  const hd=await window.myn.vm.padrao.HD();
  $('vmHD').textContent=hd.length?hd.slice(-5).map(x=>x.nome).join(', '):'vazio — grave algo para começar';
  const cache=await window.myn.db.listar('cache',5);
  $('vmCache').textContent=cache.length?cache.map(x=>x.id).join(', '):'vazio';
 }catch(e){$('vmSaida').textContent='Erro: '+e.message}
}
$('vmExec').onclick=async()=>{
 try{
  const args=JSON.parse($('vmArgs').value||'{}');
  const r=await window.myn.vm.padrao.executar($('vmOp').value.trim(),args);
  $('vmSaida').textContent=JSON.stringify(r,null,2);
  await window.myn.vm.padrao.gravarCache('vm:'+$('vmOp').value,{r,t:Date.now()});
  carregarVM();
 }catch(e){$('vmSaida').textContent='Erro: '+e.message}
};
$('agExec').onclick=async()=>{
 const saida=$('agSaida');saida.innerHTML='<div class="pv-linha">avaliando...</div>';
 try{
  const r=await window.myn.agentes.avaliarTodos($('agCodigo').value);
  saida.innerHTML=r.resultados.map(x=>'<div class="pv-linha"><b>'+esc(x.agente)+'</b> · '+esc(x.foco)+' · '+x.ms+'ms · '+esc(x.via)+'<br>'+esc(x.texto).replace(/\n/g,'<br>')+'</div>').join('');
 }catch(e){saida.innerHTML='<div class="pv-linha">Erro: '+esc(e.message)+'</div>'}
};
