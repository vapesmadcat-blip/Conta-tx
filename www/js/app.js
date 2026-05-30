/**
 * APP.JS - Sincronização Inteligente por Controle de Turnos e Caixas Híbridos (Com Perfil Folguista/Efetivo)
 */

const firebaseConfig = {
    apiKey: "AIzaSyAY217DxZeZZMlg0ZpHYFvXoALrkd5zcPM",
    authDomain: "driverflux.firebaseapp.com",
    databaseURL: "https://driverflux-default-rtdb.firebaseio.com",
    projectId: "driverflux",
    storageBucket: "driverflux.firebasestorage.app",
    messagingSenderId: "855577761510",
    appId: "1:855577761510:web:7e4c0911921a5c18c34d27"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

let turnosHistoricoMaster = {}; 
let registros = [];             
let pagamentos = [];            
let coordenadaAtual = null;
let filtroTexto = "";
let usuarioLogado = "";         
let idTurnoAtivo = "";          
let metadadosTurno = { trocoInicial: 0, status: "fechado", tipoContrato: "efetivo" };
let motoristasCadastroMaster = {}; // Guarda a tabela de senhas e tipos de contrato

function gerarContraSenhaEsperada(codigoDesafio) {
    return (parseInt(codigoDesafio) * 3) + 1234;
}

function checarLicenciamento() {
    if (localStorage.getItem('driverflux_licenca_ativa') === 'true') {
        document.getElementById('telaAtivacao').style.display = 'none';
        verificarSessaoLogin();
    } else {
        let desafio = localStorage.getItem('driverflux_codigo_desafio') || Math.floor(1000 + Math.random() * 9000).toString();
        localStorage.setItem('driverflux_codigo_desafio', desafio);
        document.getElementById('txtCodigoDesafio').innerText = desafio;
        document.getElementById('telaAtivacao').style.display = 'block';
    }
}

function verificarAtivacao() {
    const desafio = localStorage.getItem('driverflux_codigo_desafio');
    const digitada = parseInt(document.getElementById('inputContraSenha').value);
    if (digitada === gerarContraSenhaEsperada(desafio)) {
        localStorage.setItem('driverflux_licenca_ativa', 'true');
        checarLicenciamento();
    } else { alert("❌ Contra-senha inválida!"); }
}

function verificarSessaoLogin() {
    const salvo = localStorage.getItem('driverflux_usuario_logado');
    if (salvo) {
        usuarioLogado = salvo;
        document.getElementById('telaLogin').style.display = 'none';
        
        // Puxa o tipo de contrato do motorista atual antes de liberar o painel
        db.ref(`usuarios/${usuarioLogado}`).once('value').then((snapshot) => {
            let dadosUser = snapshot.val();
            let contratoStr = (dadosUser && dadosUser.tipo) ? dadosUser.tipo.toUpperCase() : "EFETIVO";
            
            if (usuarioLogado === 'master') {
                document.getElementById('telaAberturaTurno').style.display = 'none';
                document.getElementById('conteudoApp').style.display = 'block';
                document.getElementById('painelFiltroMaster').style.display = 'block';
                document.getElementById('btnMenuIncluir').style.display = 'none';
                document.getElementById('btnFecharTurnoOficial').style.display = 'none';
                document.getElementById('lblUsuarioAtivo').innerText = `Operador: ${usuarioLogado.toUpperCase()}`;
                inicializarMaster();
            } else {
                document.getElementById('painelFiltroMaster').style.display = 'none';
                document.getElementById('btnMenuIncluir').style.display = 'flex';
                document.getElementById('btnFecharTurnoOficial').style.display = 'block';
                document.getElementById('lblUsuarioAtivo').innerText = `Operador: ${usuarioLogado.toUpperCase()} (${contratoStr})`;
                verificarStatusTurnoMotorista();
            }
        });
    } else {
        document.getElementById('conteudoApp').style.display = 'none';
        document.getElementById('telaAberturaTurno').style.display = 'none';
        document.getElementById('telaLogin').style.display = 'block';
        garantirUsuariosBaseNoFirebase();
    }
}

function realizarLogin() {
    const user = document.getElementById('loginUsuario').value.trim().toLowerCase();
    const pass = document.getElementById('loginSenha').value.trim();
    if (!user || !pass) return alert("⚠️ Digite o usuário e a senha.");

    db.ref(`usuarios/${user}`).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const dadosUser = snapshot.val();
            // Valida se a senha bate (seja string simples ou objeto estruturado)
            const senhaCorreta = (typeof dadosUser === 'object') ? dadosUser.senha : dadosUser;
            
            if (senhaCorreta === pass) {
                localStorage.setItem('driverflux_usuario_logado', user);
                document.getElementById('loginUsuario').value = "";
                document.getElementById('loginSenha').value = "";
                verificarSessaoLogin();
            } else { alert("❌ Senha incorreta!"); }
        } else { alert("❌ Usuário não cadastrado!"); }
    }).catch(() => alert("Erro ao autenticar."));
}

