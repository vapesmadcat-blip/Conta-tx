// ========== SISTEMA DE BUSCA AVANÇADA MASTER ==========
// DriverFlux - Sistema de Busca Completo

// Cache para evitar múltiplas leituras
let cacheTurnosCompletos = null;
let cacheClientesCompletos = null;
let cacheMotoristasAgrupados = {};
let ultimaAtualizacaoCache = 0;
const TEMPO_CACHE = 30000; // 30 segundos

// Função principal de consulta avançada
async function consultarMasterAvancado() {
    if (usuarioLogado !== 'master') {
        alert("🔒 Função exclusiva do MASTER!");
        return;
    }

    const input = prompt("🔍 CONSULTA MASTER DRIVERFLUX\n\n" +
        "Digite o que quer buscar:\n\n" +
        "• Nome do CLIENTE (ex: Maria, João)\n" +
        "• Nome do MOTORISTA (ex: Andre, Pedro)\n" +
        "• PREFIXO do CARRO (ex: CARRO-01, 01, 02)\n\n" +
        "Comandos especiais:\n" +
        "• * → Resumo Total Geral\n" +
        "• # → Lista de Clientes Devedores\n" +
        "• @ → Relatório de Motoristas\n" +
        "• $ → Relatório de Prefixos\n\n" +
        "Digite sua busca:").trim().toUpperCase();

    if (!input) return;

    iniciarFirebaseSeNecessario();

    // Comandos especiais
    if (input === "*") {
        await mostrarResumoTotalGeralMaster();
        return;
    }
    if (input === "#") {
        await mostrarClientesDevedores();
        return;
    }
    if (input === "@") {
        await mostrarRelatorioMotoristas();
        return;
    }
    if (input === "$") {
        await mostrarRelatorioPrefixos();
        return;
    }

    // Determinar tipo de busca
    const isPrefixo = /^(\d+$|CARRO-\d+)/i.test(input);
    
    if (isPrefixo) {
        await buscarPorPrefixo(input);
    } else {
        await buscarPorClienteOuMotorista(input);
    }
}

// ========== BUSCA POR CLIENTE OU MOTORISTA ==========
async function buscarPorClienteOuMotorista(termo) {
    mostrarLoading("Buscando dados...");
    
    try {
        await carregarTodosDados();
        
        let mensagem = `🔎 RESULTADOS PARA: "${termo}"\n`;
        mensagem += `══════════════════════════════════════\n\n`;
        
        let encontrou = false;
        
        // Buscar em CLIENTES
        for (let [nomeCliente, dadosCliente] of Object.entries(cacheClientesCompletos || {})) {
            if (nomeCliente.toUpperCase().includes(termo)) {
                encontrou = true;
                mensagem += await montarHistoricoCliente(nomeCliente, dadosCliente);
                mensagem += `\n${"─".repeat(50)}\n\n`;
            }
        }
        
        // Buscar em MOTORISTAS
        for (let [nomeMotorista, dadosMotorista] of Object.entries(cacheMotoristasAgrupados)) {
            if (nomeMotorista.toUpperCase().includes(termo)) {
                encontrou = true;
                mensagem += await montarHistoricoMotorista(nomeMotorista, dadosMotorista);
                mensagem += `\n`;
            }
        }
        
        esconderLoading();
        
        if (!encontrou) {
            alert(`❌ Nenhum resultado encontrado para "${termo}".\n\n` +
                  `💡 Dicas:\n` +
                  `• Verifique a ortografia\n` +
                  `• Para prefixo, use "01" ou "CARRO-01"\n` +
                  `• Use * para resumo geral\n` +
                  `• Use # para ver devedores`);
            return;
        }
        
        alert(mensagem);
        
        if (confirm("📄 Deseja gerar relatório completo?")) {
            if (typeof gerarRelatorio === 'function') gerarRelatorio();
        }
        
    } catch (error) {
        console.error("Erro na busca:", error);
        esconderLoading();
        alert("❌ Erro ao buscar dados. Verifique a conexão.");
    }
}

