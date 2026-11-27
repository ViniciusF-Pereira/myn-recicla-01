# Loop de ferramentas

O Myn pode executar um objetivo em vários passos observáveis.

## Fluxo

```
objetivo
→ escolhe ferramenta compatível
→ executa
→ registra observação
→ escolhe outra ferramenta
→ repete até o limite
→ resposta final com as observações
```

## Como usar

```json
POST /api/agente
{
  "mensagem": "verifique a arquitetura e o desempenho",
  "loop": true,
  "maxPassos": 2
}
```

Ou pela ferramenta MCP `myn_loop`.

## Ferramentas reconhecidas

- arquitetura;
- desempenho;
- modelos;
- imagem;
- áudio;
- vídeo;
- pesquisa;
- rotas;
- histórico;
- chat.

## Execução ao vivo

Objetivo: “verifique a arquitetura e o desempenho”.

Resultado:

- `myn_arquitetura` → 77 módulos, 126 dependências, 0 violações;
- `myn_desempenho` → medição retornada;
- **2/2 ferramentas concluídas**.

## Limites

- máximo de 6 passos;
- não repete a mesma ferramenta;
- erros ficam registrados sem interromper o loop;
- mensageria real não é executada automaticamente.
