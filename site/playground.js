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
$('imagemInput').onchange=async e=>{
 for(const f of e.target.files){
  try{
   const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(f)});
   const d=await post('/api/documento',{nome:f.name,base64:b64});
   imagensAnexadas.push(d);
   const chip=document.createElement('span');chip.className='chip-img';chip.innerHTML='<img src="'+d.url+'" alt="'+esc(d.nome)+'">';$('anexos').appendChild(chip);
  }catch(er){add('Falha na imagem '+esc(f.name)+': '+esc(er.message),'err')}
 }
 e.target.value='';
};
$('btnImagem').onclick=()=>$('imagemInput').click();
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