// ========== HISTÓRICO FINANCEIRO DO CLIENTE ==========
async function montarHistoricoCliente(nomeCliente, dados) {
    let texto = `👤 CLIENTE: ${nomeCliente}\n`;
    texto += `💰 Histórico Financeiro:\n`;
    texto += `   • Débito Total: R$ ${(dados.totalDevido || 0).toFixed(2)}\n`;
    texto += `   • Já Amortizou: R$ ${(dados.totalPago || 0).toFixed(2)}\n`;
    texto += `   • ⚠️ Saldo Pendente: R$ ${((dados.totalDevido || 0) - (dados.totalPago || 0)).toFixed(2)}\n`;
    
    if (dados.whatsapp) {
        texto += `   • 📱 WhatsApp: ${dados.whatsapp}\n`;
    }
    
    if (dados.corridas && dados.corridas.length > 0) {
        texto += `\n   📋 Corridas no Crédito:\n`;
        for (let corrida of dados.corridas) {
            const data = corrida.data ? new Date(corrida.data).toLocaleDateString('pt-BR') : "Data não informada";
            texto += `      • ${data}: R$ ${(corrida.valor || 0).toFixed(2)}`;
            if (corrida.pago) texto += ` [PAGO]`;
            texto += `\n`;
        }
    }
    
    if (dados.amortizacoes && dados.amortizacoes.length > 0) {
        texto += `\n   ✅ Amortizações Realizadas:\n`;
        for (let amort of dados.amortizacoes) {
            const data = amort.data ? new Date(amort.data).toLocaleDateString('pt-BR') : "Data não informada";
            texto += `      • ${data}: R$ ${(amort.valor || 0).toFixed(2)}\n`;
        }
    }
    
    return texto;
}

// ========== HISTÓRICO DO MOTORISTA (CARROS, DATAS, FATURAMENTO) ==========
async function montarHistoricoMotorista(nomeMotorista, dados) {
    let texto = `\n👨‍✈️ MOTORISTA: ${nomeMotorista.toUpperCase()}\n`;
    texto += `═══════════════════════════════\n`;
    texto += `💰 Faturamento Total: R$ ${(dados.faturamentoTotal || 0).toFixed(2)}\n`;
    texto += `📊 Total de Corridas: ${dados.totalCorridas || 0}\n`;
    texto += `🚗 Total de Turnos: ${dados.turnos.length}\n\n`;
    
    if (dados.turnos.length === 0) {
        texto += `   Nenhum turno encontrado.\n`;
    } else {
        texto += `   📅 HISTÓRICO POR DATA E PREFIXO:\n`;
        texto += `   ${"─".repeat(40)}\n`;
        
        const turnosOrdenados = [...dados.turnos].sort((a, b) => 
            new Date(b.dataAbertura) - new Date(a.dataAbertura)
        );
        
        for (let turno of turnosOrdenados) {
            const dataFormatada = turno.dataAbertura ? 
                new Date(turno.dataAbertura).toLocaleDateString('pt-BR') : 
                "Data não registrada";
            
            const prefixo = turno.prefixo || "Não informado";
            const faturamento = turno.faturamento || 0;
            const kmInicial = turno.kmInicial || "?";
            const kmFinal = turno.kmFinal || "?";
            
            texto += `   📆 ${dataFormatada}\n`;
            texto += `      🚗 Prefixo: ${prefixo}\n`;
            texto += `      💰 Faturamento do dia: R$ ${faturamento.toFixed(2)}\n`;
            texto += `      📟 KM: ${kmInicial} → ${kmFinal}\n`;
            
            if (turno.corridas && turno.corridas.length > 0) {
                const corridasNormais = turno.corridas.filter(c => c.tipo !== 'credito').length;
                const corridasCredito = turno.corridas.filter(c => c.tipo === 'credito').length;
                texto += `      🚖 Corridas: ${turno.corridas.length} total (${corridasNormais} normal, ${corridasCredito} crédito)\n`;
            }
            texto += `   ${"─".repeat(35)}\n`;
        }
    }
    
    return texto;
}

