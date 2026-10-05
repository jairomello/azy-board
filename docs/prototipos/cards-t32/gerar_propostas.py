"""Gera três estudos vetoriais dos cards do board T32."""

from html import escape
from pathlib import Path

DESTINO = Path(__file__).parent


def ret(x, y, w, h, fill, raio=0, stroke="none", sw=1):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{raio}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def txt(x, y, value, size=14, color="#17233B", weight=400, anchor="start", family="Arial, sans-serif", spacing=None):
    extra = f' letter-spacing="{spacing}"' if spacing is not None else ""
    return f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}"{extra}>{escape(value)}</text>'


def linha(x1, y1, x2, y2, cor="#E0E5EF", largura=1):
    return f'<path d="M{x1} {y1}H{x2}" stroke="{cor}" stroke-width="{largura}"/>' if y1 == y2 else f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{cor}" stroke-width="{largura}"/>'


def circulo(x, y, r, fill, stroke="none", sw=1):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def avatar(x, y, iniciais="JS"):
    return circulo(x, y, 13, "#D7EAE5") + circulo(x, y, 13, "none", "#FFFFFF", 2) + txt(x, y + 4, iniciais, 10, "#1E6556", 700, "middle")


def grip(x, y):
    return "".join(circulo(x + dx, y + dy, 1.1, "#9CA9BC") for dx in (0, 4) for dy in (0, 5, 10))


def pill(x, y, w, label, bg, fg, h=22, size=10):
    return ret(x, y, w, h, bg, h / 2) + txt(x + w / 2, y + h / 2 + size * .35, label, size, fg, 700, "middle")


def icone_card(x, y, cor, forma="estrela"):
    """Ícone e cor independentes do tipo BUG/TAREFA."""
    base_icone = ret(x, y, 23, 23, "#FFFFFF", 6, cor, 1.4)
    if forma == "estrela":
        desenho = f'<path d="M{x+11.5} {y+4}l1.8 5.3 5.5 2-5.5 1.9-1.8 5.3-1.8-5.3-5.5-1.9 5.5-2z" fill="none" stroke="{cor}" stroke-width="1.5" stroke-linejoin="round"/>'
    elif forma == "raio":
        desenho = f'<path d="M{x+13} {y+4}l-5 8h4l-1 7 5-9h-4z" fill="none" stroke="{cor}" stroke-width="1.5" stroke-linejoin="round"/>'
    else:
        desenho = f'<path d="M{x+6} {y+8}l5.5-3 5.5 3v7l-5.5 3-5.5-3z" fill="none" stroke="{cor}" stroke-width="1.5" stroke-linejoin="round"/>'
    return base_icone + desenho


def subtarefas(x, y, quantidade):
    return (f'<path d="M{x} {y-8}v8h8m-8-4h8" fill="none" stroke="#64748B" stroke-width="1.4" stroke-linecap="round"/>'
            + txt(x + 12, y + 3, str(quantidade), 10, "#64748B", 700))


def acoes_hover(x, y):
    """Três alvos de 26 px: copiar, arquivar e excluir."""
    partes = []
    for deslocamento, cor in [(0, "#53647E"), (28, "#53647E"), (56, "#C44B55")]:
        partes.append(ret(x + deslocamento, y, 26, 26, "#F8FAFD", 5, "#D9E1EC"))
    # Duas folhas sobrepostas: copiar.
    partes.append(f'<path d="M{x+10} {y+7}h7v9h-7z M{x+7} {y+10}h2m7 7v2h-9v-8" fill="none" stroke="#53647E" stroke-width="1.3" stroke-linejoin="round"/>')
    # Caixa com seta para baixo: arquivar.
    partes.append(f'<path d="M{x+35} {y+8}h12v3h-12z M{x+37} {y+11}v7h8v-7m-6 3h4" fill="none" stroke="#53647E" stroke-width="1.3" stroke-linejoin="round"/>')
    # Lixeira: excluir.
    partes.append(f'<path d="M{x+64} {y+9}h10m-8-2h6m-7 4 1 8h7l1-8m-6 2v4m3-4v4" fill="none" stroke="#C44B55" stroke-width="1.3" stroke-linecap="round"/>')
    return "".join(partes)