function efetuarLogout() {
    localStorage.removeItem('driverflux_usuario_logado');
    usuarioLogado = "";
    idTurnoAtivo = "";
    document.getElementById('cardTotais').style.display = 'none';
    document.getElementById('cardRelatorio').style.display = 'none';
    verificarSessaoLogin();
}

function verificarStatusTurnoMotorista() {
    db.ref(`turnos_operacionais/${usuarioLogado}`).orderByChild("status").equalTo("aberto").limitToLast(1).once("value", (snapshot) => {
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                idTurnoAtivo = child.key;
                metadadosTurno = child.val();
            });
            document.getElementById('telaAberturaTurno').style.display = 'none';
            document.getElementById('conteudoApp').style.display = 'block';
            document.getElementById('lblIdTurnoAtivo').innerText = `Turno Ativo: #${idTurnoAtivo.substring(1, 8).toUpperCase()}`;
            inicializarMotorista();
        } else {
            document.getElementById('conteudoApp').style.display = 'none';
            document.getElementById('telaAberturaTurno').style.display = 'block';
        }
    });
}

function abrirTurnoOperacional() {
    const troco = parseFloat(document.getElementById('inputTrocoInicial').value) || 0;
    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    
    // Busca o tipo do contrato para carimbar o turno de forma definitiva
    db.ref(`usuarios/${usuarioLogado}`).once('value').then((snapshot) => {
        const dadosUser = snapshot.val();
        const tipoContrato = (dadosUser && dadosUser.tipo) ? dadosUser.tipo : "efetivo";

        const novoTurnoRef = db.ref(`turnos_operacionais/${usuarioLogado}`).push();
        idTurnoAtivo = novoTurnoRef.key;
        
        metadadosTurno = {
            id: idTurnoAtivo,
            motorista: usuarioLogado,
            status: "aberto",
            abertura: dataStr,
            trocoInicial: troco,
            fechamento: "",
            tipoContrato: tipoContrato
        };

        novoTurnoRef.set(metadadosTurno).then(() => {
            verificarStatusTurnoMotorista();
        });
    });
}

function gangsterTurnoDefinitivo() { encerrarTurnoDefinitivo(); } // Alias de suporte

function registrarPagamento() {
    const cliente = document.getElementById('inputPesquisa').value.trim();
    const valor = parseFloat(document.getElementById('inputValorPagamento').value) || 0;
    if (!cliente || valor <= 0) return alert("⚠️ Informe um valor válido.");
    db.ref("pagamentos").push({
        cliente: cliente, valor: valor, data: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})
    }).then(() => { document.getElementById('inputValorPagamento').value = ""; alert("✅ Amortização realizada!"); processarConsultaCliente(); });
}

function encerrarTurnoDefinitivo() {
    if (confirm("⚠️ Tem certeza que deseja FECHAR O CAIXA e encerrar o seu turno operacional?")) {
        const agora = new Date();
        const dataStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        
        db.ref(`turnos_operacionais/${usuarioLogado}/${idTurnoAtivo}`).update({
            status: "fechado",
            fechamento: dataStr
        }).then(() => {
            alert("🔴 Turno encerrado com sucesso! Entregue o caixa ao gerente.");
            efetuarLogout();
        });
    }
}