// ========== BUSCA POR PREFIXO ==========
async function buscarPorPrefixo(termo) {
    let prefixoBusca = termo.replace(/CARRO-/i, '');
    if (/^\d+$/.test(prefixoBusca) && prefixoBusca.length === 1) {
        prefixoBusca = '0' + prefixoBusca;
    }
    
    mostrarLoading(`Buscando prefixo ${prefixoBusca}...`);
    
    try {
        await carregarTodosDados();
        
        const turnosComPrefixo = [];
        
        for (let [idTurno, turno] of Object.entries(cacheTurnosCompletos || {})) {
            let prefixoTurno = (turno.prefixo || '').replace(/CARRO-/i, '');
            if (prefixoTurno === prefixoBusca || turno.prefixo === termo) {
                turnosComPrefixo.push({ id: idTurno, ...turno });
            }
        }
        
        if (turnosComPrefixo.length === 0) {
            esconderLoading();
            alert(`❌ Nenhum turno encontrado para o prefixo "${termo}".`);
            return;
        }
        
        const porMotorista = {};
        for (let turno of turnosComPrefixo) {
            const motorista = turno.motorista || "Motorista não identificado";
            if (!porMotorista[motorista]) porMotorista[motorista] = [];
            porMotorista[motorista].push(turno);
        }
        
        let faturamentoTotal = 0;
        for (let turno of turnosComPrefixo) faturamentoTotal += turno.faturamento || 0;
        
        let mensagem = `🔎 BUSCA POR PREFIXO: ${termo.toUpperCase()}\n`;
        mensagem += `══════════════════════════════════════\n\n`;
        mensagem += `🚗 PREFIXO: ${termo.toUpperCase()}\n`;
        mensagem += `💰 FATURAMENTO TOTAL GERADO: R$ ${faturamentoTotal.toFixed(2)}\n`;
        mensagem += `📊 QUANTIDADE DE DIAS UTILIZADO: ${turnosComPrefixo.length}\n\n`;
        
        for (let [motorista, turnos] of Object.entries(porMotorista)) {
            mensagem += `👨‍✈️ MOTORISTA: ${motorista.toUpperCase()}\n`;
            mensagem += `   ${"─".repeat(40)}\n`;
            
            turnos.sort((a, b) => new Date(b.dataAbertura) - new Date(a.dataAbertura));
            let faturamentoMotorista = 0;
            for (let turno of turnos) {
                faturamentoMotorista += turno.faturamento || 0;
                const dataFormatada = turno.dataAbertura ? 
                    new Date(turno.dataAbertura).toLocaleDateString('pt-BR') : 
                    "Data não registrada";
                mensagem += `   📆 DATA: ${dataFormatada}\n`;
                mensagem += `      💰 Faturamento do dia: R$ ${(turno.faturamento || 0).toFixed(2)}\n`;
                mensagem += `      🚖 Corridas: ${turno.corridas?.length || 0}\n`;
                if (turno.kmInicial) {
                    mensagem += `      📟 KM: ${turno.kmInicial} → ${turno.kmFinal || '?'}\n`;
                }
                mensagem += `   ${"─".repeat(35)}\n`;
            }
            mensagem += `   💵 Total gerado por ${motorista}: R$ ${faturamentoMotorista.toFixed(2)}\n\n`;
        }
        
        esconderLoading();
        alert(mensagem);
        
        if (confirm("📄 Deseja ver relatório detalhado de todos os turnos?")) {
            if (typeof gerarRelatorio === 'function') gerarRelatorio();
        }
        
    } catch (error) {
        console.error("Erro na busca por prefixo:", error);
        esconderLoading();
        alert("❌ Erro ao buscar prefixo.");
    }
}

// ========== CARREGAR TODOS OS DADOS DO FIREBASE ==========
async function carregarTodosDados(forceReload = false) {
    const agora = Date.now();
    if (!forceReload && cacheTurnosCompletos && (agora - ultimaAtualizacaoCache) < TEMPO_CACHE) {
        return;
    }
    
    if (!firebase || !firebase.database) {
        throw new Error("Firebase não inicializado");
    }
    
    const snapshotTurnos = await firebase.database().ref('turnos').once('value');
    cacheTurnosCompletos = snapshotTurnos.val() || {};
    
    const snapshotClientes = await firebase.database().ref('clientes').once('value');
    cacheClientesCompletos = snapshotClientes.val() || {};
    
    // Processar motoristas
    cacheMotoristasAgrupados = {};
    for (let [idTurno, turno] of Object.entries(cacheTurnosCompletos)) {
        const nomeMotorista = turno.motorista;
        if (!nomeMotorista) continue;
        
        if (!cacheMotoristasAgrupados[nomeMotorista]) {
            cacheMotoristasAgrupados[nomeMotorista] = {
                turnos: [],
                faturamentoTotal: 0,
                totalCorridas: 0
            };
        }
        
        cacheMotoristasAgrupados[nomeMotorista].turnos.push({
            id: idTurno,
            dataAbertura: turno.dataAbertura,
            prefixo: turno.prefixo,
            faturamento: turno.faturamento || 0,
            corridas: turno.corridas || [],
            kmInicial: turno.kmInicial,
            kmFinal: turno.kmFinal,
            status: turno.status
        });
        
        cacheMotoristasAgrupados[nomeMotorista].faturamentoTotal += (turno.faturamento || 0);
        cacheMotoristasAgrupados[nomeMotorista].totalCorridas += (turno.corridas?.length || 0);
    }
    
    ultimaAtualizacaoCache = agora;
}

