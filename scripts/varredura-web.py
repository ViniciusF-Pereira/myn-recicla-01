#!/usr/bin/env python3
"""Varredura web escalável e retomável. Apenas leitura; não contorna login/CAPTCHA."""
from __future__ import annotations
import argparse
import concurrent.futures
import datetime as dt
import html
import io
import ipaddress
import json
import csv
import socket
import zipfile
import os
import random
import re
import shutil
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
DADOS = RAIZ / 'dados' / 'varredura-web'
DB = DADOS / 'varredura.sqlite3'
SAIDA = RAIZ / 'outputs'
UA = 'MynRecicla-WebAudit/1.2 (+https://github.com/ViniciusF-Pereira/myn-Recicla-01)'
MAX_BYTES = 600_000
META_PADRAO = 9_000_000
OPENPAGERANK_URL = 'https://openpagerank.keywordseverywhere.com/downloads/top10milliondomains.csv.zip'
HOSTS_RESERVADOS = (
    'localhost', 'local', 'localdomain', 'internal', 'intranet', 'lan',
    'home', 'corp', 'home.arpa', 'ip6.arpa', 'in-addr.arpa', 'onion',
    'test', 'invalid', 'example',
)
SEMENTES = [
    'https://www.americanas.com.br/', 'https://www.magazineluiza.com.br/',
    'https://www.casasbahia.com.br/', 'https://www.lojasrenner.com.br/',
    'https://www.mercadolivre.com.br/', 'https://www.shopee.com.br/',
    'https://www.amazon.com.br/', 'https://www.submarino.com.br/',
    'https://www.extra.com.br/', 'https://www.pontofrio.com.br/',
    'https://www.centauro.com.br/', 'https://www.netshoes.com.br/',
    'https://www.ifood.com.br/', 'https://www.uber.com/br/pt/',
]
DOMINIOS_IGNORAR = {
    'github.com', 'www.github.com', 'twitter.com', 'x.com', 'facebook.com',
    'www.facebook.com', 'instagram.com', 'www.instagram.com', 'linkedin.com',
    'www.linkedin.com', 'youtube.com', 'www.youtube.com', 'youtu.be',
    'medium.com', 'www.medium.com', 'reddit.com', 'www.reddit.com',
    'wikipedia.org', 'www.wikipedia.org', 'npmjs.com', 'www.npmjs.com',
    'pypi.org', 'www.pypi.org', 'docker.com', 'www.docker.com',
}
SINAIS = {
    'login': re.compile(r'login|log in|sign[ -]?in|sign[ -]?up|cadastre|cadastro|entrar|iniciar sess[aã]o|inicia sesi[oó]n|anmelden|connexion|registr|注册|登录', re.I),
    'captcha': re.compile(r'captcha|cloudflare|verify you are human|attention required|checking your browser|cf-chl', re.I),
    'paywall': re.compile(r'paywall|subscribe to continue|assine para continuar|upgrade to continue|conte[úu]do exclusivo|premium', re.I),
    'chat': re.compile(r'\bchat\b|chatbot|assistente|assistant|mensagem|message|prompt|conversa|conversation|nachricht|mensaje|聊天|对话', re.I),
    'gerador': re.compile(r'generate|generator|generador|gera[çc][aã]o|image generator|video generator|audio generator|text[ -]?to[ -]?speech|imagen|vid[ée]o|bild|voice', re.I),
    'loja': re.compile(r'americanas|magalu|magazine luiza|casas bahia|renner|shop|store|loja|comprar|product|checkout|carrinho', re.I),
    'atendimento': re.compile(r'atendimento|suporte|support|zendesk|intercom|tawk|jivochat|blip|whatsapp|fale conosco', re.I),
}

def agora() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()