function inicializarMotorista() {
    const cache = localStorage.getItem(`driverflux_cache_${idTurnoAtivo}`);
    if (cache) { registros = JSON.parse(cache); renderizarTabela(); }

    db.ref(`corridas_por_turno/${idTurnoAtivo}`).on("value", (snapshot) => {
        registros = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(k => {
                let item = data[k];
                item.docId = k;
                registros.push(item);
            });
            registros.sort((a, b) => a.id - b.id);
        }
        localStorage.setItem(`driverflux_cache_${idTurnoAtivo}`, JSON.stringify(registros));
        renderizarTabela();
        atualizarListaSugestoes();
    });
}

function inicializarMaster() {
    // Busca a tabela de motoristas para saber quem é folguista na listagem
    db.ref("usuarios").once("value", (snapshotUser) => {
        motoristasCadastroMaster = snapshotUser.val() || {};
        
        db.ref("turnos_operacionais").on("value", (snapshot) => {
            const data = snapshot.val();
            const select = document.getElementById('selectFiltroTurnoMaster');
            select.innerHTML = '<option value="">-- Escolha um Turno / Caixa para Auditar --</option>';
            turnosHistoricoMaster = {};

            if (data) {
                Object.keys(data).forEach(motorista => {
                    Object.keys(data[motorista]).forEach(turnoId => {
                        const t = data[motorista][turnoId];
                        turnosHistoricoMaster[turnoId] = t;
                        
                        // Descobre o contrato cadastrado na raiz
                        let mInfo = motoristasCadastroMaster[motorista];
                        let tContrato = (mInfo && mInfo.tipo) ? mInfo.tipo : (t.tipoContrato || "efetivo");

                        const opt = document.createElement('option');
                        opt.value = turnoId;
                        const statusIcon = t.status === 'aberto' ? '🟢 (Ativo)' : '🔴 (Fechado)';
                        opt.innerText = `${statusIcon} ${t.motorista.toUpperCase()} [${tContrato.toUpperCase()}] | Início: ${t.abertura}`;
                        select.appendChild(opt);
                    });
                });
            }
        });
    });
}

function selecionarTurnoParaVerificacaoMaster() {
    const selectedId = document.getElementById('selectFiltroTurnoMaster').value;
    document.getElementById('cardTotais').style.display = 'none';
    document.getElementById('cardRelatorio').style.display = 'none';

    if (!selectedId) {
        registros = [];
        renderizarTabela();
        document.getElementById('lblIdTurnoAtivo').innerText = "Turno: Nenhum selecionado";
        return;
    }

    metadadosTurno = turnosHistoricoMaster[selectedId];
    idTurnoAtivo = selectedId;
    
    let contratoLog = metadadosTurno.tipoContrato ? metadadosTurno.tipoContrato.toUpperCase() : "EFETIVO";
    document.getElementById('lblIdTurnoAtivo').innerText = `Auditoria Turno: #${idTurnoAtivo.substring(1, 8).toUpperCase()} | Tipo: ${contratoLog}`;

    db.ref(`corridas_por_turno/${selectedId}`).once("value", (snapshot) => {
        registros = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(k => {
                let item = data[k];
                item.docId = k;
                registros.push(item);
            });
            registros.sort((a, b) => a.id - b.id);
        }
        renderizarTabela();
    });
}