// ========== RELATÓRIO DE TODOS OS MOTORISTAS ==========
async function mostrarRelatorioMotoristas() {
    mostrarLoading("Gerando relatório de motoristas...");
    try {
        await carregarTodosDados();
        let mensagem = `📊 RELATÓRIO COMPLETO DE MOTORISTAS\n`;
        mensagem += `══════════════════════════════════════\n\n`;
        
        const motoristasArray = Object.entries(cacheMotoristasAgrupados);
        if (motoristasArray.length === 0) {
            mensagem += `Nenhum motorista encontrado.\n`;
        } else {
            motoristasArray.sort((a, b) => b[1].faturamentoTotal - a[1].faturamentoTotal);
            for (let [nome, dados] of motoristasArray) {
                mensagem += `👨‍✈️ ${nome.toUpperCase()}\n`;
                mensagem += `   💰 Faturamento Total: R$ ${dados.faturamentoTotal.toFixed(2)}\n`;
                mensagem += `   🚖 Total de Corridas: ${dados.totalCorridas}\n`;
                mensagem += `   🚗 Dias Trabalhados: ${dados.turnos.length}\n`;
                
                const ultimosTurnos = [...dados.turnos].sort((a,b) => 
                    new Date(b.dataAbertura) - new Date(a.dataAbertura)
                ).slice(0, 3);
                
                if (ultimosTurnos.length > 0) {
                    mensagem += `   📅 Últimos dias:\n`;
                    for (let turno of ultimosTurnos) {
                        const data = turno.dataAbertura ? 
                            new Date(turno.dataAbertura).toLocaleDateString('pt-BR') : "?";
                        mensagem += `      • ${data} - Prefixo ${turno.prefixo || '?'} - R$ ${(turno.faturamento || 0).toFixed(2)}\n`;
                    }
                }
                mensagem += `\n`;
            }
        }
        esconderLoading();
        alert(mensagem);
    } catch (error) {
        console.error(error);
        esconderLoading();
        alert("❌ Erro ao gerar relatório de motoristas.");
    }
}

// ========== RELATÓRIO DE TODOS OS PREFIXOS ==========
async function mostrarRelatorioPrefixos() {
    mostrarLoading("Gerando relatório de prefixos...");
    try {
        await carregarTodosDados();
        const prefixosMap = {};
        for (let [idTurno, turno] of Object.entries(cacheTurnosCompletos || {})) {
            const prefixo = turno.prefixo;
            if (!prefixo) continue;
            if (!prefixosMap[prefixo]) {
                prefixosMap[prefixo] = { turnos: [], faturamentoTotal: 0, totalCorridas: 0 };
            }
            prefixosMap[prefixo].turnos.push({
                data: turno.dataAbertura,
                motorista: turno.motorista,
                faturamento: turno.faturamento || 0,
                corridas: turno.corridas?.length || 0
            });
            prefixosMap[prefixo].faturamentoTotal += (turno.faturamento || 0);
            prefixosMap[prefixo].totalCorridas += (turno.corridas?.length || 0);
        }
        
        let mensagem = `📊 RELATÓRIO COMPLETO DE PREFIXOS\n`;
        mensagem += `══════════════════════════════════════\n\n`;
        const prefixosArray = Object.entries(prefixosMap);
        if (prefixosArray.length === 0) {
            mensagem += `Nenhum prefixo encontrado.\n`;
        } else {
            prefixosArray.sort((a, b) => b[1].faturamentoTotal - a[1].faturamentoTotal);
            for (let [prefixo, dados] of prefixosArray) {
                mensagem += `🚗 PREFIXO: ${prefixo}\n`;
                mensagem += `   💰 Faturamento Total: R$ ${dados.faturamentoTotal.toFixed(2)}\n`;
                mensagem += `   🚖 Total de Corridas: ${dados.totalCorridas}\n`;
                mensagem += `   📅 Dias Utilizado: ${dados.turnos.length}\n`;
                mensagem += `   👨‍✈️ Motoristas que usaram:\n`;
                const motoristasDoPrefixo = {};
                for (let turno of dados.turnos) {
                    if (!motoristasDoPrefixo[turno.motorista]) motoristasDoPrefixo[turno.motorista] = 0;
                    motoristasDoPrefixo[turno.motorista] += turno.faturamento;
                }
                for (let [motorista, fat] of Object.entries(motoristasDoPrefixo)) {
                    mensagem += `      • ${motorista}: R$ ${fat.toFixed(2)}\n`;
                }
                mensagem += `\n`;
            }
        }
        esconderLoading();
        alert(mensagem);
    } catch (error) {
        console.error(error);
        esconderLoading();
        alert("❌ Erro ao gerar relatório de prefixos.");
    }
}