def conectar() -> sqlite3.Connection:
    DADOS.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB, timeout=60)
    con.execute('PRAGMA journal_mode=WAL')
    con.execute('PRAGMA synchronous=NORMAL')
    con.executescript('''
      CREATE TABLE IF NOT EXISTS urls (
        id INTEGER PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        origem TEXT NOT NULL,
        fonte TEXT NOT NULL,
        prioridade INTEGER NOT NULL DEFAULT 0,
        estado TEXT NOT NULL DEFAULT 'fila',
        tentativas INTEGER NOT NULL DEFAULT 0,
        ultimo_status INTEGER,
        final TEXT,
        tipo TEXT,
        titulo TEXT,
        sinais TEXT,
        classe TEXT,
        duracao REAL,
        verificado TEXT,
        erro TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_urls_estado ON urls(estado, prioridade DESC, id);
      CREATE INDEX IF NOT EXISTS idx_urls_origem ON urls(origem);
    ''')
    return con

def _ip_publico(endereco: str) -> bool:
    if not isinstance(endereco, str) or '%' in endereco:
        return False
    try:
        ip = ipaddress.ip_address(endereco)
    except ValueError:
        return False
    return (
        ip.is_global
        and not (ip.is_multicast or ip.is_reserved or ip.is_loopback
                 or ip.is_link_local or ip.is_unspecified or ip.is_private)
    )

def _partes_url_publica(raw: str):
    if not isinstance(raw, str) or not raw or '\\' in raw:
        return None
    if any(ord(c) < 32 or ord(c) == 127 for c in raw):
        return None
    try:
        u = urllib.parse.urlsplit(raw)
        if u.scheme not in ('http', 'https') or not u.netloc or u.username or u.password:
            return None
        host = (u.hostname or '').rstrip('.').lower()
        porta = u.port
    except (ValueError, UnicodeError):
        return None
    if not host or '%' in host or porta == 0:
        return None
    try:
        host = host.encode('idna').decode('ascii')
    except (UnicodeError, ValueError):
        return None
    if len(host) > 253 or any(c.isspace() for c in host):
        return None

    ip = None
    if ':' in host:
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            return None
        if not _ip_publico(host):
            return None
    else:
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            ip = None
        if ip is not None:
            if not _ip_publico(host):
                return None
        else:
            if '.' not in host:
                return None
            if any(host == reservado or host.endswith('.' + reservado) for reservado in HOSTS_RESERVADOS):
                return None
            # Formas numéricas ambíguas não devem depender da interpretação do resolvedor.
            if re.fullmatch(r'(?:0x[0-9a-f]+|[0-9]+)(?:\.(?:0x[0-9a-f]+|[0-9]+)){0,3}', host):
                return None
        for rotulo in host.split('.'):
            if (not rotulo or len(rotulo) > 63 or rotulo.startswith('-')
                    or rotulo.endswith('-') or not re.fullmatch(r'[a-z0-9-]+', rotulo)):
                return None
    return u, host, porta, ip

def limpar_url(raw: str) -> str | None:
    raw = html.unescape(raw.strip().strip('`<>"\'')).rstrip('.,;:!?)]}')
    partes = _partes_url_publica(raw)
    if not partes:
        return None
    u, host, porta, _ = partes
    if host in DOMINIOS_IGNORAR or host.endswith('.github.io'):
        return None
    host_url = '[' + host + ']' if ':' in host else host
    porta_url = ':' + str(porta) if porta is not None else ''
    return urllib.parse.urlunsplit((u.scheme, host_url + porta_url, u.path or '/', u.query, ''))

def validar_url_publica(url: str, resolver=None) -> bool:
    """Valida sintaxe, IP literal e todos os endereços DNS antes de cada salto."""
    partes = _partes_url_publica(url)
    if not partes:
        return False
    _, host, porta, ip = partes
    if ip is not None:
        return True
    resolver = resolver or socket.getaddrinfo
    try:
        infos = resolver(host, porta or (443 if urllib.parse.urlsplit(url).scheme == 'https' else 80), type=socket.SOCK_STREAM)
    except (OSError, UnicodeError, ValueError):
        return False
    if not infos:
        return False
    for info in infos:
        try:
            endereco = info[4][0]
        except (IndexError, TypeError):
            return False
        if not _ip_publico(endereco):
            return False
    return True