function renderizarTabela() {
    const tbody = document.querySelector('#tabelaDados tbody');
    tbody.innerHTML = '';

    registros.forEach(reg => {
        const tr = document.createElement('tr');
        const descTipo = reg.tipo === 'credito' ? '🟡 Crédito' : '🟢 Normal';
        const descCliente = reg.tipo === 'credito' ? (reg.cliente || 'N/I') : 'Passageiro Balcão';
        const valorExibido = reg.tipo === 'credito' ? (reg.corrida + reg.emprestado) : reg.corrida;

        if (usuarioLogado === 'master') {
            tr.innerHTML = `<td>#${reg.id}</td><td>${descTipo}</td><td>${descCliente}</td><td>${formatarMoeda(valorExibido)}</td><td>🔒</td>`;
        } else {
            tr.innerHTML = `
                <td>#${reg.id}</td><td>${descTipo}</td><td>${descCliente}</td><td>${formatarMoeda(valorExibido)}</td>
                <td><button class="btn-cancel" style="padding:4px 8px; font-size:11px; width:auto;" onclick="abrirModalEdicao(${reg.id})">Editar</button></td>
            `;
        }
        tbody.appendChild(tr);
    });
}

function abrirModalInsercao() {
    document.getElementById('modalTitle').innerText = "Lançar Corrida no Caixa";
    document.getElementById('editId').value = "";
    document.getElementById('inputTipoLancamento').value = "normal"; 
    document.getElementById('inputCorrida').value = "";
    document.getElementById('inputCliente').value = "";
    document.getElementById('inputEmprestimo').value = "0";
    
    ajustarCamposPorModalidade();
    document.getElementById('formModal').style.display = 'flex';

    GeoLocation.capturarCoordenadas(
        (lat, lng, acc) => { coordenadaAtual = { latitude: lat, longitude: lng, accuracy: acc }; document.getElementById('gpsStatus').innerText = "✅ GPS Conectado"; },
        () => { document.getElementById('gpsStatus').innerText = "⚠️ Sem Sinal GPS"; }
    );
}

function abrirModalEdicao(id) {
    const reg = registros.find(r => r.id === id);
    if (!reg) return;

    document.getElementById('modalTitle').innerText = `Alterar Registro #${id}`;
    document.getElementById('editId').value = id;
    document.getElementById('inputTipoLancamento').value = reg.tipo || "normal";
    document.getElementById('inputCorrida').value = reg.corrida;
    document.getElementById('inputCliente').value = reg.cliente || "";
    document.getElementById('inputEmprestimo').value = reg.emprestado || 0;

    ajustarCamposPorModalidade();
    coordenadaAtual = reg.gps || null;
    document.getElementById('gpsStatus').innerText = reg.gps ? "📍 Localização Gravada" : "⚠️ Sem GPS";
    document.getElementById('formModal').style.display = 'flex';
}

function fecharModal() { document.getElementById('formModal').style.display = 'none'; coordenadaAtual = null; }

function salvarDados() {
    const idEdit = document.getElementById('editId').value;
    const tipo = document.getElementById('inputTipoLancamento').value;
    const vCorrida = parseFloat(document.getElementById('inputCorrida').value) || 0;
    let nomeCliente = "Passageiro Avulso";
    let vEmprestimo = 0;

    if (vCorrida <= 0) return alert("⚠️ Digite o valor da corrida.");

    if (tipo === 'credito') {
        nomeCliente = document.getElementById('inputCliente').value.trim();
        vEmprestimo = parseFloat(document.getElementById('inputEmprestimo').value) || 0;
        if (!nomeCliente) return alert("⚠️ Digite o nome do cliente.");
    }

    const dataHoraStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    if (idEdit) {
        const reg = registros.find(r => r.id === parseInt(idEdit));
        if (reg && reg.docId) {
            db.ref(`corridas_por_turno/${idTurnoAtivo}/${reg.docId}`).update({
                tipo: tipo, cliente: nomeCliente, emprestado: vEmprestimo, corrida: vCorrida, dataHora: dataHoraStr, gps: coordenadaAtual || reg.gps || null
            }).then(() => fecharModal());
        }
    } else {
        let proximoId = 1;
        if (registros.length > 0) proximoId = Math.max(...registros.map(r => r.id)) + 1;

        db.ref(`corridas_por_turno/${idTurnoAtivo}`).push({
            id: proximoId, tipo: tipo, cliente: nomeCliente, emprestado: vEmprestimo, corrida: vCorrida, dataHora: dataHoraStr, gps: coordenadaAtual
        }).then(() => fecharModal());
    }
}

