/**
 * APP.JS - DriverFlux Oficial (Com Hodômetro, Cobrança de Fiado e Emissão de Recibo Corporativo)
 * Lógica de Negócio Completa com Fluxo de Ativação Seguro + Amortização + Consulta Master
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

let db = null;
function iniciarFirebaseSeNecessario() {
    if (localStorage.getItem('driverflux_modo_demo') !== 'true') {
        if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
        db = firebase.database();
    }
}

let turnosHistoricoMaster = {}; 
let registros = [];             
let pagamentos = [];            
let coordenadaAtual = "Não capturado"; 
let filtroTexto = "";
let usuarioLogado = "";         
let idTurnoAtivo = "";          
let metadadosTurno = { trocoInicial: 0, kmInicial: 0, status: "fechado", tipoContrato: "efetivo", prefixoCarro: "Não informado" };
let motoristasCadastroMaster = {};

const LIMITE_DEMO = 10;

function obterSenhaDefinitiva(desafio) { return (parseInt(desafio) * 13) + 6182; }
function obterSenhaDemo(desafio) { return (parseInt(desafio) * 11) + 3947; }

function checarLicenciamento() {
    const statusLicenca = localStorage.getItem('driverflux_licenca_ativa');
    const usuarioSalvo = localStorage.getItem('driverflux_usuario_logado');

    if (statusLicenca === 'true') {
        if (usuarioSalvo || localStorage.getItem('driverflux_modo_demo') === 'true') {
            document.getElementById('telaAtivacao').style.display = 'none';
            if (localStorage.getItem('driverflux_modo_demo') === 'true') {
                document.getElementById('telaLogin').style.display = 'none';
                usuarioLogado = "demo_local";
                verificarStatusTurnoMotorista(); 
            } else {
                verificarSessaoLogin();
            }
        } else {
            document.getElementById('telaAtivacao').style.display = 'none';
            document.getElementById('telaLogin').style.display = 'block';
            if(document.getElementById('conteudoApp')) document.getElementById('conteudoApp').style.display = 'none';
            iniciarFirebaseSeNecessario();
            garantirUsuariosBaseNoFirebase();
        }
    } else {
        let desafio = localStorage.getItem('driverflux_codigo_desafio') || Math.floor(1000 + Math.random() * 9000).toString();
        localStorage.setItem('driverflux_codigo_desafio', desafio);
        document.getElementById('txtCodigoDesafio').innerText = desafio;
        document.getElementById('telaAtivacao').style.display = 'block';
        document.getElementById('telaLogin').style.display = 'none';
        if(document.getElementById('conteudoApp')) document.getElementById('conteudoApp').style.display = 'none';
    }
}

function verificarAtivacao() {
    const btn = document.getElementById('btnAtivar');
    if (btn && btn.disabled) return;
    if (btn) { btn.disabled = true; btn.innerHTML = "⏳ Verificando..."; }

    const desafio = localStorage.getItem('driverflux_codigo_desafio');
    const inputVal = document.getElementById('inputContraSenha').value.trim();
    if (!inputVal) {
        alert("⚠️ Digite a contra-senha.");
        if (btn) { btn.disabled = false; btn.innerHTML = "🚀 Liberar Aplicativo"; }
        return;
    }
    
    const digitada = parseInt(inputVal, 10);

    if (digitada === obterSenhaDefinitiva(desafio)) {
        ativarVersãoCompletaDefinitiva();
    } else if (digitada === obterSenhaDemo(desafio)) {
        if (localStorage.getItem('driverflux_demo_ja_utilizada') === 'true') {
            alert("❌ Bloqueado! Período de demonstração já utilizado.");
            return;
        }
        localStorage.setItem('driverflux_licenca_ativa', 'true');
        localStorage.setItem('driverflux_modo_demo', 'true');
        localStorage.setItem('driverflux_demo_ja_utilizada', 'true'); 
        alert("🟢 Modo DEMONSTRAÇÃO ativado!");
        checarLicenciamento();
    } else { 
        alert("❌ Contra-senha incorreta!"); 
        if (btn) { btn.disabled = false; btn.innerHTML = "🚀 Liberar Aplicativo"; }
    }
}

function ativarVersãoCompletaDefinitiva() {
    localStorage.setItem('driverflux_licenca_ativa', 'true');
    localStorage.setItem('driverflux_modo_demo', 'false');
    localStorage.setItem('driverflux_demo_ja_utilizada', 'true');
    
    if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
    db = firebase.database();

    const caronaDemo = localStorage.getItem('driverflux_demo_reg');
    if (caronaDemo) {
        try {
            const corridasParaMigrar = JSON.parse(caronaDemo);
            if (corridasParaMigrar && corridasParaMigrar.length > 0) {
                const migracaoRef = db.ref("corridas_por_turno/MIGRADO_DA_DEMO");
                corridasParaMigrar.forEach(reg => {
                    migracaoRef.push({
                        id: reg.id, tipo: reg.tipo, cliente: reg.cliente + " (Vindo da Demo)",
                        emprestado: reg.emprestado || 0, corrida: reg.corrida, dataHora: reg.dataHora || "Data Demo", gps: null
                    });
                });
                alert("📦 Sucesso! Corridas registradas na demo foram migradas para a nuvem!");
            }
        } catch(e) { console.error("Sem dados válidos para migrar"); }
    }
    
    alert("🚀 Sistema COMPLETO liberado! Faça login com suas credenciais.");
    
    document.getElementById('telaAtivacao').style.display = 'none';
    document.getElementById('telaLogin').style.display = 'block';
    garantirUsuariosBaseNoFirebase();
}

function verificarSessaoLogin() {
    const salvo = localStorage.getItem('driverflux_usuario_logado');
    if (salvo) {
        usuarioLogado = salvo;
        document.getElementById('telaLogin').style.display = 'none';
        iniciarFirebaseSeNecessario();
        db.ref(`usuarios/${usuarioLogado}`).once('value').then((snapshot) => {
            let dadosUser = snapshot.val();
            let contratoStr = (dadosUser && dadosUser.tipo) ? dadosUser.tipo.toUpperCase() : "EFETIVO";
            if (usuarioLogado === 'master') {
                document.getElementById('telaAberturaTurno').style.display = 'none';
                document.getElementById('conteudoApp').style.display = 'block';
                document.getElementById('painelFiltroMaster').style.display = 'block';
                document.getElementById('lblUsuarioAtivo').innerText = `Operador: ${usuarioLogado.toUpperCase()}`;
                inicializarMaster();
            } else {
                document.getElementById('painelFiltroMaster').style.display = 'none';
                document.getElementById('lblUsuarioAtivo').innerText = `Operador: ${usuarioLogado.toUpperCase()} ({contratoStr})`;
                verificarStatusTurnoMotorista();
            }
        });
    } else {
        document.getElementById('conteudoApp').style.display = 'none';
        document.getElementById('telaAberturaTurno').style.display = 'none';
        document.getElementById('telaLogin').style.display = 'block';
        iniciarFirebaseSeNecessario();
        garantirUsuariosBaseNoFirebase();
    }
}

function renderToggleAcoesDemo() {
    if (localStorage.getItem('driverflux_modo_demo') !== 'true') return;
    
    let containerAviso = document.getElementById('badgeAvisoContador');
    if (!containerAviso) {
        containerAviso = document.createElement('div');
        containerAviso.id = "badgeAvisoContador";
        containerAviso.style.cssText = "background:#fffbeb; color:#b45309; font-size:12px; padding:10px; border-radius:10px; text-align:center; width:100%; margin-bottom:14px; font-weight:700; border:2px solid #fcd34d;";
        
        const divApp = document.getElementById('conteudoApp');
        if (divApp) { divApp.insertBefore(containerAviso, divApp.firstChild); }
    }
    
    containerAviso.innerText = `📈 Modo de Demonstração Ativo: ${registros.length} de ${LIMITE_DEMO} registros.`;
}

function abrirModalEdicao(id) { 
    if (localStorage.getItem('driverflux_modo_demo') === 'true' && id !== null) { alert("🔒 Edição de registros bloqueada no modo de demonstração."); return; }

    if (id === null) {
        document.getElementById('modalTitle').innerText = `Lançar Corrida`; 
        document.getElementById('editId').value = "";
        document.getElementById('inputTipoLancamento').value = "normal"; 
        document.getElementById('inputCorrida').value = "";
        document.getElementById('inputCliente').value = ""; 
        if(document.getElementById('inputWhatsCliente')) document.getElementById('inputWhatsCliente').value = "";
        document.getElementById('inputEmprestimo').value = 0;
    } else {
        const reg = registros.find(r => r.id === id); if (!reg) return;
        document.getElementById('modalTitle').innerText = `Alterar Registro #${id}`; 
        document.getElementById('editId').value = id;
        document.getElementById('inputTipoLancamento').value = reg.tipo || "normal"; 
        document.getElementById('inputCorrida').value = reg.corrida;
        document.getElementById('inputCliente').value = reg.cliente || ""; 
        document.getElementById('inputEmprestimo').value = reg.emprestado || 0;
        if(document.getElementById('inputWhatsCliente')) document.getElementById('inputWhatsCliente').value = reg.whatsCliente || "";
    }
    ajustarCamposPorModalidade(); 
    document.getElementById('formModal').style.display = 'flex'; 
}

function fecharModal() { document.getElementById('formModal').style.display = 'none'; }
function fecharCard(id) { document.getElementById(id).style.display = 'none'; window.scrollTo({ top: 0, behavior: 'smooth' }); }

function ajustarCamposPorModalidade() {
    const tipo = document.getElementById('inputTipoLancamento').value;
    const camposCredito = document.getElementById('camposCreditoOpcionais');
    if (camposCredito) { camposCredito.style.display = (tipo === 'credito') ? 'block' : 'none'; }
}

function capturarGpsPromessa() {
    return new Promise((resolve) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coord = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
                    resolve(coord);
                },
                (error) => { resolve("Não capturado"); },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else { resolve("Não suportado"); }
    });
}

function injetarCampoPrefixoCarroSeNecessario() {
    if (!document.getElementById('inputPrefixoCarro')) {
        const containerKm = document.getElementById('inputKmInicial').closest('.input-group');
        if (containerKm) {
            const divGrupo = document.createElement('div');
            divGrupo.className = 'input-group';
            divGrupo.style.marginBottom = '14px';
            divGrupo.innerHTML = `<label style="display:block; font-size:13px; font-weight:600; color:var(--texto-secundario); margin-bottom:4px;">🚖 Prefixo do Carro / Placa</label>
                                  <input type="text" id="inputPrefixoCarro" placeholder="Ex: CARRO-04 ou PLACA" style="width:100%; padding:11px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px;">`;
            containerKm.parentNode.insertBefore(divGrupo, containerKm);
        }
    }
}

function verificarStatusTurnoMotorista() {
    if (localStorage.getItem('driverflux_modo_demo') === 'true') {
        const tStatus = localStorage.getItem('driverflux_demo_status') || 'fechado';
        if (tStatus === 'aberto') {
            idTurnoAtivo = "DEMO-LOCAL";
            document.getElementById('telaAberturaTurno').style.display = 'none';
            document.getElementById('conteudoApp').style.display = 'block';
            document.getElementById('lblUsuarioAtivo').innerText = "Operador: TESTE DEMO";
            
            let pfx = localStorage.getItem('driverflux_demo_prefixo') || "TESTE-01";
            document.getElementById('lblIdTurnoAtivo').innerText = `Carro: ${pfx.toUpperCase()} | Modo: Demo`;
            inicializarMotorista();
        } else {
            document.getElementById('conteudoApp').style.display = 'none';
            document.getElementById('telaAberturaTurno').style.display = 'block';
            injetarCampoPrefixoCarroSeNecessario();
        }
        return;
    }

    iniciarFirebaseSeNecessario();
    db.ref(`turnos_operacionais/${usuarioLogado}`).orderByChild("status").equalTo("aberto").limitToLast(1).once("value", (snapshot) => {
        if (snapshot.exists()) {
            snapshot.forEach(child => { idTurnoAtivo = child.key; metadadosTurno = child.val(); });
            document.getElementById('telaAberturaTurno').style.display = 'none';
            document.getElementById('conteudoApp').style.display = 'block';
            
            let prefixoAtivo = metadadosTurno.prefixoCarro ? metadadosTurno.prefixoCarro.toUpperCase() : "N/I";
            document.getElementById('lblIdTurnoAtivo').innerText = `🚖 Carro: ${prefixoAtivo} | Turno: #{idTurnoAtivo.substring(1, 8).toUpperCase()}`;
            inicializarMotorista();
        } else {
            document.getElementById('conteudoApp').style.display = 'none';
            document.getElementById('telaAberturaTurno').style.display = 'block';
            injetarCampoPrefixoCarroSeNecessario();
        }
    });
}

function abrirTurnoOperacional() {
    const btn = document.getElementById('btnAbrirTurno');
    if (btn && btn.disabled) return;
    if (btn) { btn.disabled = true; btn.innerHTML = "⏳ Iniciando..."; }

    const troco = parseFloat(document.getElementById('inputTrocoInicial').value) || 0;
    const km = parseInt(document.getElementById('inputKmInicial').value) || 0;
    
    let elPrefix = document.getElementById('inputPrefixoCarro');
    let prefixo = elPrefix ? elPrefix.value.trim().toUpperCase() : "";

    if(!prefixo) { 
        alert("⚠️ Por favor, informe o Prefixo ou Placa do Carro que está assumindo."); 
        if (btn) { btn.disabled = false; btn.innerHTML = "Iniciar Trabalho"; }
        return; 
    }
    if(km <= 0) { 
        alert("⚠️ Por favor, digite a quilometragem atual do Hodômetro."); 
        if (btn) { btn.disabled = false; btn.innerHTML = "Iniciar Trabalho"; }
        return; 
    }

    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    
    if (localStorage.getItem('driverflux_modo_demo') === 'true') {
        localStorage.setItem('driverflux_demo_troco', troco);
        localStorage.setItem('driverflux_demo_km', km);
        localStorage.setItem('driverflux_demo_prefixo', prefixo);
        localStorage.setItem('driverflux_demo_status', 'aberto');
        metadadosTurno = { id: "DEMO-LOCAL", motorista: "teste_demo", status: "aberto", abertura: dataStr, trocoInicial: troco, kmInicial: km, tipoContrato: "demo", prefixoCarro: prefixo };
        verificarStatusTurnoMotorista();
        return;
    }

    iniciarFirebaseSeNecessario();
    db.ref(`usuarios/${usuarioLogado}`).once('value').then((snapshot) => {
        const dadosUser = snapshot.val();
        const tipoContrato = (dadosUser && dadosUser.tipo) ? dadosUser.tipo : "efetivo";
        const novoTurnoRef = db.ref(`turnos_operacionais/${usuarioLogado}`).push();
        idTurnoAtivo = novoTurnoRef.key;
        metadadosTurno = { id: idTurnoAtivo, motorista: usuarioLogado, status: "aberto", abertura: dataStr, trocoInicial: troco, kmInicial: km, tipoContrato: tipoContrato, prefixoCarro: prefixo };
        novoTurnoRef.set(metadadosTurno).then(() => verificarStatusTurnoMotorista());
    });
}

async function salvarDados() {
    const btn = document.getElementById('btnConfirmarSalvar');
    if (btn && btn.disabled) return;
    if (btn) { btn.disabled = true; btn.innerHTML = "⏳ Salvando..."; }

    // Validar se há turno ativo
    if (!idTurnoAtivo || idTurnoAtivo === "") {
        alert("⚠️ Nenhum turno aberto! Por favor, abra um turno antes de lançar corridas.");
        if (btn) { btn.disabled = false; btn.innerHTML = "Confirmar"; }
        return;
    }

    const editId = document.getElementById('editId').value;
    const tipo = document.getElementById('inputTipoLancamento').value;
    const vCorrida = parseFloat(document.getElementById('inputCorrida').value) || 0;
    let nomeCliente = "Passageiro Avulso"; 
    let vEmprestimo = 0;
    let whatsCliente = document.getElementById('inputWhatsCliente') ? document.getElementById('inputWhatsCliente').value.trim() : "";

    if (vCorrida <= 0) {
        alert("⚠️ Digite o valor da corrida.");
        if (btn) { btn.disabled = false; btn.innerHTML = "Confirmar"; }
        return;
    }
    if (tipo === 'credito') {
        nomeCliente = document.getElementById('inputCliente').value.trim();
        vEmprestimo = parseFloat(document.getElementById('inputEmprestimo').value) || 0;
        if (!nomeCliente) {
            alert("⚠️ Digite o nome do cliente.");
            if (btn) { btn.disabled = false; btn.innerHTML = "Confirmar"; }
            return;
        }
    }

    const gpsFinal = await capturarGpsPromessa();
    const agora = new Date();
    const dataHoraStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    let dadosCorrida = {
        id: registros.length > 0 ? Math.max(...registros.map(r => r.id)) + 1 : 1,
        tipo: tipo, cliente: nomeCliente, emprestado: vEmprestimo, corrida: vCorrida, dataHora: dataHoraStr, gps: gpsFinal, whatsCliente: whatsCliente
    };

    if (localStorage.getItem('driverflux_modo_demo') === 'true') {
        if (editId) {
            const index = registros.findIndex(r => r.id == editId);
            if (index !== -1) { dadosCorrida.id = parseInt(editId); registros[index] = dadosCorrida; }
        } else { registros.push(dadosCorrida); }
        localStorage.setItem('driverflux_demo_reg', JSON.stringify(registros));
        finalizarSalvamento(dadosCorrida, whatsCliente);
    } else {
        iniciarFirebaseSeNecessario();
        if (editId) {
            const regOriginal = registros.find(r => r.id == editId);
            if (regOriginal && regOriginal.fbKey) {
                dadosCorrida.id = parseInt(editId);
                db.ref(`corridas_por_turno/${idTurnoAtivo}/${regOriginal.fbKey}`).update(dadosCorrida).then(() => {
                    finalizarSalvamento(dadosCorrida, whatsCliente);
                }).catch(err => {
                    alert("Erro ao atualizar: " + err.message);
                    if (btn) { btn.disabled = false; btn.innerHTML = "Confirmar"; }
                });
            }
        } else {
            db.ref(`corridas_por_turno/${idTurnoAtivo}`).push(dadosCorrida).then(() => {
                finalizarSalvamento(dadosCorrida, whatsCliente);
            }).catch(err => {
                alert("Erro ao salvar: " + err.message);
                if (btn) { btn.disabled = false; btn.innerHTML = "Confirmar"; }
            });
        }
    }
}

function finalizarSalvamento(dados, whats) {
    const btn = document.getElementById('btnConfirmarSalvar');
    if (btn) { btn.disabled = false; btn.innerHTML = "Confirmar"; }
    
    fecharModal();
    
    setTimeout(() => {
        renderizarTabela();
        atualizarListaSugestoes();
        alert("Corrida salva com sucesso!");
    }, 500);
    
    if (localStorage.getItem('driverflux_modo_demo') === 'true') { renderToggleAcoesDemo(); }
    if (dados.tipo === 'credito') { prepararDisparoReciboNativo(dados, whats); }
}

function prepararDisparoReciboNativo(reg, whatsappSugerido) {
    let txtMensagem = "";
    let localizacaoGps = reg.gps || "Não capturado";
    let pfxRecibo = metadadosTurno.prefixoCarro ? metadadosTurno.prefixoCarro.toUpperCase() : "N/I";

    if (reg.tipo === 'credito') {
        const totalDevido = reg.corrida + (reg.emprestado * 1.20);
        txtMensagem = `🧾 *COMPROVANTE DE CORRIDA - DRIVERFLUX*\n-----------------------------------------\n🚗 *PREFIXO VEÍCULO:* ${pfxRecibo}\n📅 *Data:* ${reg.dataHora}\n👤 *Cliente:* ${reg.cliente}\n💰 *Corrida:* R$ ${reg.corrida.toFixed(2)}\n🏦 *Empréstimo:* R$ ${reg.emprestado.toFixed(2)}\n📊 *Total com Juros (20%):* R$ ${totalDevido.toFixed(2)}\n📍 *Localização:* ${localizacaoGps}\n-----------------------------------------`;
    } else {
        let descCliente = reg.cliente && reg.cliente !== "Passageiro Avulso" ? reg.cliente.toUpperCase() : "PASSAGEIRO CORPORATIVO";
        txtMensagem = `🧾 *NOTA FISCAL / RECIBO DE TÁXI - DRIVERFLUX*\n=========================================\n🏢 *PRESTADOR:* Serviço de Táxi DriverFlux\n🚖 *VEÍCULO OFICIAL:* Prefixo ${pfxRecibo}\n👤 *CLIENTE:* ${descCliente}\n💰 *VALOR DA CORRIDA:* R$ ${reg.corrida.toFixed(2)}\n📅 *DATA/HORA:* ${reg.dataHora}\n📍 *LOCALIZAÇÃO GPS:* ${localizacaoGps}\n=========================================\nObrigado pela preferência!`;
    }

    if (!whatsappSugerido && reg.tipo === 'credito') return;

    let confirmarEnvio = confirm(`📄 REVISÃO DO RECIBO:\n\n${txtMensagem.replace(/\*/g, '')}\n\nDeseja disparar este comprovante via WhatsApp?`);
    if (confirmarEnvio) {
        let destino = whatsappSugerido;
        if (!destino || destino === "51") {
            destino = prompt("📱 Digite o WhatsApp de destino (Com DDD, apenas números):", "51");
        }
        
        if (!destino || destino === "51" || destino.length < 10) return alert("⚠️ Operação cancelada ou número inválido.");
        
        let urlWhats = `whatsapp://send?phone=55${destino}&text=${encodeURIComponent(txtMensagem)}`;
        window.location.href = urlWhats;
    }
}

