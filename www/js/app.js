<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>GPS para Endereço</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #f2f4f8;
    }

    .box {
      max-width: 500px;
      margin: auto;
      background: white;
      padding: 25px;
      border-radius: 16px;
      box-shadow: 0 8px 25px rgba(0,0,0,0.15);
      text-align: center;
    }

    button {
      padding: 14px 20px;
      font-size: 16px;
      border: none;
      border-radius: 10px;
      background: #2563eb;
      color: white;
      cursor: pointer;
    }

    button:hover {
      background: #1d4ed8;
    }

    .resultado {
      margin-top: 20px;
      text-align: left;
      background: #f8fafc;
      padding: 15px;
      border-radius: 10px;
      word-break: break-word;
    }
  </style>
</head>
<body>

  <div class="box">
    <h2>GPS para Endereço</h2>

    <button onclick="pegarLocalizacao()">Pegar minha localização</button>

    <div class="resultado" id="resultado">
      Aguardando...
    </div>
  </div>

  <script>
    function pegarLocalizacao() {
      const resultado = document.getElementById("resultado");

      if (!navigator.geolocation) {
        resultado.innerHTML = "Seu navegador não suporta GPS.";
        return;
      }

      resultado.innerHTML = "Pedindo permissão de localização...";

      navigator.geolocation.getCurrentPosition(
        async function(posicao) {
          const latitude = posicao.coords.latitude;
          const longitude = posicao.coords.longitude;

          resultado.innerHTML = `
            <b>Latitude:</b> ${latitude}<br>
            <b>Longitude:</b> ${longitude}<br><br>
            Buscando endereço...
          `;

          try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;

            const resposta = await fetch(url, {
              headers: {
                "Accept": "application/json"
              }
            });

            const dados = await resposta.json();

            if (dados && dados.display_name) {
              resultado.innerHTML = `
                <b>Latitude:</b> ${latitude}<br>
                <b>Longitude:</b> ${longitude}<br><br>
                <b>Endereço encontrado:</b><br>
                ${dados.display_name}
              `;
            } else {
              resultado.innerHTML = "Não consegui encontrar o endereço.";
            }

          } catch (erro) {
            resultado.innerHTML = "Erro ao buscar endereço: " + erro.message;
          }
        },
        function(erro) {
          if (erro.code === erro.PERMISSION_DENIED) {
            resultado.innerHTML = "Você negou a permissão de localização.";
          } else {
            resultado.innerHTML = "Erro ao pegar localização.";
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
  </script>

</body>
</html>