function calcularTotais() {
    if (!idTurnoAtivo) return alert("⚠️ Selecione um turno ou abra seu caixa primeiro.");
    
    let tNormais = 0, tCreditoCorridas = 0, tBrutoEmprestado = 0;
    registros.forEach(r => {
        if (r.tipo === 'credito') { tCreditoCorridas += r.corrida; tBrutoEmprestado += r.emprestado; }
        else { tNormais += r.corrida; }
    });

    let juros = tBrutoEmprestado * 0.20;
    let fundoFixo = metadadosTurno.trocoInicial || 0;

    document.getElementById('totTrocoInicial').innerText = formatarMoeda(fundoFixo);
    document.getElementById('totNormais').innerText = formatarMoeda(tNormais);
    document.getElementById('totCorridasCredito').innerText = formatarMoeda(tCreditoCorridas);
    document.getElementById('totBruto').innerText = formatarMoeda(tBrutoEmprestado);
    document.getElementById('totAcrescimo').innerText = `+ ${formatarMoeda(juros)}`;
    
    let caixaFisicoEsperado = fundoFixo + tNormais;
    document.getElementById('lblGrandeTotal').innerHTML = `💵 Dinheiro Vivo esperado no Caixa do Carro:<br><small style="color:var(--texto-secundario); font-weight:normal;">(Troco inicial + Corridas pagas na hora)</small>`;
    document.getElementById('totGeral').innerText = formatarMoeda(caixaFisicoEsperado);

    document.getElementById('cardTotais').style.display = 'block';
}

function gerarRelatorio() {
    if (!idTurnoAtivo) return alert("⚠️ Sem dados abertos no momento.");

    let tNormais = 0, tCredito = 0, tEmprestado = 0;
    let contratoLog = metadadosTurno.tipoContrato ? metadadosTurno.tipoContrato.toUpperCase() : "EFETIVO";
    
    let txt = `🧾 DRIVERFLUX - RELATÓRIO DE FECHAMENTO DE CAIXA\n`;
    txt += `Operador: ${metadadosTurno.motorista.toUpperCase()} [${contratoLog}] | Status: ${metadadosTurno.status.toUpperCase()}\n`;
    txt += `Abertura: ${metadadosTurno.abertura}\n`;
    if (metadadosTurno.fechamento) txt += `Fechamento: ${metadadosTurno.fechamento}\n`;
    txt += `ID Identificador: #${idTurnoAtivo.substring(1,10).toUpperCase()}\n`;
    txt += `=========================================\n\n`;

    registros.forEach(r => {
        if (r.tipo === 'credito') {
            tCredito += r.corrida; tEmprestado += r.emprestado;
            txt += `[CRÉDITO] Reg #${r.id} - 👤 ${r.cliente}\n  Corrida: ${formatarMoeda(r.corrida)} | Emprestado: ${formatarMoeda(r.emprestado)}\n`;
        } else {
            tNormais += r.corrida;
            txt += `[CAIXA VIVO] Reg #${r.id} - Corrida Direta: ${formatarMoeda(r.corrida)}\n`;
        }
    });

    let juros = tEmprestado * 0.20;
    let fundo = metadadosTurno.trocoInicial || 0;
    txt += `\n=========================================\n`;
    txt += `(+) Fundo / Troco Inicial:   ${formatarMoeda(fundo)}\n`;
    txt += `(+) Corridas em Dinheiro/Pix: ${formatarMoeda(tNormais)}\n`;
    txt += `-----------------------------------------\n`;
    txt += `(=) CAIXA FÍSICO DO CARRO:    ${formatarMoeda(fundo + tNormais)}\n\n`;
    txt += `--- RESUMO DE ATIVOS NA RUA ---\n`;
    txt += `Corridas pendentes (fiado):  ${formatarMoeda(tCredito)}\n`;
    txt += `Capital financiado bruto:    ${formatarMoeda(tEmprestado)}\n`;
    txt += `Lucro de juros (+20%):       ${formatarMoeda(juros)}\n`;
    txt += `=========================================`;

    document.getElementById('reportOutput').innerText = txt;
    document.getElementById('reportOutput').style.display = 'block';
    document.getElementById('cardRelatorio').style.display = 'block';
}

