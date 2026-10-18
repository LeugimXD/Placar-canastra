/* Regras de pontuação da nossa canastra (regras personalizadas — não alterar sem autorização). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Canastra = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CONFIG = {
    meta: 4000,
    limiteAbertura: 2000,
    aberturaMinima: 150,
    batida: 100,
    // Pendente de confirmação: penalidade por não pegar o morto. Enquanto for 0, nada é aplicado.
    penalidadeMorto: 0,
  };

  // Valor individual das cartas.
  var VALOR = { dez: 10, as: 15, dois: 50, joker: 50, tresPreto: 100 };

  function inteiro(n) {
    n = Number(n);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  /** Bônus de uma canastra. tipo: "limpa" (sem curinga ou com Joker) | "suja" (2 como curinga). */
  function bonusCanastra(c) {
    var cartas = Math.max(7, inteiro(c && c.cartas));
    if (c && c.tipo === "suja") return 100;
    return 200 + (cartas - 7) * 100;
  }

  /** Três vermelhos: 100 cada com pelo menos uma canastra; 10 cada sem canastra. */
  function valorTresVermelhos(qtd, temCanastra) {
    return inteiro(qtd) * (temCanastra ? 100 : 10);
  }

  /** Cartas baixadas na mesa: { dez, as, dois, joker }. */
  function somaCartasMesa(m) {
    m = m || {};
    return inteiro(m.dez) * VALOR.dez + inteiro(m.as) * VALOR.as + inteiro(m.dois) * VALOR.dois + inteiro(m.joker) * VALOR.joker;
  }

  /** Cartas que ficaram na mão: { dez, as, dois, joker, tresPreto }. O três preto entra só aqui, uma vez. */
  function somaMao(m) {
    m = m || {};
    return somaCartasMesa(m) + inteiro(m.tresPreto) * VALOR.tresPreto;
  }

  function qtdCartas(m) {
    m = m || {};
    return inteiro(m.dez) + inteiro(m.as) + inteiro(m.dois) + inteiro(m.joker) + inteiro(m.tresPreto);
  }

  /** Rodada lançada por totais: pontos da mesa e das cartas de cada jogador (cartas já somadas com a mão do adversário). */
  function rodadaVazia() {
    return { modo: "totais", batedor: null, pontos: [{ mesa: 0, cartas: 0, pegouMorto: true }, { mesa: 0, cartas: 0, pegouMorto: true }], mao: 0 };
  }

  /** Converte uma rodada contada carta por carta (versão anterior) para totais, sem mudar o resultado. */
  function paraTotais(r) {
    if (r.modo === "totais") return JSON.parse(JSON.stringify(r));
    var c = calcularRodada(r);
    return {
      modo: "totais", batedor: r.batedor, em: r.em,
      // A mão do adversário entra junto com as cartas de quem bateu, como na contagem à mesa.
      pontos: [0, 1].map(function (i) { return { mesa: c[i].mesa, cartas: c[i].cartasMesa + c[i].maoAdversario, pegouMorto: r.jogadores[i].pegouMorto !== false }; }),
      mao: 0,
    };
  }

  /**
   * Calcula a rodada. Retorna, por jogador:
   * batida, canastras, tresVermelhos, mesa (bônus), cartasMesa, maoAdversario, penalidade, total.
   * As cartas da mão de quem não bateu são creditadas a quem bateu; nada é descontado de quem ficou com elas.
   */
  function calcularRodada(r, cfg) {
    cfg = Object.assign({}, CONFIG, cfg || {});
    if (r.modo === "totais") return calcularTotais(r, cfg);
    var res = [0, 1].map(function (i) {
      var j = (r.jogadores && r.jogadores[i]) || {};
      var canastras = (j.canastras || []).reduce(function (s, c) { return s + bonusCanastra(c); }, 0);
      var temCanastra = (j.canastras || []).length > 0;
      var tresV = valorTresVermelhos(j.tresVermelhos, temCanastra);
      var penalidade = j.pegouMorto === false ? inteiro(cfg.penalidadeMorto) : 0;
      return {
        batida: r.batedor === i ? cfg.batida : 0,
        canastras: canastras,
        tresVermelhos: tresV,
        mesa: canastras + tresV,
        cartasMesa: somaCartasMesa(j.cartasMesa),
        maoAdversario: 0,
        penalidade: penalidade,
        total: 0,
      };
    });
    if (r.batedor === 0 || r.batedor === 1) res[r.batedor].maoAdversario = somaMao(r.maoPerdedor);
    res.forEach(function (p) {
      p.total = p.batida + p.mesa + p.cartasMesa + p.maoAdversario - p.penalidade;
    });
    return res;
  }

  function calcularTotais(r, cfg) {
    var res = [0, 1].map(function (i) {
      var p = (r.pontos && r.pontos[i]) || {};
      return {
        batida: r.batedor === i ? cfg.batida : 0,
        mesa: inteiro(p.mesa),
        cartasMesa: inteiro(p.cartas),
        maoAdversario: r.batedor === i ? inteiro(r.mao) : 0,
        penalidade: p.pegouMorto === false ? inteiro(cfg.penalidadeMorto) : 0,
        total: 0,
      };
    });
    res.forEach(function (p) { p.total = p.batida + p.mesa + p.cartasMesa + p.maoAdversario - p.penalidade; });
    return res;
  }

  /** Avisos que não bloqueiam a contagem. */
  function avisosRodada(r) {
    var avisos = [];
    if (r.batedor !== 0 && r.batedor !== 1) avisos.push({ tipo: "erro", texto: "Escolha quem bateu." });
    if (r.modo === "totais") {
      // Todas as cartas e bônus valem múltiplos de 5; outro valor indica erro de digitação.
      [0, 1].forEach(function (i) {
        var p = r.pontos[i];
        if (inteiro(p.mesa) % 5 || inteiro(p.cartas) % 5) avisos.push({ tipo: "aviso", jogador: i, texto: "Confira: os pontos sempre terminam em 0 ou 5." });
      });
      if (inteiro(r.mao) % 5) avisos.push({ tipo: "aviso", texto: "Confira os pontos da mão: sempre terminam em 0 ou 5." });
      return avisos;
    }
    [0, 1].forEach(function (i) {
      var j = r.jogadores[i];
      var naCanastra = (j.canastras || []).reduce(function (s, c) { return s + Math.max(7, inteiro(c.cartas)); }, 0);
      var naMesa = qtdCartas(j.cartasMesa);
      if (naMesa < naCanastra) avisos.push({ tipo: "aviso", jogador: i, texto: "As canastras somam " + naCanastra + " cartas, mas só " + naMesa + " cartas da mesa foram contadas." });
    });
    return avisos;
  }

  /** Placar acumulado: total após cada rodada. */
  function placar(rodadas, cfg) {
    var tot = [0, 0];
    var linhas = (rodadas || []).map(function (r) {
      var antes = tot.slice();
      var c = calcularRodada(r, cfg);
      tot = [tot[0] + c[0].total, tot[1] + c[1].total];
      return { calculo: c, antes: antes, depois: tot.slice() };
    });
    return { totais: tot, linhas: linhas };
  }

  /** Abertura obrigatória a partir de 2.000 pontos acumulados. */
  function aberturaMinima(total, cfg) {
    cfg = Object.assign({}, CONFIG, cfg || {});
    return total >= cfg.limiteAbertura ? cfg.aberturaMinima : 0;
  }

  /** Vencedor: quem atingiu 4.000. Se os dois atingirem, vence o maior; empate é informado. */
  function vencedor(totais, cfg) {
    cfg = Object.assign({}, CONFIG, cfg || {});
    var a = totais[0] >= cfg.meta, b = totais[1] >= cfg.meta;
    if (!a && !b) return null;
    if (a && b && totais[0] === totais[1]) return { empate: true };
    if (a && b) return { jogador: totais[0] > totais[1] ? 0 : 1 };
    return { jogador: a ? 0 : 1 };
  }

  return {
    CONFIG: CONFIG, VALOR: VALOR,
    bonusCanastra: bonusCanastra, valorTresVermelhos: valorTresVermelhos,
    somaCartasMesa: somaCartasMesa, somaMao: somaMao, qtdCartas: qtdCartas,
    rodadaVazia: rodadaVazia, paraTotais: paraTotais, calcularRodada: calcularRodada, avisosRodada: avisosRodada,
    placar: placar, aberturaMinima: aberturaMinima, vencedor: vencedor,
  };
});