function emititNotaFiscalWhatsApp(idCorrida) {
    const reg = registros.find(r => r.id === idCorrida);
    if (!reg) return alert("Corrida não encontrada.");
    prepararDisparoReciboNativo(reg, "51");
}

function revierComprovanteWhats(idCorrida) {
    const reg = registros.find(r => r.id === idCorrida);
    if (!reg) return alert("Corrida não encontrada.");
    prepararDisparoReciboNativo(reg, reg.whatsCliente || "51");
}

function renderizarTabela() {
    const tbody = document.querySelector('#tabelaDados tbody'); 
    if (!tbody) return;
    tbody.innerHTML = '';
    registros.forEach(reg => {
        const tr = document.createElement('tr');
        const descTipo = reg.tipo === 'credito' ? '🟡 Crédito' : '🟢 Normal';
        const descCliente = reg.tipo === 'credito' ? (reg.cliente || 'N/I') : 'Passageiro Balcão';
        const valorExibido = reg.tipo === 'credito' ? (reg.corrida + reg.emprestado) : reg.corrida;
        
        let acoesHtml = `<button class="btn-nota" style="background:#10b981; color:white; padding:4px 6px; font-size:11px; margin-right:5px; border:none; border-radius:4px; font-weight:bold;" onclick="emititNotaFiscalWhatsApp(${reg.id})">📋 Recibo</button>`;
        acoesHtml += `<button class="btn-whats" style="background:#25d366; color:white; padding:4px 6px; font-size:11px; margin-right:5px; border:none; border-radius:4px; font-weight:bold;" onclick="revierComprovanteWhats(${reg.id})">💬 WhatsApp</button>`;
        
        if (localStorage.getItem('driverflux_modo_demo') !== 'true') {
            acoesHtml += `<button class="btn-cancel" style="padding:4px 6px; font-size:11px;" onclick="abrirModalEdicao(${reg.id})">Editar</button>`;
        } else { acoesHtml += `🔒 Local`; }

        tr.innerHTML = `<td>#${reg.id}</td><td>${descTipo}</td><td>${descCliente}</td><td style="font-weight:bold;">${formatarMoeda(valorExibido)}</td><td>${acoesHtml}</td>`;
        tbody.appendChild(tr);
    });
}