function alternarBarraConsulta() {
    const container = document.getElementById('containerPesquisa');
    if (container.style.display === 'block') { container.style.display = 'none'; limparConsulta(); }
    else { container.style.display = 'block'; document.getElementById('inputPesquisa').focus(); }
}
function limparConsulta() { document.getElementById('inputPesquisa').value = ""; document.getElementById('fichaCliente').style.display = 'none'; filtroTexto = ""; renderizarTabela(); }

function processarConsultaCliente() {
    const busca = document.getElementById('inputPesquisa').value.trim();
    filtroTexto = busca.toLowerCase();
    renderizarTabela();
    if (!busca) { document.getElementById('fichaCliente').style.display = 'none'; return; }

    db.ref("corridas_por_turno").once("value", (snapshot) => {
        let devido = 0;
        const totalTurnos = snapshot.val();
        if (totalTurnos) {
            Object.keys(totalTurnos).forEach(tId => {
                if (totalTurnos[tId]) {
                    Object.keys(totalTurnos[tId]).forEach(cId => {
                        const r = totalTurnos[tId][cId];
                        if (r.tipo === 'credito' && r.cliente && r.cliente.toLowerCase() === busca.toLowerCase()) {
                            devido += (r.emprestado * 1.20) + r.corrida;
                        }
                    });
                }
            });
        }
        db.ref("pagamentos").once("value", (snapPag) => {
            let pago = 0;
            const dataPag = snapPag.val();
            if (dataPag) { Object.keys(dataPag).forEach(k => { if (dataPag[k].cliente.toLowerCase() === busca.toLowerCase()) pago += dataPag[k].valor; }); }
            let saldo = devido - pago;
            document.getElementById('ledgerNomeCliente').innerText = `Extrato: ${busca}`;
            document.getElementById('ledgerTotalDevido').innerText = formatarMoeda(devido);
            document.getElementById('ledgerTotalPago').innerText = formatarMoeda(pago);
            const elSaldo = document.getElementById('ledgerSaldoFinal');
            elSaldo.innerText = formatarMoeda(saldo) + (saldo > 0 ? " (Em aberto)" : " (Quitado)");
            elSaldo.className = saldo > 0 ? "danger-text" : "success-text";
            document.getElementById('fichaCliente').style.display = 'block';
        });
    });
}

function atualizarListaSugestoes() {
    db.ref("corridas_por_turno").once("value", (snapshot) => {
        let nomes = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(tId => {
                if (data[tId]) {
                    Object.keys(data[tId]).forEach(cId => {
                        const r = data[tId][cId];
                        if (r.tipo === 'credito' && r.cliente) nomes.push(r.cliente.trim());
                    });
                }
            });
        }
        const unicos = [...new Set(nomes)].sort();
        const listas = ['listaClientes', 'listaClientesConsulta'];
        listas.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.innerHTML = ''; unicos.forEach(c => { const o = document.createElement('option'); o.value = c; el.appendChild(o); }); }
        });
    });
}

function formatarMoeda(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function garantirUsuariosBaseNoFirebase() {
    db.ref("usuarios").once("value", (snapshot) => {
        if (!snapshot.exists()) { 
            db.ref("usuarios").set({ 
                "master": { senha: "master123", tipo: "gerente" }, 
                "andre": { senha: "123", tipo: "folguista" }, 
                "pedro": { senha: "456", tipo: "efetivo" } 
            }); 
        }
    });
}

function ajustarCamposPorModalidade() {
    const tipo = document.getElementById('inputTipoLancamento').value;
    document.getElementById('camposCreditoOpcionais').style.display = (tipo === 'credito') ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => { checarLicenciamento(); });
