/**
 * APP.JS - Lógica Operacional Integrada com GPS e Armazenamento Persistente
 */

let registros = [];
let contadorId = 1;
let coordenadaAtual = null;
let filtroTexto = "";

/**
 * Salva os dados de forma definitiva no armazenamento do aparelho
 */
function salvarNoStorage() {
    localStorage.setItem('driverflux_registros', JSON.stringify(registros));
    localStorage.setItem('driverflux_contadorId', contadorId.toString());
}

/**
 * Recupera os registros ao abrir o aplicativo
 */
function carregarDoStorage() {
    const salvos = localStorage.getItem('driverflux_registros');
    const ultimoId = localStorage.getItem('driverflux_contadorId');
    
    if (salvos) registros = JSON.parse(salvos);
    if (ultimoId) {
        contadorId = parseInt(ultimoId);
    } else if (registros.length > 0) {
        contadorId = Math.max(...registros.map(r => r.id)) + 1;
    }
}

/**
 * Recarrega a lista interna de autocompletar no campo de texto
 */
function atualizarListaSugestoes() {
    const datalist = document.getElementById('listaClientes');
    datalist.innerHTML = '';
    const unicos = [...new Set(registros.map(r => r.cliente ? r.cliente.trim() : '').filter(n => n.length > 0))];
    unicos.sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        datalist.appendChild(opt);
    });
}