function realizarLogin() {
    const btn = document.getElementById('btnLogin');
    if (btn && btn.disabled) return;
    if (btn) { btn.disabled = true; btn.innerHTML = "⏳ Entrando..."; }

    const user = document.getElementById('loginUsuario').value.trim().toLowerCase();
    const pass = document.getElementById('loginSenha').value.trim();
    if (!user || !pass) {
        alert("⚠️ Digite o usuário e a senha.");
        if (btn) { btn.disabled = false; btn.innerHTML = "🔑 Entrar no Sistema"; }
        return;
    }
    iniciarFirebaseSeNecessario();
    db.ref(`usuarios/${user}`).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const dadosUser = snapshot.val();
            const senhaCorreta = (typeof dadosUser === 'object') ? dadosUser.senha : dadosUser;
            if (senhaCorreta === pass) { 
                localStorage.setItem('driverflux_usuario_logado', user); 
                verificarSessaoLogin(); 
            } else { alert("❌ Senha incorreta!"); if (btn) { btn.disabled = false; btn.innerHTML = "🔑 Entrar no Sistema"; } }
        } else { alert("❌ Usuário não cadastrado!"); if (btn) { btn.disabled = false; btn.innerHTML = "🔑 Entrar no Sistema"; } }
    }).catch(err => {
        alert("Erro ao realizar login: " + err.message);
        if (btn) { btn.disabled = false; btn.innerHTML = "🔑 Entrar no Sistema"; }
    });
}

