import contextlib
import importlib.util
import io
import json
import socket
import tempfile
import unittest
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from unittest import mock


CAMINHO_SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'varredura-web.py'
SPEC = importlib.util.spec_from_file_location('varredura_web', CAMINHO_SCRIPT)
varredura = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(varredura)


def endereco_dns(ip, porta=443):
    familia = socket.AF_INET6 if ':' in ip else socket.AF_INET
    sockaddr = (ip, porta, 0, 0) if familia == socket.AF_INET6 else (ip, porta)
    return [(familia, socket.SOCK_STREAM, socket.IPPROTO_TCP, '', sockaddr)]


class TestInsercao(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.dados = Path(self.temp.name)
        self.patches = [
            mock.patch.object(varredura, 'DADOS', self.dados),
            mock.patch.object(varredura, 'DB', self.dados / 'teste.sqlite3'),
        ]
        for patch in self.patches:
            patch.start()
        self.con = varredura.conectar()

    def tearDown(self):
        self.con.close()
        for patch in reversed(self.patches):
            patch.stop()
        self.temp.cleanup()

    def test_rowcount_nao_conta_alteracoes_cumulativas(self):
        self.assertTrue(varredura.inserir(self.con, 'https://example.com/a', 'teste'))
        self.assertFalse(varredura.inserir(self.con, 'https://example.com/a', 'duplicado'))
        self.assertTrue(varredura.inserir(self.con, 'https://example.com/b', 'teste'))
        self.assertFalse(varredura.inserir(self.con, 'https://example.com/a', 'duplicado'))
        self.assertEqual(self.con.execute('SELECT COUNT(*) FROM urls').fetchone()[0], 2)

    def test_insercao_rejeita_url_nao_publica(self):
        self.assertFalse(varredura.inserir(self.con, 'http://127.0.0.1/admin', 'teste'))
        self.assertEqual(self.con.execute('SELECT COUNT(*) FROM urls').fetchone()[0], 0)

    def test_openpagerank_le_csv_zip_sem_rede(self):
        pacote = self.dados / 'openpagerank-top10milliondomains.csv.zip'
        conteudo = (
            'rank,domain,openpagerank\n'
            '1,public-alpha.org,9.99\n'
            '2,localhost,1.0\n'
            '3,public-beta.net,8.5\n'
        ).encode('utf-8')
        with zipfile.ZipFile(pacote, 'w') as z:
            z.writestr('top10milliondomains.csv', conteudo)
        resultado = varredura.coletar_openpagerank(self.con, limite=9_000_000)
        self.assertEqual(resultado['processados'], 3)
        self.assertEqual(resultado['urls_novas'], 2)
        self.assertEqual(self.con.execute('SELECT COUNT(*) FROM urls').fetchone()[0], 2)
        self.assertEqual(varredura.dominio_openpagerank(['10', 'Public-Alpha.Org']), 'public-alpha.org')
        self.assertEqual(varredura.dominio_openpagerank(['11', 'sem-dominio']), '')


class TestClassificacao(unittest.TestCase):
    def classificar(self, status, titulo='', texto=''):
        return varredura.classificar(status, 'https://example.com/', 'text/html', titulo, texto)

    def test_status_tem_prioridade_sobre_corpo(self):
        casos = [
            (401, 'bloqueado'), (403, 'bloqueado'), (429, 'rate-limit'),
            (400, 'indisponivel'), (404, 'indisponivel'), (410, 'indisponivel'),
            (407, 'indisponivel'), (500, 'indisponivel'), (503, 'indisponivel'),
        ]
        for status, esperado in casos:
            with self.subTest(status=status):
                classe, sinais = self.classificar(
                    status, 'Paywall CAPTCHA login', '<script>paywall captcha</script>',
                )
                self.assertEqual(classe, esperado)
                self.assertFalse(any(sinais.values()))

    def test_corpo_so_e_classificado_em_sucesso(self):
        for status in (200, 201, 204, 299):
            with self.subTest(status=status):
                classe, sinais = self.classificar(status, texto='Paywall assine para continuar')
                self.assertEqual(classe, 'paywall')
                self.assertTrue(sinais['paywall'])
        classe, sinais = self.classificar(302, texto='Paywall assine para continuar')
        self.assertEqual(classe, 'sem-sinal')
        self.assertFalse(any(sinais.values()))

    def test_scripts_estilos_e_tags_nao_geram_sinais(self):
        corpo = (
            '<html><head><style>.paywall{content:"captcha"}</style>'
            '<script>const regra = "paywall captcha login";</script></head>'
            '<body><p>Chat &amp; assistant</p></body></html>'
        )
        classe, sinais = self.classificar(200, texto=corpo)
        self.assertEqual(classe, 'chat-sem-login')
        self.assertTrue(sinais['chat'])
        self.assertFalse(sinais['paywall'])
        self.assertFalse(sinais['captcha'])
        self.assertFalse(sinais['login'])

    def test_titulo_visivel_e_limpo_antes_da_heuristica(self):
        classe, sinais = self.classificar(200, '<span>Paywall</span> premium', '')
        self.assertEqual(classe, 'paywall')
        self.assertTrue(sinais['paywall'])

    def test_http_error_limpa_corpo_mas_nao_o_usa_como_sinal(self):
        for status, esperado in ((403, 'bloqueado'), (429, 'rate-limit'), (503, 'indisponivel')):
            with self.subTest(status=status):
                corpo = b'<html><script>"paywall captcha"</script><style>paywall</style></html>'
                erro = urllib.error.HTTPError(
                    'https://example.com/', status, 'erro', {'content-type': 'text/html'}, io.BytesIO(corpo),
                )
                with mock.patch.object(varredura, 'abrir_publica', side_effect=erro):
                    resultado = varredura.testar((1, 'https://example.com/'), 1)
                self.assertEqual(resultado['ultimo_status'], status)
                self.assertEqual(resultado['classe'], esperado)
                self.assertFalse(any(json.loads(resultado['sinais']).values()))


class TestSegurancaUrl(unittest.TestCase):
    def test_rejeita_hosts_locais_internos_e_reservados(self):
        urls = [
            'http://localhost/', 'http://localhost./', 'http://app.localhost/',
            'http://service.internal/', 'http://service.intranet/', 'http://rede.lan/',
            'http://host.local/', 'http://host.localdomain/', 'http://host.home.arpa/',
            'http://servico.onion/', 'http://host.test/', 'http://host.invalid/',
            'http://host.example/', 'http://intranet/',
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertIsNone(varredura.limpar_url(url))
                self.assertFalse(varredura.validar_url_publica(url))

    def test_rejeita_literais_ip_nao_publicos(self):
        ips = [
            '0.0.0.0', '127.0.0.1', '127.1', '10.0.0.1', '172.16.0.1',
            '192.168.1.1', '169.254.169.254', '100.64.0.1', '192.0.2.1',
            '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1',
            '255.255.255.255', '2130706433', '0177.0.0.1', '0x7f.0x0.0x0.0x1',
            '[::1]', '[::]', '[fc00::1]', '[fd00::1]', '[fe80::1]',
            '[ff02::1]', '[::ffff:127.0.0.1]', '[2001:db8::1]',
        ]
        for ip in ips:
            with self.subTest(ip=ip):
                self.assertIsNone(varredura.limpar_url('http://' + ip + '/'))
                self.assertFalse(varredura.validar_url_publica('http://' + ip + '/'))

    def test_aceita_ips_publicos_e_normaliza_ipv6(self):
        self.assertEqual(
            varredura.limpar_url('https://8.8.8.8:8443/path?q=1#fragmento'),
            'https://8.8.8.8:8443/path?q=1',
        )
        self.assertEqual(
            varredura.limpar_url('https://[2606:4700:4700::1111]/'),
            'https://[2606:4700:4700::1111]/',
        )
        self.assertTrue(varredura.validar_url_publica('https://8.8.8.8/'))
        self.assertTrue(varredura.validar_url_publica('https://[2606:4700:4700::1111]/'))

    def test_rejeita_esquemas_credenciais_portas_e_confusao_de_parser(self):
        urls = [
            'file:///etc/passwd', 'ftp://example.com/', 'https://user:senha@example.com/',
            'https://example.com:0/', 'https://example.com:99999/',
            'https://example.com\\@127.0.0.1/', 'https://example.com\n@127.0.0.1/',
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertIsNone(varredura.limpar_url(url))
                self.assertFalse(varredura.validar_url_publica(url))

    def test_dns_exige_que_todos_os_enderecos_sejam_publicos(self):
        casos = [
            ('93.184.216.34', True),
            ('127.0.0.1', False),
            ('10.0.0.8', False),
            ('169.254.169.254', False),
        ]
        for ips, esperado in casos:
            enderecos = [item for ip in ips.split(',') for item in endereco_dns(ip)]
            resolver = mock.Mock(return_value=enderecos)
            with self.subTest(ips=ips):
                self.assertEqual(varredura.validar_url_publica('https://example.com/', resolver), esperado)
                resolver.assert_called_once()

        resolver = mock.Mock(return_value=endereco_dns('93.184.216.34') + endereco_dns('192.168.1.1'))
        self.assertFalse(varredura.validar_url_publica('https://example.com/', resolver))
        self.assertFalse(varredura.validar_url_publica('https://example.com/', mock.Mock(return_value=[])))
        self.assertFalse(varredura.validar_url_publica(
            'https://example.com/', mock.Mock(side_effect=socket.gaierror('sem dns')),
        ))

    def test_redirecionamento_validado_e_bloqueado_antes_do_novo_pedido(self):
        handler = varredura.RedirecionamentoPublico()
        req = urllib.request.Request('https://example.com/')
        with mock.patch.object(varredura, 'validar_url_publica', return_value=False) as validar:
            with self.assertRaises(urllib.error.URLError):
                handler.redirect_request(req, None, 302, 'Found', {}, 'http://127.0.0.1/admin')
            validar.assert_called_once_with('http://127.0.0.1/admin')

    def test_redirecionamento_publico_e_permitido(self):
        handler = varredura.RedirecionamentoPublico()
        req = urllib.request.Request('https://example.com/')
        with mock.patch.object(varredura, 'validar_url_publica', return_value=True):
            redirecionado = handler.redirect_request(
                req, None, 302, 'Found', {}, 'https://public.example.org/caminho',
            )
        self.assertEqual(redirecionado.full_url, 'https://public.example.org/caminho')

    def test_pedido_inicial_nao_abre_quando_validacao_falha(self):
        req = urllib.request.Request('https://example.com/')
        with mock.patch.object(varredura, 'validar_url_publica', return_value=False), \
                mock.patch.object(varredura.ABRIDOR_PUBLICO, 'open') as abrir:
            with self.assertRaises(urllib.error.URLError):
                varredura.abrir_publica(req, timeout=3)
            abrir.assert_not_called()


class TestMeta(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.dados = Path(self.temp.name)
        self.patches = [
            mock.patch.object(varredura, 'DADOS', self.dados),
            mock.patch.object(varredura, 'DB', self.dados / 'teste.sqlite3'),
        ]
        for patch in self.patches:
            patch.start()
        self.con = varredura.conectar()

    def tearDown(self):
        self.con.close()
        for patch in reversed(self.patches):
            patch.stop()
        self.temp.cleanup()

    def test_meta_padrao_e_explicita(self):
        parser = varredura.criar_parser()
        self.assertEqual(parser.parse_args([]).meta, 9_000_000)
        self.assertEqual(parser.parse_args(['--meta', '12000']).meta, 12000)
        self.assertTrue(parser.parse_args(['--openpagerank']).openpagerank)
        self.assertEqual(parser.parse_args(['--openpagerank-limit', '100']).openpagerank_limit, 100)
        for valor in ('0', '-1', 'abc'):
            with self.subTest(valor=valor), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    parser.parse_args(['--meta', valor])

    def test_resumo_nao_finge_conclusao_sem_tentativas(self):
        vazio = varredura.resumir(self.con)
        self.assertEqual(vazio['meta'], 9_000_000)
        self.assertEqual(vazio['total_urls'], 0)
        self.assertEqual(vazio['tentativas'], 0)
        self.assertEqual(vazio['progresso_percent'], 0)
        self.assertFalse(vazio['meta_atingida'])

        self.assertTrue(varredura.inserir(self.con, 'https://example.com/a', 'teste'))
        self.assertTrue(varredura.inserir(self.con, 'https://example.com/b', 'teste'))
        parcial = varredura.resumir(self.con, meta=2)
        self.assertEqual(parcial['total_urls'], 2)
        self.assertEqual(parcial['tentativas'], 0)
        self.assertFalse(parcial['meta_atingida'])

        self.con.execute("UPDATE urls SET estado='testado' WHERE id=1")
        self.con.commit()
        parcial = varredura.resumir(self.con, meta=2)
        self.assertEqual(parcial['tentativas'], 1)
        self.assertEqual(parcial['progresso_percent'], 50)
        self.assertFalse(parcial['meta_atingida'])

        self.con.execute("UPDATE urls SET estado='erro' WHERE id=2")
        self.con.commit()
        concluido = varredura.resumir(self.con, meta=2)
        self.assertEqual(concluido['tentativas'], 2)
        self.assertEqual(concluido['progresso_percent'], 100)
        self.assertTrue(concluido['meta_atingida'])

    def test_resumo_rejeita_meta_invalida(self):
        with self.assertRaises(ValueError):
            varredura.resumir(self.con, meta=0)


if __name__ == '__main__':
    unittest.main()