// ========== CLIENTES DEVEDORES ==========
async function mostrarClientesDevedores() {
    mostrarLoading("Buscando clientes devedores...");
    try {
        await carregarTodosDados();
        const devedores = [];
        for (let [nome, dados] of Object.entries(cacheClientesCompletos || {})) {
            const saldo = (dados.totalDevido || 0) - (dados.totalPago || 0);
            if (saldo > 0.01) {
                devedores.push({ nome, saldo, dados });
            }
        }
        devedores.sort((a, b) => b.saldo - a.saldo);
        esconderLoading();
        
        if (devedores.length === 0) {
            alert("✅ Ótimo! Não há clientes com débito pendente!");
            return;
        }
        
        let mensagem = `📋 CLIENTES DEVEDORES (${devedores.length})\n`;
        mensagem += `══════════════════════════════════════\n\n`;
        mensagem += `💰 Total em Débito: R$ ${devedores.reduce((sum, d) => sum + d.saldo, 0).toFixed(2)}\n\n`;
        for (let devedor of devedores) {
            mensagem += `👤 ${devedor.nome}\n`;
            mensagem += `   💳 Débito: R$ ${devedor.saldo.toFixed(2)}\n`;
            if (devedor.dados.whatsapp) mensagem += `   📱 WhatsApp: ${devedor.dados.whatsapp}\n`;
            mensagem += `   ${"─".repeat(30)}\n`;
        }
        mensagem += `\n💡 Digite o nome do cliente para ver o histórico completo.`;
        alert(mensagem);
    } catch (error) {
        console.error(error);
        esconderLoading();
        alert("❌ Erro ao buscar devedores.");
    }
}

// ========== RESUMO TOTAL GERAL ==========
async function mostrarResumoTotalGeralMaster() {
    mostrarLoading("Calculando resumo geral...");
    try {
        await carregarTodosDados();
        
        let totalClientes = 0, totalCredito = 0, totalAmortizado = 0;
        for (let [nome, dados] of Object.entries(cacheClientesCompletos || {})) {
            totalClientes++;
            totalCredito += dados.totalDevido || 0;
            totalAmortizado += dados.totalPago || 0;
        }
        
        const totalMotoristas = Object.keys(cacheMotoristasAgrupados).length;
        let totalFaturamento = 0, totalCorridas = 0, totalTurnos = 0;
        for (let [nome, dados] of Object.entries(cacheMotoristasAgrupados)) {
            totalFaturamento += dados.faturamentoTotal;
            totalCorridas += dados.totalCorridas;
            totalTurnos += dados.turnos.length;
        }
        
        const prefixosSet = new Set();
        for (let [id, turno] of Object.entries(cacheTurnosCompletos || {})) {
            if (turno.prefixo) prefixosSet.add(turno.prefixo);
        }
        
        const saldoPendente = totalCredito - totalAmortizado;
        esconderLoading();
        
        const resumo = `
╔══════════════════════════════════════════════════╗
║           📊 RESUMO TOTAL GERAL (MASTER)         ║
╠══════════════════════════════════════════════════╣
║                                                   ║
║ 👥 CLIENTES                                       ║
║    • Total de Clientes: ${totalClientes.toString().padStart(6)}                    ║
║    • Crédito Concedido: R$ ${totalCredito.toFixed(2).padStart(10)}        ║
║    • Já Amortizado:    R$ ${totalAmortizado.toFixed(2).padStart(10)}        ║
║    • ⚠️ Saldo Pendente:  R$ ${saldoPendente.toFixed(2).padStart(10)}        ║
║                                                   ║
║ 🚖 MOTORISTAS                                     ║
║    • Motoristas Ativos: ${totalMotoristas.toString().padStart(6)}                    ║
║    • Total de Turnos:   ${totalTurnos.toString().padStart(6)}                    ║
║    • Total de Corridas: ${totalCorridas.toString().padStart(6)}                    ║
║    • Faturamento Total: R$ ${totalFaturamento.toFixed(2).padStart(10)}        ║
║                                                   ║
║ 🚗 PREFIXOS                                       ║
║    • Prefixos Utilizados: ${prefixosSet.size.toString().padStart(6)}                  ║
║                                                   ║
║ 📈 MÉDIAS                                         ║
║    • Média por Motorista: R$ ${(totalFaturamento/totalMotoristas || 0).toFixed(2).padStart(10)}    ║
║    • Média por Turno:     R$ ${(totalFaturamento/totalTurnos || 0).toFixed(2).padStart(10)}        ║
║                                                   ║
╚══════════════════════════════════════════════════╝

✅ Sistema pronto para auditoria!
💡 Comandos rápidos:
   • Digite NOME → Busca cliente ou motorista
   • Digite 01 → Busca prefixo CARRO-01
   • Digite @ → Relatório de motoristas
   • Digite $ → Relatório de prefixos
   • Digite # → Lista de devedores
`;
        alert(resumo);
        if (confirm("📄 Deseja gerar relatório detalhado?")) {
            if (typeof gerarRelatorio === 'function') gerarRelatorio();
        }
    } catch (error) {
        console.error(error);
        esconderLoading();
        alert("❌ Erro ao gerar resumo geral.");
    }
}

