const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("./scoring.js");

// Formato antigo (carta por carta), mantido para rodadas já salvas.
function detalhada() {
  const j = () => ({ canastras: [], tresVermelhos: 0, cartasMesa: { dez: 0, as: 0, dois: 0, joker: 0 }, pegouMorto: true });
  return { batedor: null, jogadores: [j(), j()], maoPerdedor: { dez: 0, as: 0, dois: 0, joker: 0, tresPreto: 0 } };
}

test("valores das canastras", () => {
  assert.equal(C.bonusCanastra({ tipo: "limpa", cartas: 7 }), 200);
  assert.equal(C.bonusCanastra({ tipo: "limpa", cartas: 8 }), 300);
  assert.equal(C.bonusCanastra({ tipo: "limpa", cartas: 9 }), 400);
  assert.equal(C.bonusCanastra({ tipo: "limpa", cartas: 10 }), 500);
  assert.equal(C.bonusCanastra({ tipo: "limpa", cartas: 13 }), 800);
  assert.equal(C.bonusCanastra({ tipo: "suja", cartas: 7 }), 100);
  assert.equal(C.bonusCanastra({ tipo: "suja", cartas: 12 }), 100);
});

test("três vermelhos dependem de ter canastra", () => {
  assert.equal(C.valorTresVermelhos(2, true), 200);
  assert.equal(C.valorTresVermelhos(2, false), 20);
  assert.equal(C.valorTresVermelhos(0, true), 0);
});

test("valores individuais das cartas", () => {
  assert.equal(C.somaCartasMesa({ dez: 3, as: 2, dois: 1, joker: 1 }), 30 + 30 + 50 + 50);
  assert.equal(C.somaMao({ dez: 1, tresPreto: 2 }), 10 + 200);
});

test("exemplo da regra: mão de 175 do jogador 2 vai para o jogador 1", () => {
  const r = detalhada();
  r.batedor = 0;
  r.maoPerdedor = { dez: 10, as: 5, dois: 0, joker: 0, tresPreto: 0 }; // 100 + 75 = 175
  const [j1, j2] = C.calcularRodada(r);
  assert.equal(j1.maoAdversario, 175);
  assert.equal(j1.total, 100 + 175);
  assert.equal(j2.total, 0); // nada descontado de quem ficou com as cartas
});

test("três preto conta uma única vez, só na mão do adversário", () => {
  const r = detalhada();
  r.batedor = 1;
  r.maoPerdedor = { dez: 0, as: 0, dois: 0, joker: 0, tresPreto: 1 };
  const [j1, j2] = C.calcularRodada(r);
  assert.equal(j2.maoAdversario, 100);
  assert.equal(j2.total, 200);
  assert.equal(j1.total, 0);
});

test("rodada completa separa batida, mesa e cartas", () => {
  const r = detalhada();
  r.batedor = 0;
  r.jogadores[0].canastras = [{ tipo: "limpa", cartas: 8 }, { tipo: "suja", cartas: 7 }];
  r.jogadores[0].tresVermelhos = 1;
  r.jogadores[0].cartasMesa = { dez: 12, as: 2, dois: 1, joker: 0 };
  r.jogadores[1].tresVermelhos = 1; // sem canastra: 10
  r.jogadores[1].cartasMesa = { dez: 5, as: 0, dois: 0, joker: 1 };
  r.maoPerdedor = { dez: 2, as: 1, dois: 0, joker: 0, tresPreto: 1 };
  const [a, b] = C.calcularRodada(r);
  assert.deepEqual(
    [a.batida, a.canastras, a.tresVermelhos, a.mesa, a.cartasMesa, a.maoAdversario, a.total],
    [100, 400, 100, 500, 200, 135, 935]
  );
  assert.deepEqual([b.batida, b.mesa, b.cartasMesa, b.maoAdversario, b.total], [0, 10, 100, 0, 110]);
});

test("penalidade do morto fica em zero até ser definida", () => {
  const r = detalhada();
  r.batedor = 0;
  r.jogadores[1].pegouMorto = false;
  assert.equal(C.calcularRodada(r)[1].total, 0);
  assert.equal(C.calcularRodada(r, { penalidadeMorto: 100 })[1].total, -100);
});

test("placar acumulado, abertura e vencedor", () => {
  const r = detalhada();
  r.batedor = 0;
  r.jogadores[0].canastras = [{ tipo: "limpa", cartas: 7 }];
  r.jogadores[0].cartasMesa = { dez: 7, as: 0, dois: 0, joker: 0 }; // 100 + 200 + 70 = 370
  const p = C.placar([r, r, r]);
  assert.deepEqual(p.totais, [1110, 0]);
  assert.deepEqual(p.linhas[1].antes, [370, 0]);
  assert.equal(C.aberturaMinima(1999), 0);
  assert.equal(C.aberturaMinima(2000), 150);
  assert.equal(C.vencedor([3990, 100]), null);
  assert.deepEqual(C.vencedor([4000, 100]), { jogador: 0 });
  assert.deepEqual(C.vencedor([4100, 4300]), { jogador: 1 });
  assert.deepEqual(C.vencedor([4100, 4100]), { empate: true });
});

test("avisos: batedor e cartas a menos que as canastras", () => {
  const r = detalhada();
  r.jogadores[0].canastras = [{ tipo: "limpa", cartas: 7 }];
  const av = C.avisosRodada(r);
  assert.ok(av.some((a) => a.tipo === "erro"));
  assert.ok(av.some((a) => a.jogador === 0));
});

test("totais: batida + mesa + cartas, mão vai para quem bateu", () => {
  const r = C.rodadaVazia();
  r.batedor = 1;
  r.pontos[0] = { mesa: 300, cartas: 120, pegouMorto: true };
  r.pontos[1] = { mesa: 700, cartas: 255, pegouMorto: true };
  r.mao = 175;
  const [a, b] = C.calcularRodada(r);
  assert.deepEqual([a.batida, a.mesa, a.cartasMesa, a.maoAdversario, a.total], [0, 300, 120, 0, 420]);
  assert.deepEqual([b.batida, b.mesa, b.cartasMesa, b.maoAdversario, b.total], [100, 700, 255, 175, 1230]);
});

test("totais: sem batedor a mão não vai para ninguém", () => {
  const r = C.rodadaVazia();
  r.mao = 100;
  const c = C.calcularRodada(r);
  assert.equal(c[0].total + c[1].total, 0);
  assert.ok(C.avisosRodada(r).some((a) => a.tipo === "erro"));
});

test("totais: aviso para valor que não termina em 0 ou 5", () => {
  const r = C.rodadaVazia();
  r.batedor = 0;
  r.pontos[1].cartas = 123;
  assert.ok(C.avisosRodada(r).some((a) => a.jogador === 1));
  r.pontos[1].cartas = 125;
  assert.equal(C.avisosRodada(r).length, 0);
});

test("rodada antiga convertida para totais mantém o resultado", () => {
  const r = detalhada();
  r.batedor = 0;
  r.jogadores[0].canastras = [{ tipo: "limpa", cartas: 8 }];
  r.jogadores[0].tresVermelhos = 1;
  r.jogadores[0].cartasMesa = { dez: 10, as: 1, dois: 0, joker: 0 };
  r.maoPerdedor = { dez: 2, as: 0, dois: 0, joker: 0, tresPreto: 1 };
  const t = C.paraTotais(r);
  assert.deepEqual(C.calcularRodada(t).map((x) => x.total), C.calcularRodada(r).map((x) => x.total));
  assert.equal(t.mao, 0);
  assert.equal(t.pontos[0].cartas, 115 + 120);
});
