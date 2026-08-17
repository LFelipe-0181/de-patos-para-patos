const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";

// CORREÇÃO CRÍTICA PARA O RENDER:
const port = process.env.PORT || 3000; 

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Erro na requisição HTTP", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = new Server(server, {
    cors: { origin: "*" }
  });

  // ==========================================
  // LÓGICA DO BACKEND DUCKZONE (SOCKET.IO)
  // ==========================================
  
  let filaEspera = null;
  const salasConfirmacao = new Map(); // Guarda quantos patos aceitaram a conexão

  io.on("connection", (socket) => {
    // 1. Entrar em sala privada (Ninhos Salvos)
    socket.on("entrar_sala_privada", ({ novaSalaPrivada }) => {
      socket.join(novaSalaPrivada);
    });

    // 2. Procurar Parceiro na Lagoa Pública
    socket.on("procurar_parceiro", () => {
      if (filaEspera && filaEspera.id !== socket.id) {
        const parceiro = filaEspera;
        filaEspera = null;

        const salaId = `lagoa_${Date.now()}`;
        socket.join(salaId);
        parceiro.join(salaId);

        salasConfirmacao.set(salaId, new Set());

        io.to(socket.id).emit("parceiro_encontrado", { salaId, meuNome: "Pato 1", parceiroNome: "Pato 2" });
        io.to(parceiro.id).emit("parceiro_encontrado", { salaId, meuNome: "Pato 2", parceiroNome: "Pato 1" });
      } else {
        filaEspera = socket;
        socket.emit("aguardando_parceiro");
      }
    });

    // 3. Confirmar Conexão Dupla
    socket.on("confirmar_conexao", ({ salaId }) => {
      const confirmados = salasConfirmacao.get(salaId);
      if (confirmados) {
        confirmados.add(socket.id);
        io.to(salaId).emit("atualizar_confirmacao", { confirmados: confirmados.size });

        if (confirmados.size === 2) {
          io.to(salaId).emit("conexao_confirmada", { salaId });
          salasConfirmacao.delete(salaId);
        }
      }
    });

    // 4. Chat de Texto, Imagens e Áudio
    socket.on("enviar_mensagem", (data) => {
      const msgId = `msg_${Date.now()}`;
      const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      io.to(data.salaId).emit("receber_mensagem", {
        id: msgId,
        salaId: data.salaId,
        usuario: data.remetenteNome,
        mensagem: data.mensagem,
        imagem: data.imagem,
        audio: data.audio,
        hora
      });
    });

    socket.on("apagar_mensagem", ({ salaId, msgId }) => {
      io.to(salaId).emit("mensagem_apagada", { salaId, msgId });
    });

    // 5. Chamada de Voz (Sinalização WebRTC)
    socket.on("iniciar_chamada_voz", ({ salaId }) => socket.to(salaId).emit("recebeu_chamada_voz"));
    socket.on("aceitar_chamada_voz", ({ salaId }) => socket.to(salaId).emit("chamada_voz_aceita_pelo_parceiro"));
    socket.on("recusar_chamada_voz", ({ salaId }) => socket.to(salaId).emit("chamada_voz_recusada"));
    socket.on("encerrar_chamada_voz", ({ salaId }) => socket.to(salaId).emit("chamada_voz_encerrada"));
    socket.on("webrtc_offer", ({ salaId, offer }) => socket.to(salaId).emit("webrtc_offer", { offer }));
    socket.on("webrtc_answer", ({ salaId, answer }) => socket.to(salaId).emit("webrtc_answer", { answer }));
    socket.on("webrtc_ice_candidate", ({ salaId, candidate }) => socket.to(salaId).emit("webrtc_ice_candidate", { candidate }));

    // 6. Migração para Ninho Privado
    socket.on("solicitar_chat_privado", ({ salaId, meuNome }) => {
      socket.to(salaId).emit("recebeu_convite_privado", { solicitante: meuNome });
    });
    socket.on("responder_convite_privado", ({ salaId, aceito }) => {
      if (aceito) {
        const novaSalaPrivada = `ninho_${Date.now()}`;
        io.to(salaId).emit("migrar_para_privado", { novaSalaPrivada });
      } else {
        socket.to(salaId).emit("convite_privado_recusado");
      }
    });

    // 7. Tratamento de Desconexão
    socket.on("disconnect", () => {
      if (filaEspera && filaEspera.id === socket.id) {
        filaEspera = null;
      }
      // Avisa as salas (Lagoa ou Ninhos) que o usuário saiu
      Array.from(socket.rooms).forEach(room => {
        if (room !== socket.id) socket.to(room).emit("parceiro_desconectou");
      });
    });
  });

  server.listen(port, () => {
    console.log(`🚀 Servidor DuckZone rodando lindamente na porta ${port}`);
  });
});