// ========== FUNÇÕES AUXILIARES ==========
function mostrarLoading(mensagem = "Carregando...") {
    let loadingDiv = document.getElementById('loadingOverlay');
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'loadingOverlay';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            color: white;
            font-size: 18px;
            font-weight: bold;
            backdrop-filter: blur(4px);
        `;
        document.body.appendChild(loadingDiv);
    }
    loadingDiv.innerHTML = `
        <div style="background: #1e2937; padding: 20px 40px; border-radius: 12px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 10px;">⏳</div>
            <div>${mensagem}</div>
        </div>
    `;
    loadingDiv.style.display = 'flex';
}

function esconderLoading() {
    const loadingDiv = document.getElementById('loadingOverlay');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
}

// ========== BOTÕES DO PAINEL MASTER ==========
function adicionarBotoesMaster() {
    const painel = document.getElementById('painelFiltroMaster');
    if (!painel) return;
    
    if (document.getElementById('btnBuscaAvancada')) return;
    
    const divNova = document.createElement('div');
    divNova.style.marginTop = "12px";
    divNova.style.display = "flex";
    divNova.style.flexDirection = "column";
    divNova.style.gap = "8px";
    divNova.innerHTML = `
        <button id="btnBuscaAvancada" onclick="consultarMasterAvancado()" style="width:100%;padding:12px;background:#8b5cf6;color:white;border:none;border-radius:8px;font-weight:bold;">
            🔎 CONSULTA AVANÇADA (Cliente / Motorista / Prefixo)
        </button>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button onclick="mostrarRelatorioMotoristas()" style="padding:10px;background:#3b82f6;color:white;border:none;border-radius:8px;">
                👨‍✈️ MOTORISTAS (@)
            </button>
            <button onclick="mostrarRelatorioPrefixos()" style="padding:10px;background:#10b981;color:white;border:none;border-radius:8px;">
                🚗 PREFIXOS ($)
            </button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button onclick="mostrarResumoTotalGeralMaster()" style="padding:10px;background:#eab308;color:#1e2937;border:none;border-radius:8px;">
                📈 RESUMO GERAL (*)
            </button>
            <button onclick="mostrarClientesDevedores()" style="padding:10px;background:#ef4444;color:white;border:none;border-radius:8px;">
                💰 DEVEDORES (#)
            </button>
        </div>
    `;
    painel.appendChild(divNova);
}

// Integração automática
setTimeout(() => {
    if (typeof usuarioLogado !== 'undefined' && usuarioLogado === 'master') {
        adicionarBotoesMaster();
    }
}, 1500);

console.log("✅ Sistema de Busca Avançada Master carregado com sucesso!");