function efetuarLogout() {
    if (localStorage.getItem('driverflux_modo_demo') === 'true') {
        if (confirm("🚪 Sair do modo demonstração?")) {
            localStorage.removeItem('driverflux_modo_demo');
            localStorage.removeItem('driverflux_licenca_ativa');
            location.reload();
        }
        return;
    }
    if (confirm("🚪 Deseja realmente sair do perfil?")) { efetuarLogoutPronto(); }
}

function efetuarLogoutPronto() {
    localStorage.removeItem('driverflux_usuario_logado'); 
    localStorage.removeItem('driverflux_licenca_ativa'); 
    usuarioLogado = ""; idTurnoAtivo = "";
    if(document.getElementById('cardTotais')) document.getElementById('cardTotais').style.display = 'none'; 
    if(document.getElementById('cardRelatorio')) document.getElementById('cardRelatorio').style.display = 'none';
    verificarSessaoLogin();
}

function calcularTotais() {
    const cardRelatorio = document.getElementById('cardRelatorio');
    if (cardRelatorio) cardRelatorio.style.display = 'none';

    let tNormais = 0, tCreditoCorridas = 0, tBrutoEmprestado = 0;
    registros.forEach(r => { 
        if (r.tipo === 'credito') { tCreditoCorridas += r.corrida; tBrutoEmprestado += r.emprestado; } else { tNormais += r.corrida; } 
    });
    let juros = tBrutoEmprestado * 0.20;
    let fundoFixo = (localStorage.getItem('driverflux_modo_demo') === 'true') ? (parseFloat(localStorage.getItem('driverflux_demo_troco')) || 0) : (metadadosTurno.trocoInicial || 0);
    
    document.getElementById('totTrocoInicial').innerText = formatarMoeda(fundoFixo);
    document.getElementById('totNormais').innerText = formatarMoeda(tNormais);
    document.getElementById('totCorridasCredito').innerText = formatarMoeda(tCreditoCorridas);
    document.getElementById('totBruto').innerText = formatarMoeda(tBrutoEmprestado);
    document.getElementById('totAcrescimo').innerText = `+ ${formatarMoeda(juros)}`;
    document.getElementById('totGeral').innerText = formatarMoeda(fundoFixo + tNormais);
    document.getElementById('cardTotais').style.display = 'block';
}