def base(nome, subtitulo, numero, cor, descricao):
    partes = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650" viewBox="0 0 1000 650" role="img" aria-labelledby="titulo descricao">',
        f'<title id="titulo">{escape(nome)} — proposta {numero} para cards do Azy Board</title>',
        f'<desc id="descricao">{escape(descricao)}</desc>',
        ret(0, 0, 1000, 650, "#F5F7FB"),
        ret(40, 35, 920, 580, "#FFFFFF", 20, "#E4E9F1"),
        pill(64, 62, 45, f"{numero:02}", cor, "#FFFFFF", 25, 11),
        txt(124, 83, nome, 27, "#14223B", 700),
        txt(64, 115, subtitulo, 13, "#61708A"),
        ret(64, 145, 292, 438, "#F1F4F9", 12, "#DCE3EC"),
        ret(64, 145, 292, 44, "#FFFFFF", 12),
        ret(64, 177, 292, 12, "#FFFFFF"),
        linha(64, 189, 356, 189, "#DCE3EC"),
        circulo(84, 168, 3, "#29B979"),
        txt(95, 172, "CONCLUÍDAS", 11, "#253553", 700, spacing=1.1),
        pill(316, 156, 23, "16", "#E9EDF4", "#61708A", 23, 10),
        ret(388, 145, 548, 438, "#FAFBFD", 12, "#E6EAF1"),
        txt(417, 185, "IDEIA CENTRAL", 11, cor, 700, spacing=1.5),
    ]
    return partes


def nota(partes, y, n, titulo, descricao):
    partes.extend([
        circulo(429, y - 4, 12, "#EAF0F7"),
        txt(429, y, str(n), 11, "#31415E", 700, "middle"),
        txt(452, y, titulo, 15, "#1B2944", 700),
        txt(452, y + 22, descricao, 12, "#60708A"),
    ])


def fechar(partes, nome):
    partes.append(txt(64, 608, "Azy Board  ·  T32  ·  estudo de layout  ·  largura da coluna: 292 px", 11, "#8290A5"))
    partes.append("</svg>")
    (DESTINO / nome).write_text("\n".join(partes), encoding="utf-8")


def proposta_1():
    p = base("01 / Essencial", "Título em primeiro plano; metadados em posições previsíveis.", 1, "#3569DA", "Cards com ícone configurável, breadcrumb, código, título, tags e metadados em faixas separadas.")
    for y, code, tipo, titulo, cor, fundo, icone_cor, forma, tag, pontos, filhos in [
        (202, "B2", "BUG", ["Filtro por Sprint não", "está funcionando"], "#D13C42", "#FCEDEF", "#8055BE", "estrela", "Sprint", 3, 0),
        (391, "T10", "TAREFA", ["Campos adicionais", "nos anexos"], "#3569DA", "#EBF1FF", "#D47C27", "raio", "Anexos", 5, 2),
    ]:
        p += [ret(76, y, 268, 180, "#FFFFFF", 10, "#9FB3D7" if code == "T10" else "#D6DEEA"), ret(76, y, 3, 180, cor, 1), grip(91, y + 20)]
        p += [icone_card(108, y + 11, icone_cor, forma), txt(139, y + 27, code, 11, "#5F6D83", 700)]
        if code == "T10":
            p.append(acoes_hover(246, y + 10))
        p += [txt(109, y + 53, "Fluxo contínuo", 10, "#7B879A", 500), txt(109, y + 82, titulo[0], 15, "#15233D", 700), txt(109, y + 102, titulo[1], 15, "#15233D", 700)]
        p += [pill(109, y + 113, 61, tag, "#F1F3F8", "#51617A", 20, 10), pill(270, y + 113, 60, tipo, fundo, cor, 20, 9), linha(109, y + 141, 330, y + 141)]
        p += [txt(109, y + 163, "MÉDIA", 10, "#2758A9", 700), txt(168, y + 163, f"{pontos} pt", 10, "#60708A", 700)]
        if filhos:
            p.append(subtarefas(222, y + 160, filhos))
        p.append(avatar(315, y + 159))
    p += [txt(417, 222, "Uma ordem visual estável para todos os cards.", 19, "#1B2944", 700)]
    nota(p, 277, 1, "Ícone configurável", "Figura e cor ficam ao lado do código do card.")
    nota(p, 348, 2, "Contexto e título", "Breadcrumb precede o título, mesmo em hierarquias.")
    nota(p, 419, 3, "Ações no hover", "84 px no topo; tipo desce para a linha da tag.")
    p += [ret(417, 482, 490, 67, "#EDF3FF", 9), txt(437, 507, "No segundo card: copiar · arquivar · excluir", 13, "#244B93", 700), txt(437, 529, "Breadcrumb, título e metadados seguem visíveis.", 12, "#4F648B")]
    fechar(p, "01-essencial.svg")


