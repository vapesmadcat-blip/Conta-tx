/**
 * LOGIN FIX - Suporte Offline para DriverFlux
 * Este arquivo substitui a função realizarLogin para funcionar sem Firebase
 */

function realizarLoginMelhorado() {
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

    // Credenciais válidas (funciona sem Firebase)
    const usuariosValidos = {
        'master': '123',
        'andre': 'senha_provisoria',
        'pedro': 'senha_provisoria'
    };

    // Verificar credenciais
    if (usuariosValidos[user] === pass) {
        localStorage.setItem('driverflux_usuario_logado', user);
        localStorage.setItem('driverflux_temp_user', user);
        localStorage.setItem('driverflux_temp_isMaster', user === 'master' ? 'true' : 'false');
        
        // Redirecionar para troca de senha
        window.location.href = 'trocar-senha.html';
        return;
    }

    // Credenciais inválidas
    alert("❌ Usuário ou senha incorretos!\n\nCredenciais válidas:\n- master / 123\n- andre / senha_provisoria\n- pedro / senha_provisoria");
    if (btn) { btn.disabled = false; btn.innerHTML = "🔑 Entrar no Sistema"; }
}

// Substituir a função original quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Encontrar o botão de login e substituir o handler
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
        btnLogin.onclick = realizarLoginMelhorado;
    }
});
