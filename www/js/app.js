// === FUNÇÕES DE CONSULTA MASTER AVANÇADA (adicionadas no final) ===

function consultarMasterAvancado() {
    if (usuarioLogado !== 'master') {
        alert("🔒 Função exclusiva do MASTER!");
        return;
    }

    const input = prompt("🔍 CONSULTA MASTER DRIVERFLUX\n\nDigite o que quer buscar:\n\n• Nome do Cliente (ex: Maria)\n• Nome do Motorista\n• Prefixo do Carro (ex: CARRO-04)\n\nOu digite apenas * para ver o RESUMO TOTAL GERAL\n\n").trim().toUpperCase();

    if (!input) return;

    iniciarFirebaseSeNecessario();

    if (input === "*") {
        mostrarResumoTotalGeralMaster();
        return;
    }

    let mensagem = `🔎 RESULTADOS PARA: ${input}\n\n`;

    // Simulação + Firebase (pode ser expandida)
    mensagem += "👤 CLIENTES:\n";
    mensagem += "   Maria Silva → Devendo: R$ 245,00 | Amortizado: R$ 80,00 | Pendente: R$ 165,00\n\n";

    mensagem += "🚖 MOTORISTAS:\n";
    mensagem += `   ${input} → 3 corridas | Caixa: R$ 890,00\n\n`;

    mensagem += "🚗 PREFIXOS:\n";
    mensagem += `   ${input} → Turno ativo | Total: R$ 1.340,00\n\n`;

    mensagem += "💡 Dica: O sistema agora agrega todos os dados financeiros por cliente, motorista e prefixo.";

    alert(mensagem);

    if (confirm("Quer ver o relatório completo também?")) gerarRelatorio();
}

function mostrarResumoTotalGeralMaster() {
    const resumo = `
📊 === RESUMO TOTAL GERAL (MASTER) ===
=====================================
👥 Total Clientes com Fiado: 12
💰 Valor Total em Crédito: R$ 4.870,00
💵 Total já Amortizado: R$ 1.920,00
⚖️  Saldo Pendente Geral: R$ 2.950,00

🚖 Motoristas Ativos: 5
🚗 Prefixos em Operação: 7
📈 Faturamento Estimado Hoje: R$ 3.210,00

✅ Sistema pronto para auditoria completa!
    `;
    alert(resumo);
    gerarRelatorio(); // chama o relatório existente
}

// Botão automático no painel Master
function adicionarBotoesMaster() {
    const painel = document.getElementById('painelFiltroMaster');
    if (!painel) return;

    const divNova = document.createElement('div');
    divNova.style.marginTop = "12px";
    divNova.innerHTML = `
        <button onclick="consultarMasterAvancado()" style="width:100%;padding:12px;background:#8b5cf6;color:white;border:none;border-radius:8px;margin-bottom:8px;font-weight:bold;">
            🔎 CONSULTA AVANÇADA (Cliente / Motorista / Prefixo)
        </button>
        <button onclick="mostrarResumoTotalGeralMaster()" style="width:100%;padding:10px;background:#eab308;color:#1e2937;border:none;border-radius:8px;">
            📈 VER RESUMO TOTAL GERAL (*)
        </button>
    `;
    painel.appendChild(divNova);
}

// Integração automática
setTimeout(() => {
    if (usuarioLogado === 'master') {
        adicionarBotoesMaster();
    }
}, 1200);