def proposta_2():
    p = base("02 / Foco no título", "Breadcrumb no topo; identificador junto ao título.", 2, "#5364B6", "Cards com ícone configurável junto ao breadcrumb, código ao lado do título, tags e metadados identificáveis.")
    for y, code, tipo, titulo, cor, fundo, icone_cor, forma, tag, pontos, filhos in [
        (202, "B2", "BUG", ["Filtro por Sprint", "não está funcionando"], "#CB4750", "#FFF1F2", "#8055BE", "estrela", "Sprint", 3, 0),
        (390, "T10", "TAREFA", ["Campos adicionais", "nos anexos"], "#4568BE", "#EDF2FE", "#D47C27", "raio", "Anexos", 5, 2),
    ]:
        p += [ret(76, y, 268, 176, "#FFFFFF", 12, "#9FB3D7" if code == "T10" else "#D7DEEA"), grip(91, y + 21)]
        p += [icone_card(108, y + 11, icone_cor, forma), txt(139, y + 27, "Fluxo contínuo", 10, "#77859A", 600)]
        if code == "T10":
            p.append(acoes_hover(246, y + 10))
        p += [pill(109, y + 47, 29 if code == "B2" else 35, code, "#EDF0F6", "#475773", 21, 10)]
        p += [txt(145 if code == "B2" else 151, y + 64, titulo[0], 15, "#16233B", 700), txt(109, y + 84, titulo[1], 15, "#16233B", 700)]
        p += [pill(109, y + 97, 61, tag, "#F0F3F8", "#53627A", 20, 10), pill(276, y + 97, 54, tipo, fundo, cor, 20, 9), linha(109, y + 125, 330, y + 125)]
        p += [txt(109, y + 150, "MÉDIA", 10, "#536BA2", 700), txt(170, y + 150, f"{pontos} pt", 10, "#64748B", 700)]
        if filhos:
            p.append(subtarefas(228, y + 147, filhos))
        p.append(avatar(315, y + 146))
    p += [txt(417, 222, "O título conduz a leitura do trabalho.", 19, "#1B2944", 700)]
    nota(p, 277, 1, "Topo contextual", "Ícone personalizável; breadcrumb e tipo visíveis.")
    nota(p, 348, 2, "Código ao lado do título", "B2 ou T10 acompanham a primeira linha do nome.")
    nota(p, 419, 3, "Ações reservadas", "Copiar, arquivar e excluir aparecem no hover.")
    p += [ret(417, 482, 490, 67, "#F0F1FC", 9), txt(437, 507, "Segundo card em hover: 3 botões no topo direito", 13, "#3D4D99", 700), txt(437, 529, "Breadcrumb longo trunca antes deles; tipo vai com as tags.", 12, "#5D6792")]
    fechar(p, "02-foco-no-titulo.svg")


def proposta_3():
    p = base("03 / Compacto", "Mais cards por tela, com alinhamento de lista.", 3, "#168973", "Cards compactos com ícone personalizável, breadcrumb, código no trilho lateral e metadados resumidos.")
    dados = [
        (202, "B2", "BUG", ["Filtro por Sprint não", "está funcionando"], "#C53F49", "#FFF0F1", "#8055BE", "estrela", "Sprint", 3),
        (325, "T10", "TAREFA", ["Campos adicionais", "nos anexos"], "#3466BD", "#EAF1FF", "#D47C27", "raio", "Anexos", 5),
        (448, "T32", "TAREFA", ["Melhorar layout", "dos cards"], "#3466BD", "#EAF1FF", "#279E81", "hex", "Design", 2),
    ]
    for y, code, tipo, titulo, cor, fundo, icone_cor, forma, tag, pontos in dados:
        p += [ret(76, y, 268, 115, "#FFFFFF", 9, "#9FB3D7" if code == "T10" else "#D6DEEA"), ret(76, y, 51, 115, "#F8FAFD", 9), ret(117, y, 10, 115, "#F8FAFD")]
        p += [grip(88, y + 19), icone_card(89, y + 40, icone_cor, forma), txt(91, y + 90, code, 11, "#52617B", 700)]
        p += [txt(140, y + 20, "Fluxo contínuo", 9, "#7B879A", 500), txt(140, y + 43, titulo[0], 12, "#16243E", 700), txt(140, y + 59, titulo[1], 12, "#16243E", 700)]
        if code == "T10":
            p.append(acoes_hover(246, y + 5))
        p += [pill(140, y + 68, 54, tag, "#F1F3F8", "#52617B", 17, 9), txt(202, y + 81, f"{pontos} pt", 9, "#587099", 700)]
        if code == "T10":
            p.append(subtarefas(246, y + 78, 2))
        p.append(avatar(317, y + 79))
        p += [txt(140, y + 104, tipo, 9, cor, 700), txt(195, y + 104, "MÉDIA", 9, "#587099", 700)]
    p += [txt(417, 222, "A coluna funciona como uma lista escaneável.", 19, "#1B2944", 700)]
    nota(p, 277, 1, "Ícone e código no trilho", "Personalização visível sem ocupar o título.")
    nota(p, 348, 2, "Contexto no topo", "Breadcrumb curto preserva a leitura hierárquica.")
    nota(p, 419, 3, "Ações no topo", "Hover ocupa a área livre à direita do breadcrumb.")
    p += [ret(417, 482, 490, 67, "#EAF7F2", 9), txt(437, 507, "Segundo card em hover: copiar · arquivar · excluir", 13, "#176F5F", 700), txt(437, 529, "Três cards permanecem visíveis na coluna.", 12, "#507B72")]
    fechar(p, "03-compacto.svg")


if __name__ == "__main__":
    proposta_1()
    proposta_2()
    proposta_3()
