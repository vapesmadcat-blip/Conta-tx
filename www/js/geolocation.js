/**
 * Módulo de Geolocalização - DriverFlux
 * Captura coordenadas GPS durante entrada de dados
 */

const GeoLocation = {
    // Propriedades
    coordenadas: null,
    aguardando: false,

    /**
     * Inicializa o módulo de geolocalização
     */
    init: function() {
        if (!navigator.geolocation) {
            console.error('Geolocalização não suportada neste dispositivo');
            return false;
        }
        return true;
    },

    /**
     * Captura coordenadas GPS atuais
     * @param {Function} callback - Função chamada ao obter coordenadas (lat, lng)
     * @param {Function} onError - Função chamada em caso de erro
     */
    capturarCoordenadas: function(callback, onError) {
        if (!navigator.geolocation) {
            if (onError) onError('Geolocalização não disponível');
            return;
        }

        this.aguardando = true;
        const opcoes = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.aguardando = false;
                const { latitude, longitude, accuracy } = position.coords;
                this.coordenadas = { latitude, longitude, accuracy };
                if (callback) callback(latitude, longitude, accuracy);
            },
            (error) => {
                this.aguardando = false;
                let mensagem = 'Erro ao obter localização';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        mensagem = 'Permissão de localização negada. Verifique as configurações do app.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        mensagem = 'Informação de localização indisponível';
                        break;
                    case error.TIMEOUT:
                        mensagem = 'Timeout ao obter localização. Tente novamente.';
                        break;
                }
                if (onError) onError(mensagem);
            },
            opcoes
        );
    },

    /**
     * Obtém as coordenadas capturadas
     * @returns {Object} Objeto com latitude, longitude e accuracy
     */
    obterCoordenadas: function() {
        return this.coordenadas;
    },

    /**
     * Verifica se coordenadas estão disponíveis
     * @returns {Boolean}
     */
    temCoordenadas: function() {
        return this.coordenadas !== null;
    },

    /**
     * Limpa as coordenadas armazenadas
     */
    limparCoordenadas: function() {
        this.coordenadas = null;
    },

    /**
     * Formata as coordenadas em string legível
     * @returns {String} Formato: "Lat: X.XXXX, Lng: X.XXXX (±XX metros)"
     */
    formatarCoordenadas: function() {
        if (!this.coordenadas) return 'Sem localização';
        const { latitude, longitude, accuracy } = this.coordenadas;
        return `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)} (±${Math.round(accuracy)}m)`;
    },

    /**
     * Retorna as coordenadas como objeto JSON
     * @returns {Object}
     */
    obterJSON: function() {
        return this.coordenadas ? {
            latitude: this.coordenadas.latitude,
            longitude: this.coordenadas.longitude,
            accuracy: this.coordenadas.accuracy,
            timestamp: new Date().toISOString()
        } : null;
    }
};

// Inicializa quando o documento carrega
document.addEventListener('DOMContentLoaded', function() {
    GeoLocation.init();
});
