const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
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

  let filaEspera = [];
  const salasConfirmacao = new Map(); 

  io.on("connection", (socket) => {
    socket.on("entrar_sala_privada", ({ novaSalaPrivada }) => {
      socket.join(novaSalaPrivada);
    });

    // === NOVO SISTEMA DE MATCH (BLOQUEIA AMIGOS) ===
    socket.on("procurar_parceiro", (dadosFiltro) => {
      const meuGenero = dadosFiltro?.meuGenero || "prefiro-nao-dizer";
      let minhasPreferencias = dadosFiltro?.preferencia || ["qualquer"];
      
      // 🦆 NOVO: Recebe sua identidade e quem são seus amigos
      const meuEmail = dadosFiltro?.meuEmail || socket.id;
      const amigosEmails = dadosFiltro?.amigosEmails || [];

      // Limpa o usuário da fila caso ele já tenha clicado antes
      filaEspera = filaEspera.filter(u => u.socket.id !== socket.id);

      // Algoritmo Tinder dos Patos aprimorado
      const indexParceiro = filaEspera.findIndex(esperando => {
        // 1. Eu sirvo para o outro?
        const sirvoPraEle = esperando.preferencias.includes("qualquer") || esperando.preferencias.includes(meuGenero);
        
        // 2. O outro serve para mim?
        const eleServePraMim = minhasPreferencias.includes("qualquer") || minhasPreferencias.includes(esperando.meuGenero);
        
        // 3. NOVO: Garante que ele não está na sua lista de amigos e você não está na dele
        const eleEAmigo = amigosEmails.includes(esperando.meuEmail);
        const euSouAmigoDele = esperando.amigosEmails.includes(meuEmail);
        const naoSaoAmigos = !eleEAmigo && !euSouAmigoDele;
        
        return sirvoPraEle && eleServePraMim && naoSaoAmigos;
      });

      if (indexParceiro !== -1) {
        // MATCH TOTAL! Tira o parceiro da fila
        const parceiro = filaEspera.splice(indexParceiro, 1)[0];

        const salaId = `lagoa_${Date.now()}`;
        socket.join(salaId);
        parceiro.socket.join(salaId);

        salasConfirmacao.set(salaId, new Set());

        io.to(socket.id).emit("parceiro_encontrado", { salaId, meuNome: "Pato 1", parceiroNome: "Pato 2" });
        io.to(parceiro.socket.id).emit("parceiro_encontrado", { salaId, meuNome: "Pato 2", parceiroNome: "Pato 1" });
      } else {
        // SEM MATCH: Vai pra fila aguardar alguém compatível (salvando também os dados de amizade)
        filaEspera.push({ socket, meuGenero, preferencias: minhasPreferencias, meuEmail, amigosEmails });
        socket.emit("aguardando_parceiro");
      }
    });

    // === NOVA FUNÇÃO: CANCELAR BUSCA ===
    socket.on("cancelar_busca", () => {
      filaEspera = filaEspera.filter(u => u.socket.id !== socket.id);
    });

    socket.on("confirmar_conexao", ({ salaId }) => {
      const confirmados = salasConfirmacao.get(salaId);
      if (confirmados) {
        confirmados.add(socket.id);
        io.to(salaId).emit("atualizar_confirmacao", { confirmados: confirmados.size });

        if (confirmados.size === 2) {
          io.to(salaId).emit("conexao_confirmada", { salaId });
          salasConfirmacao.delete(salaId);

          setTimeout(() => {
            io.to(salaId).emit("tempo_esgotado");
            io.in(salaId).socketsLeave(salaId);
          }, 360000);
        }
      }
    });

    socket.on("sair_da_lagoa", () => {
      filaEspera = filaEspera.filter(u => u.socket.id !== socket.id);
      Array.from(socket.rooms).forEach(room => {
        if(room.startsWith("lagoa_")) {
          socket.leave(room);
          socket.to(room).emit("parceiro_desconectou");
        }
      });
    });

    socket.on("enviar_mensagem", (data) => {
      const msgId = `msg_${Date.now()}`;
      const hora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
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

    socket.on("iniciar_chamada_voz", ({ salaId }) => socket.to(salaId).emit("recebeu_chamada_voz"));
    socket.on("aceitar_chamada_voz", ({ salaId }) => socket.to(salaId).emit("chamada_voz_aceita_pelo_parceiro"));
    socket.on("recusar_chamada_voz", ({ salaId }) => socket.to(salaId).emit("chamada_voz_recusada"));
    socket.on("encerrar_chamada_voz", ({ salaId }) => socket.to(salaId).emit("chamada_voz_encerrada"));
    socket.on("webrtc_offer", ({ salaId, offer }) => socket.to(salaId).emit("webrtc_offer", { offer }));
    socket.on("webrtc_answer", ({ salaId, answer }) => socket.to(salaId).emit("webrtc_answer", { answer }));
    socket.on("webrtc_ice_candidate", ({ salaId, candidate }) => socket.to(salaId).emit("webrtc_ice_candidate", { candidate }));

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

    socket.on("disconnect", () => {
      filaEspera = filaEspera.filter(u => u.socket.id !== socket.id);
      Array.from(socket.rooms).forEach(room => {
        if (room !== socket.id) socket.to(room).emit("parceiro_desconectou");
      });
    });
  });

  server.listen(port, () => {
    console.log(`🚀 Servidor DuckZone rodando lindamente na porta ${port}`);
  });
});