function formatarMoeda(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Ação do botão "Incluir"
 */
function abrirModalInsercao() {
    document.getElementById('modalTitle').innerText = "Incluir Registro";
    document.getElementById('editId').value = "";
    document.getElementById('inputCliente').value = "";
    document.getElementById('inputEmprestimo').value = "";
    document.getElementById('inputCorrida').value = "";
    
    atualizarListaSugestoes();
    const gpsDisplay = document.getElementById('gpsStatus');
    gpsDisplay.innerText = "🔍 Localizando satélites...";
    gpsDisplay.style.color = '#ef4444';
    document.getElementById('formModal').style.display = 'flex';

    GeoLocation.capturarCoordenadas(
        function(lat, lng, accuracy) {
            coordenadaAtual = { latitude: lat, longitude: lng, accuracy: accuracy };
            gpsDisplay.innerText = `✅ Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
            gpsDisplay.style.color = '#10b981';
        },
        function(erro) {
            gpsDisplay.innerText = `⚠️ ${erro}`;
            gpsDisplay.style.color = '#f59e0b';
        }
    );
}

/**
 * Ação do botão "Alterar" localizado na linha da tabela
 */
function abrirModalEdicao(id) {
    const reg = registros.find(r => r.id === id);
    if (!reg) return;

    document.getElementById('modalTitle').innerText = `Alterar Registro #${id}`;
    document.getElementById('editId').value = id;
    document.getElementById('inputCliente').value = reg.cliente || "";
    document.getElementById('inputEmprestimo').value = reg.emprestado;
    document.getElementById('inputCorrida').value = reg.corrida;
    
    atualizarListaSugestoes();
    const gpsDisplay = document.getElementById('gpsStatus');
    
    if (reg.gps) {
        coordenadaAtual = reg.gps;
        gpsDisplay.innerText = `📍 Lat: ${reg.gps.latitude.toFixed(5)}, Lng: ${reg.gps.longitude.toFixed(5)}`;
        gpsDisplay.style.color = '#4f46e5';
    } else {
        gpsDisplay.innerText = '⚠️ Sem localização guardada';
        gpsDisplay.style.color = '#718096';
    }

    document.getElementById('formModal').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('formModal').style.display = 'none';
    coordenadaAtual = null;
    GeoLocation.limparCoordenadas();
}

/**
 * Grava ou Atualiza os dados inseridos
 */
function salvarDados() {
    const idEdit = document.getElementById('editId').value;
    const nomeCliente = document.getElementById('inputCliente').value.trim();
    const vEmprestimo = parseFloat(document.getElementById('inputEmprestimo').value) || 0;
    const vCorrida = parseFloat(document.getElementById('inputCorrida').value) || 0;

    if (!nomeCliente) return alert('⚠️ Digite o nome do cliente.');
    if (vEmprestimo <= 0 && vCorrida <= 0) return alert('⚠️ Adicione um valor válido.');

    const agora = new Date();
    const dataHoraStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    if (idEdit) {
        const reg = registros.find(r => r.id === parseInt(idEdit));
        if (reg) {
            reg.cliente = nomeCliente;
            reg.emprestado = vEmprestimo;
            reg.corrida = vCorrida;
            reg.dataHora = dataHoraStr;
            if (coordenadaAtual) reg.gps = coordenadaAtual;
        }
    } else {
        registros.push({
            id: contadorId++,
            cliente: nomeCliente,
            emprestado: vEmprestimo,
            corrida: vCorrida,
            dataHora: dataHoraStr,
            gps: coordenadaAtual
        });
    }

    salvarNoStorage();
    fecharModal();
    renderizarTabela();
    document.getElementById('cardTotais').style.display = 'none';
    document.getElementById('cardRelatorio').style.display = 'none';
}

/**
 * Exibe ou esconde a barra de consulta por nome
 */
function alternarBarraConsulta() {
    const container = document.getElementById('containerPesquisa');
    const input = document.getElementById('inputPesquisa');
    if (container.style.display === 'block') {
        container.style.display = 'none';
        input.value = "";
        filtroTexto = "";
        renderizarTabela();
    } else {
        container.style.display = 'block';
        input.focus();
    }
}

function filtrarTabela() {
    filtroTexto = document.getElementById('inputPesquisa').value.toLowerCase();
    renderizarTabela();
}

/**
 * Monta as linhas da tabela aplicando o filtro caso o botão de consulta esteja ativo
 */
function renderizarTabela() {
    const tbody = document.querySelector('#tabelaDados tbody');
    tbody.innerHTML = '';

    const registrosFiltrados = registros.filter(r => {
        return (r.cliente || '').toLowerCase().includes(filtroTexto);
    });

    registrosFiltrados.forEach(reg => {
        const tr = document.createElement('tr');
        const gpsIcone = reg.gps ? '📍' : '❌';
        tr.innerHTML = `
            <td class="row-id">#${reg.id}</td>
            <td class="row-cliente">${reg.cliente || 'Sem Nome'}</td>
            <td>${formatarMoeda(reg.emprestado)}</td>
            <td>${formatarMoeda(reg.corrida)}</td>
            <td>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <span style="cursor:help;" title="${reg.gps ? `Lat: ${reg.gps.latitude.toFixed(6)}, Lng: ${reg.gps.longitude.toFixed(6)}` : 'Sem GPS'}">${gpsIcone}</span>
                    <button class="btn-alterar" onclick="abrirModalEdicao(${reg.id})">Alterar</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function calcularTotais() {
    let tBruto = 0, tCorridas = 0;
    registros.forEach(r => { tBruto += r.emprestado; tCorridas += r.corrida; });
    let juros = tBruto * 0.20;

    document.getElementById('totBruto').innerText = formatarMoeda(tBruto);
    document.getElementById('totAcrescimo').innerText = `+ ${formatarMoeda(juros)}`;
    document.getElementById('totCorridas').innerText = formatarMoeda(tCorridas);
    document.getElementById('totGeral').innerText = formatarMoeda(tBruto + juros + tCorridas);
    document.getElementById('cardTotais').style.display = 'block';
}

function gerarRelatorio() {
    if (registros.length === 0) return alert("⚠️ Sem dados disponíveis.");

    let tBruto = 0, tCorridas = 0;
    let txt = `🧾 DRIVERFLUX - RELATÓRIO OPERACIONAL COM LOCALIZAÇÃO\n`;
    txt += `Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n`;
    txt += `=========================================\n\n`;

    registros.forEach(r => {
        tBruto += r.emprestado; tCorridas += r.corrida;
        txt += `[${r.dataHora}] Reg #${r.id}\n`;
        txt += `  👤 Cliente:    ${r.cliente || 'Não Informado'}\n`;
        txt += `  -> Empréstimo: ${formatarMoeda(r.emprestado)}\n`;
        txt += `  -> Corrida:    ${formatarMoeda(r.corrida)}\n`;
        txt += r.gps ? `  📍 GPS: Lat ${r.gps.latitude.toFixed(6)}, Lng ${r.gps.longitude.toFixed(6)} (±${Math.round(r.gps.accuracy)}m)\n` : `  ❌ GPS: Sem localização\n`;
        txt += `-----------------------------------------\n`;
    });

    let juros = tBruto * 0.20;
    txt += `\n=========================================\n`;
    txt += `Subtotal Empréstimos:    ${formatarMoeda(tBruto)}\n`;
    txt += `Taxa Adicional (+20%):   ${formatarMoeda(juros)}\n`;
    txt += `Subtotal Corridas:       ${formatarMoeda(tCorridas)}\n`;
    txt += `-----------------------------------------\n`;
    txt += `VALOR TOTAL A RECEBER:   ${formatarMoeda(tBruto + juros + tCorridas)}\n`;
    txt += `=========================================`;

    document.getElementById('reportOutput').innerText = txt;
    document.getElementById('reportOutput').style.display = 'block';
    document.getElementById('cardRelatorio').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', function() {
    if (typeof GeoLocation !== 'undefined') GeoLocation.init();
    carregarDoStorage();
    renderizarTabela();
});
