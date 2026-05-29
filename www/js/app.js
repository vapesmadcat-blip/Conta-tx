/**
 * APP.JS - Lógica Principal do DriverFlux com Integração de GPS
 */

let registros = [];
let contadorId = 1;
let coordenadaAtual = null;

/**
 * Formata valores monetários para BRL
 */
function formatarMoeda(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Abre modal para novo registro e captura GPS automaticamente
 */
function abrirModalInsercao() {
    document.getElementById('modalTitle').innerText = "Novo Lançamento";
    document.getElementById('editId').value = "";
    document.getElementById('inputEmprestimo').value = "";
    document.getElementById('inputCorrida').value = "";
    document.getElementById('gpsStatus').innerText = "🔴 Aguardando captura...";
    document.getElementById('gpsStatus').style.color = '#ef4444';
    document.getElementById('formModal').style.display = 'flex';

    // Captura coordenadas automaticamente ao abrir modal
    GeoLocation.capturarCoordenadas(
        function(lat, lng, accuracy) {
            coordenadaAtual = { latitude: lat, longitude: lng, accuracy: accuracy };
            document.getElementById('gpsStatus').innerText = `✅ ${GeoLocation.formatarCoordenadas()}`;
            document.getElementById('gpsStatus').style.color = '#10b981';
        },
        function(erro) {
            document.getElementById('gpsStatus').innerText = `⚠️ ${erro}`;
            document.getElementById('gpsStatus').style.color = '#f59e0b';
        }
    );
}

/**
 * Abre modal para editar registro existente
 */
function abrirModalEdicao(id) {
    const reg = registros.find(r => r.id === id);
    if (!reg) return;

    document.getElementById('modalTitle').innerText = `Editar Registro #${id}`;
    document.getElementById('editId').value = id;
    document.getElementById('inputEmprestimo').value = reg.emprestado;
    document.getElementById('inputCorrida').value = reg.corrida;
    
    // Mostra GPS do registro atual
    if (reg.gps) {
        document.getElementById('gpsStatus').innerText = `📍 Lat: ${reg.gps.latitude.toFixed(6)}, Lng: ${reg.gps.longitude.toFixed(6)}`;
        document.getElementById('gpsStatus').style.color = '#4f46e5';
    } else {
        document.getElementById('gpsStatus').innerText = 'Sem localização registrada';
        document.getElementById('gpsStatus').style.color = '#718096';
    }

    document.getElementById('formModal').style.display = 'flex';
}

/**
 * Fecha o modal de formulário
 */
function fecharModal() {
    document.getElementById('formModal').style.display = 'none';
    coordenadaAtual = null;
}

/**
 * Salva dados do formulário com coordenadas GPS
 */
function salvarDados() {
    const idEdit = document.getElementById('editId').value;
    const vEmprestimo = parseFloat(document.getElementById('inputEmprestimo').value) || 0;
    const vCorrida = parseFloat(document.getElementById('inputCorrida').value) || 0;

    // Validação básica
    if (vEmprestimo <= 0 || vCorrida <= 0) {
        alert('⚠️ Por favor, insira valores maiores que zero');
        return;
    }

    // Captura data e hora atuais
    const agora = new Date();
    const dataHoraStr = agora.toLocaleDateString('pt-BR') + ' ' + 
                        agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    if (idEdit) {
        // Edita registro existente
        const reg = registros.find(r => r.id === parseInt(idEdit));
        if (reg) {
            reg.emprestado = vEmprestimo;
            reg.corrida = vCorrida;
            reg.dataHora = dataHoraStr;
            // Mantém GPS original se não tiver novo
            if (coordenadaAtual) {
                reg.gps = coordenadaAtual;
            }
        }
    } else {
        // Cria novo registro com coordenadas GPS
        registros.push({
            id: contadorId++,
            emprestado: vEmprestimo,
            corrida: vCorrida,
            dataHora: dataHoraStr,
            gps: coordenadaAtual  // Salva coordenadas do registro
        });
    }

    fecharModal();
    renderizarTabela();
    resetarPaineis();
    alert('✅ Dados salvos com sucesso!');
}

/**
 * Renderiza a tabela com todos os registros
 */
function renderizarTabela() {
    const tbody = document.querySelector('#tabelaDados tbody');
    tbody.innerHTML = '';

    registros.forEach(reg => {
        const tr = document.createElement('tr');
        const gpsIndicador = reg.gps ? '📍' : '❌';
        tr.innerHTML = `
            <td class="row-id">#${reg.id}</td>
            <td>${formatarMoeda(reg.emprestado)}</td>
            <td>${formatarMoeda(reg.corrida)}</td>
            <td>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <span title="${reg.gps ? `Lat: ${reg.gps.latitude.toFixed(6)}, Lng: ${reg.gps.longitude.toFixed(6)}` : 'Sem GPS'}">${gpsIndicador}</span>
                    <button class="btn-warning" onclick="abrirModalEdicao(${reg.id})">Editar</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Reseta painéis de resultado
 */
function resetarPaineis() {
    document.getElementById('cardTotais').style.display = 'none';
    document.getElementById('cardRelatorio').style.display = 'none';
}

/**
 * Calcula e mostra totais
 */
function calcularTotais() {
    let tBruto = 0, tCorridas = 0;
    registros.forEach(r => { 
        tBruto += r.emprestado; 
        tCorridas += r.corrida; 
    });

    let juros = tBruto * 0.20;
    let tGeral = tBruto + juros + tCorridas;

    document.getElementById('totBruto').innerText = formatarMoeda(tBruto);
    document.getElementById('totAcrescimo').innerText = `+ ${formatarMoeda(juros)}`;
    document.getElementById('totCorridas').innerText = formatarMoeda(tCorridas);
    document.getElementById('totGeral').innerText = formatarMoeda(tGeral);

    document.getElementById('cardTotais').style.display = 'block';
}

/**
 * Gera relatório com dados e coordenadas GPS
 */
function gerarRelatorio() {
    if (registros.length === 0) {
        alert("⚠️ Adicione dados primeiro!");
        return;
    }

    let tBruto = 0, tCorridas = 0;
    let txt = `🧾 DRIVERFLUX - RELATÓRIO DETALHADO COM LOCALIZAÇÃO\n`;
    txt += `Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n`;
    txt += `=========================================\n\n`;

    registros.forEach(r => {
        tBruto += r.emprestado;
        tCorridas += r.corrida;
        txt += `[${r.dataHora}] Reg #${r.id}\n`;
        txt += `  -> Empréstimo: ${formatarMoeda(r.emprestado)}\n`;
        txt += `  -> Corrida:    ${formatarMoeda(r.corrida)}\n`;
        
        // Adiciona GPS ao relatório
        if (r.gps) {
            txt += `  📍 GPS: Lat ${r.gps.latitude.toFixed(6)}, Lng ${r.gps.longitude.toFixed(6)} (±${Math.round(r.gps.accuracy)}m)\n`;
        } else {
            txt += `  ❌ GPS: Sem localização\n`;
        }
        txt += `-----------------------------------------\n`;
    });

    let juros = tBruto * 0.20;
    let tGeral = tBruto + juros + tCorridas;

    txt += `\n=========================================\n`;
    txt += `Subtotal Empréstimos:    ${formatarMoeda(tBruto)}\n`;
    txt += `Taxa Adicional (+20%):   ${formatarMoeda(juros)}\n`;
    txt += `Subtotal Corridas:       ${formatarMoeda(tCorridas)}\n`;
    txt += `-----------------------------------------\n`;
    txt += `VALOR TOTAL A RECEBER:   ${formatarMoeda(tGeral)}\n`;
    txt += `=========================================`;

    document.getElementById('reportOutput').innerText = txt;
    document.getElementById('reportOutput').style.display = 'block';
    document.getElementById('cardRelatorio').style.display = 'block';
}

/**
 * Exporta dados em formato JSON (para salvar/sincronizar com servidor)
 */
function exportarDados() {
    const dados = {
        exportacao: new Date().toISOString(),
        registros: registros,
        resumo: {
            totalRegistros: registros.length,
            registrosComGPS: registros.filter(r => r.gps).length
        }
    };
    
    return JSON.stringify(dados, null, 2);
}

/**
 * Inicializa a aplicação
 */
document.addEventListener('DOMContentLoaded', function() {
    GeoLocation.init();
});