def inserir(con: sqlite3.Connection, url: str, fonte: str, prioridade: int = 0) -> bool:
    limpa = limpar_url(url)
    if not limpa:
        return False
    origem = urllib.parse.urlsplit(limpa).scheme + '://' + urllib.parse.urlsplit(limpa).netloc
    try:
        cursor = con.execute('INSERT OR IGNORE INTO urls(url,origem,fonte,prioridade) VALUES(?,?,?,?)', (limpa, origem, fonte, prioridade))
        return cursor.rowcount == 1
    except sqlite3.Error:
        return False

class RedirecionamentoPublico(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not validar_url_publica(newurl):
            raise urllib.error.URLError('destino de redirecionamento não público recusado')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

ABRIDOR_PUBLICO = urllib.request.build_opener(RedirecionamentoPublico())

def abrir_publica(req: urllib.request.Request, timeout: int = 20):
    if not validar_url_publica(req.full_url):
        raise urllib.error.URLError('URL não pública ou inválida recusada')
    return ABRIDOR_PUBLICO.open(req, timeout=timeout)

def baixar_texto(url: str, timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/plain,text/html,*/*'})
    with abrir_publica(req, timeout=timeout) as r:
        return r.read(4_000_000).decode('utf-8', 'ignore')

def coletar(con: sqlite3.Connection, max_repos: int = 120) -> dict:
    total_antes = con.execute('SELECT COUNT(*) FROM urls').fetchone()[0]
    for u in SEMENTES:
        inserir(con, u, 'sementes-lojas', 100)
    consultas = ['awesome free ai tools', 'free ai tools', 'ai tools directory', 'awesome ai generators', 'free ai chat', 'ai websites 2026']
    repos = {}
    for q in consultas:
        try:
            req = urllib.request.Request('https://api.github.com/search/repositories?q=' + urllib.parse.quote(q) + '&sort=stars&order=desc&per_page=100', headers={'User-Agent': UA, 'Accept': 'application/vnd.github+json'})
            with abrir_publica(req, timeout=30) as r:
                dados = json.load(r)
            for item in dados.get('items', []):
                repos[item['full_name']] = item
        except Exception as e:
            print(json.dumps({'fase':'coleta','erro':str(e),'consulta':q}), flush=True)
        if len(repos) >= max_repos:
            break
    urls_fonte = 0
    for i, item in enumerate(repos.values(), 1):
        nome = item['full_name']
        branch = item.get('default_branch') or 'main'
        texto = ''
        for b in (branch, 'main', 'master'):
            try:
                texto = baixar_texto(f'https://raw.githubusercontent.com/{nome}/{b}/README.md', 15)
                if texto:
                    break
            except Exception:
                continue
        if not texto:
            continue
        encontradas = re.findall(r'https?://[^\s<>"\'\)\]]+', texto)
        for raw in encontradas:
            if inserir(con, raw, 'github:' + nome, 10):
                urls_fonte += 1
        if i % 20 == 0:
            con.commit()
            print(json.dumps({'fase':'coleta','repos_lidos':i,'urls_novas':urls_fonte}), flush=True)
    con.commit()
    total_depois = con.execute('SELECT COUNT(*) FROM urls').fetchone()[0]
    return {'repos': len(repos), 'urls_novas': urls_fonte, 'total_urls': total_depois, 'delta': total_depois - total_antes}

def coletar_tranco(con: sqlite3.Connection, limite: int = 500000) -> dict:
    total_antes = con.execute('SELECT COUNT(*) FROM urls').fetchone()[0]
    try:
        lista_id = baixar_texto('https://tranco-list.eu/top-1m-id', 30).strip()
    except Exception:
        lista_id = 'desconhecido'
    req = urllib.request.Request('https://tranco-list.eu/top-1m.csv.zip', headers={'User-Agent': UA})
    with abrir_publica(req, timeout=120) as r:
        pacote = r.read()
    novas = 0
    processados = 0
    with zipfile.ZipFile(io.BytesIO(pacote)) as z:
        nome = next((n for n in z.namelist() if n.lower().endswith('.csv')), z.namelist()[0])
        with z.open(nome) as bruto:
            texto = io.TextIOWrapper(bruto, encoding='utf-8', errors='ignore')
            for linha in csv.reader(texto):
                if not linha or not linha[0].strip().isdigit():
                    continue
                dominio = linha[1].strip().lower()
                if inserir(con, 'https://' + dominio + '/', 'tranco:' + lista_id, 5):
                    novas += 1
                processados += 1
                if processados % 5000 == 0:
                    con.commit()
                    print(json.dumps({'fase':'tranco','processados':processados,'urls_novas':novas}), flush=True)
                if processados >= limite:
                    break
    con.commit()
    total_depois = con.execute('SELECT COUNT(*) FROM urls').fetchone()[0]
    return {'lista_id': lista_id, 'processados': processados, 'urls_novas': novas, 'total_urls': total_depois, 'delta': total_depois - total_antes}

def dominio_openpagerank(linha: list[str]) -> str:
    """Aceita variações de coluna sem inventar domínio a partir do rank."""
    for campo in linha[1:]:
        candidato = campo.strip().lower().rstrip('.')
        if ('.' in candidato and len(candidato) <= 253
                and re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+', candidato)):
            return candidato
    return ''


def coletar_openpagerank(con: sqlite3.Connection, limite: int = 9_000_000) -> dict:
    total_antes = con.execute('SELECT COUNT(*) FROM urls').fetchone()[0]
    DADOS.mkdir(parents=True, exist_ok=True)
    pacote = DADOS / 'openpagerank-top10milliondomains.csv.zip'
    if not pacote.exists() or not zipfile.is_zipfile(pacote):
        req = urllib.request.Request(OPENPAGERANK_URL, headers={'User-Agent': UA})
        temporario = pacote.with_suffix('.download')
        with abrir_publica(req, timeout=180) as r, temporario.open('wb') as saida:
            shutil.copyfileobj(r, saida, length=1024 * 1024)
        temporario.replace(pacote)
    novas = 0
    processados = 0
    with zipfile.ZipFile(pacote) as z:
        nome = next((n for n in z.namelist() if n.lower().endswith('.csv')), z.namelist()[0])
        with z.open(nome) as bruto:
            texto = io.TextIOWrapper(bruto, encoding='utf-8-sig', errors='ignore')
            for linha in csv.reader(texto):
                if not linha or not linha[0].strip().isdigit():
                    continue
                dominio = dominio_openpagerank(linha)
                if dominio and inserir(con, 'https://' + dominio + '/', 'openpagerank:2026-10', 4):
                    novas += 1
                processados += 1
                if processados % 10000 == 0:
                    con.commit()
                    print(json.dumps({'fase':'openpagerank','processados':processados,'urls_novas':novas}), flush=True)
                if processados >= limite:
                    break
    con.commit()
    total_depois = con.execute('SELECT COUNT(*) FROM urls').fetchone()[0]
    return {'fonte': OPENPAGERANK_URL, 'data_lista': '2026-10', 'processados': processados, 'urls_novas': novas, 'total_urls': total_depois, 'delta': total_depois - total_antes, 'cache': str(pacote)}


def coletar_commoncrawl(con: sqlite3.Connection, tlds: list[str], max_paginas: int = 10, tamanho: int = 100) -> dict:
    indice = os.environ.get('MYN_CC_INDEX', 'CC-MAIN-2026-43')
    total_antes = con.execute('SELECT COUNT(*) FROM urls').fetchone()[0]
    novas = 0
    paginas_lidas = 0
    for tld in tlds:
        tld = tld.strip().lower().lstrip('.')
        if not re.fullmatch(r'[a-z]{2,12}', tld):
            continue
        base = f'https://index.commoncrawl.org/{indice}-index'
        params = {'url': f'*.{tld}/*', 'output': 'json', 'filter': 'status:200', 'collapse': 'urlkey', 'pageSize': str(tamanho), 'showNumPages': 'true'}
        try:
            texto = baixar_texto(base + '?' + urllib.parse.urlencode(params), 60)
        except Exception as e:
            print(json.dumps({'fase':'commoncrawl','tld':tld,'erro':str(e)}), flush=True)
            continue
        linhas = [l for l in texto.splitlines() if l.strip()]
        info = {}
        for linha in reversed(linhas):
            try:
                obj = json.loads(linha)
                if 'pages' in obj: info = obj; break
            except Exception:
                pass
        paginas = min(int(info.get('pages', 1)), max_paginas)
        for pagina in range(paginas):
            query = dict(params); query['page'] = str(pagina)
            try:
                conteudo = baixar_texto(base + '?' + urllib.parse.urlencode(query), 60)
            except Exception as e:
                print(json.dumps({'fase':'commoncrawl','tld':tld,'pagina':pagina,'erro':str(e)}), flush=True)
                continue
            for linha in conteudo.splitlines():
                try:
                    obj = json.loads(linha)
                except Exception:
                    continue
                if inserir(con, obj.get('url', ''), 'commoncrawl:' + tld, 0):
                    novas += 1
            paginas_lidas += 1
            con.commit()
            if paginas_lidas % 10 == 0:
                print(json.dumps({'fase':'commoncrawl','tld':tld,'pagina':pagina+1,'paginas_tld':paginas,'urls_novas':novas}), flush=True)
    total_depois = con.execute('SELECT COUNT(*) FROM urls').fetchone()[0]
    return {'indice': indice, 'tlds': tlds, 'paginas_lidas': paginas_lidas, 'urls_novas': novas, 'total_urls': total_depois, 'delta': total_depois - total_antes}

def limpar_texto_html(texto: str) -> str:
    if not texto:
        return ''
    limpo = re.sub(
        r'<(script|style|noscript|template)\b[^>]*>.*?(?:</\1\s*>|$)',
        ' ', texto, flags=re.I | re.S,
    )
    limpo = re.sub(r'<!--.*?-->', ' ', limpo, flags=re.I | re.S)
    limpo = re.sub(r'<[^>]+>', ' ', limpo)
    return re.sub(r'\s+', ' ', html.unescape(limpo)).strip()

def extrair_titulo(texto: str) -> str:
    m = re.search(r'<title[^>]*>(.*?)</title>', texto, re.I | re.S)
    return limpar_texto_html(m.group(1))[:300] if m else ''

def classificar(status: int, final: str, tipo: str, titulo: str, texto: str) -> tuple[str, dict]:
    sinais = {k: False for k in SINAIS}
    if status == 429:
        classe = 'rate-limit'
    elif status in (401, 403):
        classe = 'bloqueado'
    elif status in (404, 410) or status >= 500:
        classe = 'indisponivel'
    elif status >= 400:
        classe = 'indisponivel'
    elif 200 <= status < 300:
        conteudo = limpar_texto_html(titulo + ' ' + texto[:250000]).lower()
        sinais = {k: bool(v.search(conteudo)) for k, v in SINAIS.items()}
        if sinais['captcha']:
            classe = 'bloqueado'
        elif sinais['paywall']:
            classe = 'paywall'
        elif sinais['login']:
            classe = 'login'
        elif sinais['loja'] and sinais['atendimento']:
            classe = 'loja-atendimento'
        elif sinais['chat'] and not sinais['login']:
            classe = 'chat-sem-login'
        elif sinais['gerador'] and not sinais['login']:
            classe = 'gerador-sem-login'
        else:
            classe = 'sem-sinal'
    else:
        classe = 'sem-sinal'
    return classe, sinais

def testar(linha: tuple, timeout: int) -> dict:
    id_, url = linha
    inicio = time.monotonic()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*', 'Accept-Language': 'en,pt-BR;q=0.8,es;q=0.6', 'Range': 'bytes=0-599999'})
    status = None
    final = url
    tipo = ''
    titulo = ''
    texto = ''
    erro = ''
    try:
        with abrir_publica(req, timeout=timeout) as r:
            status = r.status
            final = r.geturl()
            tipo = r.headers.get('content-type', '')
            bytes_ = r.read(MAX_BYTES)
            if 'html' in tipo.lower() or 'text' in tipo.lower() or not tipo:
                texto = bytes_.decode('utf-8', 'ignore')
                titulo = extrair_titulo(texto)
                texto = limpar_texto_html(texto)
    except urllib.error.HTTPError as e:
        status = e.code
        final = e.geturl() or url
        tipo = e.headers.get('content-type', '') if e.headers else ''
        try:
            bytes_ = e.read(100000)
        except Exception:
            bytes_ = b''
        finally:
            try:
                e.close()
            except Exception:
                pass
        if 'html' in tipo.lower() or 'text' in tipo.lower() or not tipo:
            texto = bytes_.decode('utf-8', 'ignore')
            titulo = extrair_titulo(texto)
            texto = limpar_texto_html(texto)
    except Exception as e:
        erro = str(e)[:500]
    duracao = round(time.monotonic() - inicio, 3)
    if status is None:
        return {'id': id_, 'estado': 'erro', 'erro': erro, 'duracao': duracao, 'verificado': agora()}
    classe, sinais = classificar(status, final, tipo, titulo, texto)
    return {'id': id_, 'estado': 'testado', 'ultimo_status': status, 'final': final, 'tipo': tipo[:120], 'titulo': titulo, 'sinais': json.dumps(sinais, ensure_ascii=False), 'classe': classe, 'duracao': duracao, 'verificado': agora(), 'erro': erro}

def executar_testes(con: sqlite3.Connection, limite: int, workers: int, timeout: int, tamanho_lote: int = 5000, por_origem: int = 2) -> dict:
    if limite <= 0 or tamanho_lote <= 0 or por_origem <= 0:
        raise ValueError('limite, tamanho do lote e concorrência por origem devem ser positivos')
    concluidos = 0
    lotes = 0
    semaforos = {}
    bloqueio = threading.Lock()
    def executar_limitado(linha):
        host = urllib.parse.urlsplit(linha[1]).hostname or ''
        with bloqueio:
            semaforo = semaforos.setdefault(host, threading.BoundedSemaphore(por_origem))
        with semaforo:
            return testar(linha, timeout)
    inicio = time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        while concluidos < limite:
            restante = limite - concluidos
            fila = con.execute("SELECT id,url FROM urls WHERE estado='fila' ORDER BY prioridade DESC,id LIMIT ?", (min(restante, tamanho_lote),)).fetchall()
            if not fila:
                break
            lotes += 1
            futuros = {pool.submit(executar_limitado, linha): linha for linha in fila}
            for futuro in concurrent.futures.as_completed(futuros):
                try:
                    resultado = futuro.result()
                except Exception as exc:
                    resultado = {'id': futuros[futuro][0], 'estado': 'erro', 'erro': str(exc)[:500], 'duracao': 0, 'verificado': agora()}
                campos = {k: v for k, v in resultado.items() if k != 'id'}
                con.execute('UPDATE urls SET ' + ','.join(k + '=?' for k in campos) + ',tentativas=tentativas+1 WHERE id=?', (*campos.values(), resultado['id']))
                concluidos += 1
                if concluidos % 500 == 0:
                    con.commit()
                    resumo = con.execute('SELECT estado,classe,COUNT(*) FROM urls GROUP BY estado,classe').fetchall()
                    print(json.dumps({'fase':'teste','concluidos':concluidos,'lote':len(fila),'lotes':lotes,'segundos':round(time.monotonic()-inicio,1),'grupos':resumo}, ensure_ascii=False), flush=True)
            con.commit()
            semaforos.clear()
    resumo = con.execute('SELECT estado,classe,COUNT(*) FROM urls GROUP BY estado,classe').fetchall()
    return {'testados_nesta_rodada': concluidos, 'lotes': lotes, 'segundos': round(time.monotonic() - inicio, 1), 'grupos': resumo, 'fila_restante': con.execute("SELECT COUNT(*) FROM urls WHERE estado='fila'").fetchone()[0]}

def resumir(con: sqlite3.Connection, meta: int = META_PADRAO) -> dict:
    if meta <= 0:
        raise ValueError('meta deve ser positiva')
    totais = con.execute('SELECT estado,COUNT(*) FROM urls GROUP BY estado').fetchall()
    classes = con.execute('SELECT classe,COUNT(*) FROM urls WHERE estado=\'testado\' GROUP BY classe ORDER BY COUNT(*) DESC').fetchall()
    estados = dict(totais)
    tentativas = con.execute("SELECT COALESCE(SUM(tentativas),0) FROM urls WHERE estado IN ('testado','erro')").fetchone()[0]
    sites_testados = estados.get('testado', 0) + estados.get('erro', 0)
    total_urls = con.execute('SELECT COUNT(*) FROM urls').fetchone()[0]
    return {
        'atualizado': agora(), 'meta': meta, 'tentativas': tentativas, 'sites_testados': sites_testados,
        'progresso_percent': round(sites_testados / meta * 100, 2),
        'meta_atingida': total_urls > 0 and sites_testados >= meta,
        'total_urls': total_urls, 'estados': estados, 'classes': dict(classes), 'db': str(DB),
    }

def meta_positiva(valor: str) -> int:
    try:
        meta = int(valor)
    except ValueError as exc:
        raise argparse.ArgumentTypeError('meta deve ser um inteiro') from exc
    if meta <= 0:
        raise argparse.ArgumentTypeError('meta deve ser maior que zero')
    return meta

def criar_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser()
    p.add_argument('--collect', action='store_true')
    p.add_argument('--tranco', action='store_true')
    p.add_argument('--tranco-limit', type=int, default=500000)
    p.add_argument('--openpagerank', action='store_true')
    p.add_argument('--openpagerank-limit', type=int, default=9000000)
    p.add_argument('--commoncrawl', action='store_true')
    p.add_argument('--cc-tlds', default='com,net,org,io,ai,app,dev,xyz')
    p.add_argument('--cc-pages', type=int, default=10)
    p.add_argument('--cc-page-size', type=int, default=5000)
    p.add_argument('--test', action='store_true')
    p.add_argument('--limit', type=int, default=1000)
    p.add_argument('--batch-size', type=int, default=5000)
    p.add_argument('--workers', type=int, default=64)
    p.add_argument('--per-origin', type=int, default=2)
    p.add_argument('--timeout', type=int, default=10)
    p.add_argument('--max-repos', type=int, default=120)
    p.add_argument('--meta', type=meta_positiva, default=META_PADRAO,
                   help='meta real de tentativas testadas (padrão: 9000000)')
    return p

def main() -> int:
    args = criar_parser().parse_args()
    con = conectar()
    resultado = {}
    if args.collect:
        resultado['coleta'] = coletar(con, args.max_repos)
    if args.tranco:
        resultado['tranco'] = coletar_tranco(con, args.tranco_limit)
    if args.openpagerank:
        resultado['openpagerank'] = coletar_openpagerank(con, args.openpagerank_limit)
    if args.commoncrawl:
        resultado['commoncrawl'] = coletar_commoncrawl(con, args.cc_tlds.split(','), args.cc_pages, args.cc_page_size)
    if args.test:
        resultado['teste'] = executar_testes(con, args.limit, args.workers, args.timeout, args.batch_size, args.per_origin)
    if not args.collect and not args.tranco and not args.openpagerank and not args.commoncrawl and not args.test:
        resultado = resumir(con, args.meta)
    else:
        resultado.update(resumir(con, args.meta))
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / 'varredura-web-resumo.json').write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(resultado, ensure_ascii=False, indent=2), flush=True)
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