function formatarMoeda(valor) { return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function inicializarMotorista() {
    if (localStorage.getItem('driverflux_modo_demo') === 'true') {
        const salvo = localStorage.getItem('driverflux_demo_reg');
        registros = salvo ? JSON.parse(salvo) : [];
        renderizarTabela();
        renderToggleAcoesDemo(); 
        return;
    }
    iniciarFirebaseSeNecessario();
    db.ref(`corridas_por_turno/${idTurnoAtivo}`).on('value', (snapshot) => {
        registros = [];
        snapshot.forEach(child => {
            let item = child.val();
            item.fbKey = child.key;
            registros.push(item);
        });
        renderizarTabela();
    });
}

function inicializarMaster() {
    iniciarFirebaseSeNecessario();
    db.ref('turnos_operacionais').on('value', (snapshot) => {
        const select = document.getElementById('selectFiltroTurnoMaster');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione um turno...</option>';
        turnosHistoricoMaster = snapshot.val() || {};
        
        Object.keys(turnosHistoricoMaster).forEach(user => {
            Object.keys(turnosHistoricoMaster[user]).forEach(tId => {
                const t = turnosHistoricoMaster[user][tId];
                const opt = document.createElement('option');
                opt.value = `${user}|${tId}`;
                opt.innerText = `${user.toUpperCase()} - ${t.prefixoCarro} ({t.abertura})`;
                select.appendChild(opt);
            });
        });
    });
}

function selecionarTurnoParaVerificacaoMaster() {
    const val = document.getElementById('selectFiltroTurnoMaster').value;
    if (!val) return;
    const [user, tId] = val.split('|');
    idTurnoAtivo = tId;
    metadadosTurno = turnosHistoricoMaster[user][tId];
    inicializarMotorista();
}

function cadastrarNovoMotoristaMaster() {
    const modal = document.getElementById('modalCadastroMotorista');
    if (!modal) return alert('Modal de cadastro não encontrado.');

    const campoUser = document.getElementById('novoMotoristaUsuario');
    const campoSenha = document.getElementById('novoMotoristaSenha');
    const campoTipo = document.getElementById('novoMotoristaTipo');
    const campoPrefixo = document.getElementById('novoMotoristaPrefixo');

    if (campoUser) campoUser.value = '';
    if (campoSenha) campoSenha.value = '';
    if (campoTipo) campoTipo.value = 'efetivo';
    if (campoPrefixo) campoPrefixo.value = '';

    modal.style.display = 'flex';
    setTimeout(() => { if (campoUser) campoUser.focus(); }, 80);
}

function fecharModalCadastroMotorista() {
    const modal = document.getElementById('modalCadastroMotorista');
    if (modal) modal.style.display = 'none';
}

function salvarNovoMotoristaMaster() {
    const userRaw = (document.getElementById('novoMotoristaUsuario')?.value || '').trim();
    const pass = (document.getElementById('novoMotoristaSenha')?.value || '').trim();
    const tipo = (document.getElementById('novoMotoristaTipo')?.value || 'efetivo').trim().toLowerCase();
    const prefixo = (document.getElementById('novoMotoristaPrefixo')?.value || '').trim();

    if (!userRaw) return alert('⚠️ Informe o nome de usuário do motorista.');
    if (!pass) return alert('⚠️ Informe uma senha para o motorista.');

    const user = userRaw.toLowerCase().replace(/\s+/g, '_');
    const payload = { senha: pass, tipo: tipo };
    if (prefixo) payload.prefixoCarro = prefixo.toUpperCase();

    iniciarFirebaseSeNecessario();
    db.ref(`usuarios/${user}`).once('value').then(snapshot => {
        if (snapshot.exists()) {
            if (!confirm(`⚠️ O usuário "${user}" já existe. Deseja atualizar esse cadastro?`)) return null;
        }
        return db.ref(`usuarios/${user}`).set(payload);
    }).then(resultado => {
        if (resultado === null) return;
        fecharModalCadastroMotorista();
        alert(`✅ Motorista ${user.toUpperCase()} cadastrado com sucesso!`);
    }).catch(err => {
        alert('Erro ao cadastrar motorista: ' + err.message);
    });
}

function garantirUsuariosBaseNoFirebase() {
    db.ref('usuarios/master').once('value').then(snap => {
        if (!snap.exists()) { db.ref('usuarios/master').set({ senha: '123', tipo: 'master' }); }
    });
}

function alternarBarraConsulta() {
    const container = document.getElementById('containerPesquisa');
    if (!container) return;

    const estaOculto = window.getComputedStyle(container).display === 'none';
    container.style.display = estaOculto ? 'block' : 'none';

    if (estaOculto) {
        const input = document.getElementById('inputPesquisa');
        if (input) {
            setTimeout(() => {
                input.focus();
                mostrarSugestoesPagamento();
            }, 80);
        }
    } else {
        esconderSugestoesPagamento();
    }
}

function obterClientesCreditoUnicos() {
    return [...new Set(
        registros
            .filter(r => r.tipo === 'credito' && r.cliente && r.cliente.trim())
            .map(r => r.cliente.trim())
    )].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function atualizarListaSugestoes() {
    const datalist = document.getElementById('listaClientes');
    if (!datalist) return;
    const clientesUnicos = obterClientesCreditoUnicos();
    datalist.innerHTML = '';
    clientesUnicos.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        datalist.appendChild(opt);
    });
}

function mostrarSugestoesPagamento() {
    renderizarSugestoesPagamento();
}

function esconderSugestoesPagamento() {
    const box = document.getElementById('listaClientesPagamento');
    if (box) box.style.display = 'none';
}


function escaparHtmlPagamento(valor) {
    return (valor || '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderizarSugestoesPagamento() {
    const input = document.getElementById('inputPesquisa');
    const box = document.getElementById('listaClientesPagamento');
    if (!input || !box) return;

    const termo = normalizarTextoConsulta(input.value);
    const clientes = obterClientesCreditoUnicos();
    const filtrados = clientes
        .filter(nome => !termo || normalizarTextoConsulta(nome).includes(termo))
        .slice(0, 30);

    if (!filtrados.length) {
        box.innerHTML = '<div class="suggestion-empty">Nenhum cliente encontrado no crédito.</div>';
        box.style.display = 'block';
        return;
    }

    box.innerHTML = filtrados.map(nome => {
        const corridasCliente = registros.filter(r => r.tipo === 'credito' && r.cliente && r.cliente.toLowerCase() === nome.toLowerCase()).length;
        return `<button type="button" class="suggestion-item" onclick="selecionarClientePagamento(decodeURIComponent('${encodeURIComponent(nome)}'))">👤 ${escaparHtmlPagamento(nome)}<small>${corridasCliente} corrida(s)</small></button>`;
    }).join('');
    box.style.display = 'block';
}

function selecionarClientePagamento(nome) {
    const input = document.getElementById('inputPesquisa');
    if (input) {
        input.value = nome;
        input.blur();
    }
    processarConsultaCliente(true);
    esconderSugestoesPagamento();
}

function gerarRelatorio() {
    let tNormais = 0, tCredito = 0, tEmprestado = 0;
    registros.forEach(r => { 
        if (r.tipo === 'credito') { tCredito += r.corrida; tEmprestado += r.emprestado; } else { tNormais += r.corrida; } 
    });
    
    let fundo = (localStorage.getItem('driverflux_modo_demo') === 'true') ? (parseFloat(localStorage.getItem('driverflux_demo_troco')) || 0) : (metadadosTurno.trocoInicial || 0);
    let totalCarro = fundo + tNormais;
    let pfxAtivo = metadadosTurno.prefixoCarro ? metadadosTurno.prefixoCarro.toUpperCase() : "N/I";

    let txt = `🧾 DRIVERFLUX - RELATÓRIO DE CAIXA\n=========================================\n`;
    txt += `🚖 VEÍCULO / PREFIXO AUDITADO: ${pfxAtivo}\n👤 MOTORISTA / OPERADOR: ${usuarioLogado.toUpperCase()}\n=========================================\n\n`;
    txt += `(+) Troco Inicial: ${formatarMoeda(fundo)}\n(+) Corridas Dinheiro: ${formatarMoeda(tNormais)}\n(+) Corridas Fiado/Crédito: ${formatarMoeda(tCredito)}\n(+) Auxílio Emprestado: ${formatarMoeda(tEmprestado)}\n`;
    txt += `(=) TOTAL CAIXA CARRO: ${formatarMoeda(totalCarro)}\n\n=========================================\n`;

    let imprimir = confirm(`📄 FECHAMENTO DE TURNO:\n\n${txt}\n\nDeseja abrir a janela de impressão do sistema?`);
    if (imprimir) {
        const output = document.getElementById('reportOutput');
        const card = document.getElementById('cardRelatorio');
        if(output && card) { output.innerText = txt; card.style.display = 'block'; }
        window.print();
    }
}

function encerrarTurnoDefinitivo() {
    const btn = document.getElementById('btnFecharTurnoOficial');
    if (btn && btn.disabled) return;
    
    if (!confirm("Deseja realmente encerrar este turno?")) return;
    
    if (btn) { btn.disabled = true; btn.innerHTML = "⏳ Encerrando..."; }

    if (localStorage.getItem('driverflux_modo_demo') === 'true') {
        localStorage.setItem('driverflux_demo_status', 'fechado');
        location.reload(); return;
    }
    iniciarFirebaseSeNecessario();
    db.ref(`turnos_operacionais/${usuarioLogado}/${idTurnoAtivo}`).update({
        status: 'fechado', fechamento: new Date().toLocaleString('pt-BR')
    }).then(() => { alert("Turno encerrado com sucesso!"); location.reload(); }).catch(err => {
        alert("Erro ao encerrar turno: " + err.message);
        if (btn) { btn.disabled = false; btn.innerHTML = "🔴 Encerrar Turno e Fechar Caixa"; }
    });
}

function processarConsultaCliente() {
    const nome = document.getElementById('inputPesquisa').value.trim();
    const ficha = document.getElementById('fichaCliente');
    if (!nome || !ficha) { if(ficha) ficha.style.display = 'none'; return; }
    
    const corridas = registros.filter(r => r.tipo === 'credito' && r.cliente.toLowerCase() === nome.toLowerCase());
    const totalDevido = corridas.reduce((acc, curr) => acc + curr.corrida + (curr.emprestado * 1.20), 0);
    
    document.getElementById('ledgerNomeCliente').innerText = `Extrato: ${nome.toUpperCase()}`;
    document.getElementById('ledgerTotalDevido').innerText = formatarMoeda(totalDevido);
    document.getElementById('ledgerSaldoFinal').innerText = formatarMoeda(totalDevido);
    ficha.style.display = 'block';
}

function limparConsulta() { document.getElementById('inputPesquisa').value = ''; esconderSugestoesPagamento(); const ficha = document.getElementById('fichaCliente'); if (ficha) ficha.style.display = 'none'; }
function registrarPagamento() { alert("Funcionalidade de amortização em desenvolvimento."); }

// ==================== AMORTIZAÇÃO COMPLETA + CONSULTA MASTER + CANCELAR FECHAMENTO ====================

function carregarPagamentos() {
    if (localStorage.getItem('driverflux_modo_demo') === 'true') {
        const salvo = localStorage.getItem('driverflux_demo_pagamentos');
        pagamentos = salvo ? JSON.parse(salvo) : [];
    }
}

function salvarPagamento(pagamento) {
    if (localStorage.getItem('driverflux_modo_demo') === 'true') {
        pagamentos.push(pagamento);
        localStorage.setItem('driverflux_demo_pagamentos', JSON.stringify(pagamentos));
    } else if (db && idTurnoAtivo) {
        db.ref(`pagamentos/${idTurnoAtivo}`).push(pagamento);
    }
}

function calcularTotalPagoPorCliente(nomeCliente) {
    let total = 0;
    pagamentos.forEach(p => {
        if (p.cliente && p.cliente.toLowerCase() === nomeCliente.toLowerCase()) {
            total += parseFloat(p.valor) || 0;
        }
    });
    return total;
}

function registrarPagamento() {
    const nomeCliente = document.getElementById('ledgerNomeCliente').innerText.replace('Extrato: ', '').trim();
    const inputValor = document.getElementById('inputValorPagamento');
    const valorPago = parseFloat(inputValor.value);

    if (!nomeCliente || !valorPago || valorPago <= 0) {
        alert("⚠️ Digite um valor válido para amortizar.");
        return;
    }

    const agora = new Date();
    const dataHora = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const pagamento = {
        id: Date.now(),
        cliente: nomeCliente,
        valor: valorPago,
        dataHora: dataHora,
        turno: idTurnoAtivo || "DEMO"
    };

    salvarPagamento(pagamento);

    alert(`✅ Pagamento de ${formatarMoeda(valorPago)} registrado para ${nomeCliente}!`);

    inputValor.value = '';
    processarConsultaCliente();

    if (localStorage.getItem('driverflux_modo_demo') === 'true') {
        renderToggleAcoesDemo();
    }
}

function processarConsultaCliente(forcarExibicao = false) {
    const input = document.getElementById('inputPesquisa');
    const nomeDigitado = input ? input.value.trim() : '';
    const ficha = document.getElementById('fichaCliente');

    if (forcarExibicao) {
        esconderSugestoesPagamento();
    } else {
        renderizarSugestoesPagamento();
    }

    if (!nomeDigitado || !ficha) {
        if (ficha) ficha.style.display = 'none';
        return;
    }

    const clienteExato = obterClientesCreditoUnicos().find(c => c.toLowerCase() === nomeDigitado.toLowerCase());
    if (!clienteExato && !forcarExibicao) {
        ficha.style.display = 'none';
        return;
    }

    const nome = clienteExato || nomeDigitado;
    const corridas = registros.filter(r => 
        r.tipo === 'credito' && 
        r.cliente && 
        r.cliente.toLowerCase() === nome.toLowerCase()
    );

    let totalDevido = 0;
    corridas.forEach(r => {
        totalDevido += (r.corrida || 0) + ((r.emprestado || 0) * 1.20);
    });

    const totalPago = calcularTotalPagoPorCliente(nome);
    const saldoPendente = totalDevido - totalPago;

    document.getElementById('ledgerNomeCliente').innerText = `Extrato: ${nome.toUpperCase()}`;
    document.getElementById('ledgerTotalDevido').innerText = formatarMoeda(totalDevido);
    document.getElementById('ledgerTotalPago').innerText = formatarMoeda(totalPago);
    document.getElementById('ledgerSaldoFinal').innerText = formatarMoeda(saldoPendente);

    ficha.style.display = 'block';
}

function cancelarFechamento() {
    if (confirm("Deseja realmente voltar sem encerrar o turno?")) {
        const cardTotais = document.getElementById('cardTotais');
        const cardRelatorio = document.getElementById('cardRelatorio');
        const reportOutput = document.getElementById('reportOutput');

        if (cardTotais) cardTotais.style.display = 'none';
        if (cardRelatorio) cardRelatorio.style.display = 'none';
        if (reportOutput) reportOutput.innerText = '';
    }
}

function normalizarTextoConsulta(valor) {
    return (valor || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function garantirBoxResultadoConsultaMaster() {
    let box = document.getElementById('resultadoConsultaMaster');
    if (box) return box;

    const painel = document.getElementById('painelFiltroMaster');
    box = document.createElement('div');
    box.id = 'resultadoConsultaMaster';
    box.style.display = 'none';
    box.style.marginTop = '12px';
    box.style.background = '#ffffff';
    box.style.border = '1px solid #c7d2fe';
    box.style.borderRadius = '14px';
    box.style.padding = '14px';
    box.style.boxShadow = '0 8px 18px rgba(79,70,229,0.08)';

    if (painel) painel.appendChild(box);
    return box;
}

function montarLinhaResultadoConsulta(item) {
    const tipo = item.tipo === 'credito' ? 'Crédito' : 'Normal';
    const cliente = item.cliente || 'Passageiro balcão';
    const valorCorrida = parseFloat(item.corrida) || 0;
    const emprestado = parseFloat(item.emprestado) || 0;
    const total = valorCorrida + emprestado + (emprestado * 0.20);

    return `
        <div style="border:1px solid #e2e8f0; border-radius:12px; padding:10px; margin-top:8px; background:#f8fafc;">
            <div style="display:flex; justify-content:space-between; gap:10px; font-weight:800; color:#1e293b;">
                <span>#${item.id || '-' } • ${tipo}</span>
                <span>${formatarMoeda(total)}</span>
            </div>
            <div style="font-size:12px; color:#475569; margin-top:5px; line-height:1.45;">
                👤 Cliente: <b>${cliente}</b><br>
                🚕 Motorista: <b>${(item.motorista || usuarioLogado || 'N/I').toString().toUpperCase()}</b><br>
                🚖 Prefixo: <b>${(item.prefixo || metadadosTurno.prefixoCarro || 'N/I').toString().toUpperCase()}</b><br>
                📅 Data: ${item.dataHora || item.abertura || 'N/I'}<br>
                💰 Corrida: ${formatarMoeda(valorCorrida)} ${emprestado > 0 ? ` • Empréstimo: ${formatarMoeda(emprestado)} + 20%` : ''}
            </div>
        </div>`;
}

async function carregarBaseConsultaMaster() {
    const base = [];

    if (localStorage.getItem('driverflux_modo_demo') === 'true' || !db) {
        registros.forEach(r => base.push({
            ...r,
            motorista: usuarioLogado || 'demo_local',
            prefixo: metadadosTurno.prefixoCarro || localStorage.getItem('driverflux_demo_prefixo') || 'DEMO'
        }));
        return base;
    }

    iniciarFirebaseSeNecessario();

    const [snapTurnos, snapCorridas] = await Promise.all([
        db.ref('turnos_operacionais').once('value'),
        db.ref('corridas_por_turno').once('value')
    ]);

    const mapaTurnos = {};
    const turnos = snapTurnos.val() || {};
    Object.keys(turnos).forEach(motorista => {
        Object.keys(turnos[motorista] || {}).forEach(tId => {
            mapaTurnos[tId] = {
                motorista,
                prefixo: (turnos[motorista][tId] || {}).prefixoCarro || 'N/I',
                abertura: (turnos[motorista][tId] || {}).abertura || ''
            };
        });
    });

    const corridasPorTurno = snapCorridas.val() || {};
    Object.keys(corridasPorTurno).forEach(tId => {
        const meta = mapaTurnos[tId] || {};
        Object.keys(corridasPorTurno[tId] || {}).forEach(key => {
            const r = corridasPorTurno[tId][key] || {};
            base.push({
                ...r,
                fbKey: key,
                turno: tId,
                motorista: meta.motorista || 'N/I',
                prefixo: meta.prefixo || 'N/I',
                abertura: meta.abertura || ''
            });
        });
    });

    return base;
}


let consultaMasterCache = [];
let consultaMasterTipoAtual = 'cliente';

function garantirModalConsultaMaster() {
    let modal = document.getElementById('modalConsultaMaster');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'modalConsultaMaster';
    modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,0.72); padding:18px; align-items:center; justify-content:center;';
    modal.innerHTML = `
        <div style="width:100%; max-width:520px; max-height:92vh; overflow:hidden; background:white; border-radius:18px; box-shadow:0 18px 50px rgba(0,0,0,0.35); display:flex; flex-direction:column;">
            <div style="padding:16px; background:#4f46e5; color:white; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div>
                    <div style="font-size:18px; font-weight:900;">🔎 Consulta Avançada</div>
                    <div style="font-size:12px; opacity:.9;">Toque no tipo e escolha na lista rolável</div>
                </div>
                <button onclick="fecharModalConsultaMaster()" style="background:rgba(255,255,255,.18); color:white; border:1px solid rgba(255,255,255,.35); border-radius:10px; padding:8px 10px; font-weight:800;">✕</button>
            </div>

            <div style="padding:14px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
                <button id="btnTipoClienteMaster" onclick="selecionarTipoConsultaMaster('cliente')" style="padding:12px 6px; border-radius:12px; font-weight:900; border:none;">👤 Cliente</button>
                <button id="btnTipoMotoristaMaster" onclick="selecionarTipoConsultaMaster('motorista')" style="padding:12px 6px; border-radius:12px; font-weight:900; border:none;">🚕 Motorista</button>
                <button id="btnTipoPrefixoMaster" onclick="selecionarTipoConsultaMaster('prefixo')" style="padding:12px 6px; border-radius:12px; font-weight:900; border:none;">🚖 Prefixo</button>
            </div>

            <div style="padding:0 14px 14px 14px;">
                <input id="inputConsultaMasterModal" type="text" placeholder="Digite para filtrar..." autocomplete="off"
                       oninput="renderizarSugestoesConsultaMaster()"
                       style="width:100%; box-sizing:border-box; padding:14px; font-size:16px; border:2px solid #c7d2fe; border-radius:14px; outline:none;">
            </div>

            <div id="listaConsultaMasterModal" style="margin:0 14px 14px 14px; border:1px solid #e2e8f0; border-radius:14px; max-height:300px; overflow-y:auto; background:#f8fafc;"></div>

            <div style="padding:14px; border-top:1px solid #e2e8f0; display:flex; gap:8px;">
                <button onclick="executarConsultaMasterPeloModal()" style="flex:1; padding:13px; border:none; border-radius:12px; background:#16a34a; color:white; font-weight:900;">Consultar</button>
                <button onclick="fecharModalConsultaMaster()" style="padding:13px; border:none; border-radius:12px; background:#e2e8f0; color:#334155; font-weight:900;">Cancelar</button>
            </div>
        </div>`;

    document.body.appendChild(modal);
    return modal;
}

async function abrirModalConsultaMaster() {
    if (usuarioLogado !== 'master') {
        alert('🔒 Função exclusiva para Master!');
        return;
    }

    const modal = garantirModalConsultaMaster();
    modal.style.display = 'flex';

    const lista = document.getElementById('listaConsultaMasterModal');
    if (lista) lista.innerHTML = '<div style="padding:14px; color:#4f46e5; font-weight:800;">Carregando dados...</div>';

    try {
        consultaMasterCache = await carregarBaseConsultaMaster();
        selecionarTipoConsultaMaster('cliente');
        setTimeout(() => {
            const input = document.getElementById('inputConsultaMasterModal');
            if (input) input.focus();
        }, 80);
    } catch (err) {
        if (lista) lista.innerHTML = `<div style="padding:14px; color:#ef4444; font-weight:800;">Erro ao carregar consulta:<br>${err.message}</div>`;
    }
}

function fecharModalConsultaMaster() {
    const modal = document.getElementById('modalConsultaMaster');
    if (modal) modal.style.display = 'none';
}

function selecionarTipoConsultaMaster(tipo) {
    consultaMasterTipoAtual = tipo;
    const input = document.getElementById('inputConsultaMasterModal');
    if (input) {
        input.value = '';
        input.placeholder = tipo === 'cliente' ? 'Digite o nome do cliente...' : tipo === 'motorista' ? 'Digite o nome do motorista...' : 'Digite o prefixo do carro...';
    }

    const botoes = {
        cliente: document.getElementById('btnTipoClienteMaster'),
        motorista: document.getElementById('btnTipoMotoristaMaster'),
        prefixo: document.getElementById('btnTipoPrefixoMaster')
    };

    Object.keys(botoes).forEach(k => {
        if (!botoes[k]) return;
        botoes[k].style.background = k === tipo ? '#4f46e5' : '#e2e8f0';
        botoes[k].style.color = k === tipo ? '#ffffff' : '#334155';
    });

    renderizarSugestoesConsultaMaster();
}

function obterValorCampoConsultaMaster(item, tipo) {
    if (tipo === 'cliente') return item.cliente || '';
    if (tipo === 'motorista') return item.motorista || '';
    return item.prefixo || '';
}

function renderizarSugestoesConsultaMaster() {
    const lista = document.getElementById('listaConsultaMasterModal');
    const input = document.getElementById('inputConsultaMasterModal');
    if (!lista || !input) return;

    const termo = normalizarTextoConsulta(input.value);
    const mapa = new Map();

    consultaMasterCache.forEach(item => {
        const valor = (obterValorCampoConsultaMaster(item, consultaMasterTipoAtual) || '').toString().trim();
        if (!valor) return;
        const chave = normalizarTextoConsulta(valor);
        if (termo && !chave.includes(termo)) return;
        if (!mapa.has(chave)) mapa.set(chave, { texto: valor, qtd: 0 });
        mapa.get(chave).qtd++;
    });

    const opcoes = Array.from(mapa.values()).sort((a, b) => a.texto.localeCompare(b.texto)).slice(0, 80);

    if (!opcoes.length) {
        lista.innerHTML = '<div style="padding:14px; color:#64748b;">Nenhuma opção encontrada. Você ainda pode digitar e tocar em Consultar.</div>';
        return;
    }

    lista.innerHTML = opcoes.map(op => `
        <button onclick="escolherSugestaoConsultaMaster('${consultaMasterTipoAtual}', '${encodeURIComponent(op.texto)}')"
                style="width:100%; text-align:left; padding:13px 14px; border:0; border-bottom:1px solid #e2e8f0; background:white; display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <span style="font-weight:900; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${op.texto}</span>
            <span style="font-size:12px; color:#4f46e5; background:#eef2ff; padding:4px 7px; border-radius:999px; white-space:nowrap;">${op.qtd} reg.</span>
        </button>`).join('');
}

function escolherSugestaoConsultaMaster(tipo, valorCodificado) {
    consultaMasterTipoAtual = tipo;
    const valor = decodeURIComponent(valorCodificado);
    const input = document.getElementById('inputConsultaMasterModal');
    if (input) input.value = valor;
    executarConsultaMaster(tipo, valor);
}

function executarConsultaMasterPeloModal() {
    const input = document.getElementById('inputConsultaMasterModal');
    const termo = input ? input.value : '';
    executarConsultaMaster(consultaMasterTipoAtual, termo);
}

async function executarConsultaMaster(tipoConsulta, termoDigitado) {
    if (!termoDigitado || !termoDigitado.trim()) return;

    const termo = normalizarTextoConsulta(termoDigitado);
    const box = garantirBoxResultadoConsultaMaster();
    box.style.display = 'block';
    box.innerHTML = '<div style="font-weight:800; color:#4f46e5;">🔎 Consultando...</div>';
    fecharModalConsultaMaster();

    try {
        const base = consultaMasterCache.length ? consultaMasterCache : await carregarBaseConsultaMaster();
        consultaMasterCache = base;
        let resultados = [];
        let titulo = '';

        if (tipoConsulta === 'cliente') {
            titulo = `Cliente: ${termoDigitado}`;
            resultados = base.filter(r => normalizarTextoConsulta(r.cliente).includes(termo));
        } else if (tipoConsulta === 'motorista') {
            titulo = `Motorista: ${termoDigitado}`;
            resultados = base.filter(r => normalizarTextoConsulta(r.motorista).includes(termo));
        } else if (tipoConsulta === 'prefixo') {
            titulo = `Prefixo: ${termoDigitado}`;
            resultados = base.filter(r => normalizarTextoConsulta(r.prefixo).includes(termo));
        } else {
            box.innerHTML = '<b style="color:#ef4444;">Tipo de consulta inválido.</b>';
            return;
        }

        let totalCorridas = 0;
        let totalEmprestado = 0;
        let totalComJuros = 0;
        resultados.forEach(r => {
            const corrida = parseFloat(r.corrida) || 0;
            const emprestado = parseFloat(r.emprestado) || 0;
            totalCorridas += corrida;
            totalEmprestado += emprestado;
            totalComJuros += corrida + emprestado + (emprestado * 0.20);
        });

        if (!resultados.length) {
            box.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px;">
                    <div style="font-weight:800; color:#4f46e5;">🔎 ${titulo}</div>
                    <button onclick="abrirModalConsultaMaster()" style="padding:6px 10px; background:#4f46e5; color:white; border-radius:8px;">Nova consulta</button>
                </div>
                <div style="background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; padding:10px; border-radius:10px;">
                    Nenhum registro encontrado para esta consulta.
                </div>`;
            return;
        }

        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                <div style="font-weight:900; color:#4f46e5;">🔎 ${titulo}</div>
                <div style="display:flex; gap:6px;">
                    <button onclick="abrirModalConsultaMaster()" style="padding:6px 10px; background:#4f46e5; color:white; border-radius:8px;">Nova</button>
                    <button onclick="document.getElementById('resultadoConsultaMaster').style.display='none'" style="padding:6px 10px; background:#e2e8f0; color:#334155; border-radius:8px;">Fechar</button>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                <div style="background:#eef2ff; padding:10px; border-radius:10px;"><b>${resultados.length}</b><br><span style="font-size:12px;">registros</span></div>
                <div style="background:#ecfdf5; padding:10px; border-radius:10px;"><b>${formatarMoeda(totalComJuros)}</b><br><span style="font-size:12px;">total geral</span></div>
                <div style="background:#f8fafc; padding:10px; border-radius:10px;"><b>${formatarMoeda(totalCorridas)}</b><br><span style="font-size:12px;">corridas</span></div>
                <div style="background:#f8fafc; padding:10px; border-radius:10px;"><b>${formatarMoeda(totalEmprestado)}</b><br><span style="font-size:12px;">empréstimos</span></div>
            </div>
            <div style="max-height:360px; overflow:auto; padding-right:2px;">
                ${resultados.map(montarLinhaResultadoConsulta).join('')}
            </div>`;
    } catch (err) {
        box.innerHTML = `<b style="color:#ef4444;">Erro na consulta:</b><br>${err.message}`;
    }
}

async function consultarMasterAvancado() {
    abrirModalConsultaMaster();
}

const _originalInit = inicializarMotorista;
inicializarMotorista = function() {
    _originalInit();
    carregarPagamentos();
};

window.registrarPagamento = registrarPagamento;
window.cancelarFechamento = cancelarFechamento;
window.consultarMasterAvancado = consultarMasterAvancado;
window.abrirModalConsultaMaster = abrirModalConsultaMaster;
window.fecharModalConsultaMaster = fecharModalConsultaMaster;
window.selecionarTipoConsultaMaster = selecionarTipoConsultaMaster;
window.renderizarSugestoesConsultaMaster = renderizarSugestoesConsultaMaster;
window.escolherSugestaoConsultaMaster = escolherSugestaoConsultaMaster;
window.executarConsultaMasterPeloModal = executarConsultaMasterPeloModal;

window.onload = () => { 
    checarLicenciamento(); 
};


// Fecha o modal de motorista ao tocar fora da caixa
document.addEventListener('click', function(e) {
    const modal = document.getElementById('modalCadastroMotorista');
    if (modal && modal.style.display === 'flex' && e.target === modal) {
        fecharModalCadastroMotorista();
    }
});
