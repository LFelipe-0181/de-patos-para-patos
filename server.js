const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let filaDeEspera = [];
const confirmacoesSalas = {};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res, parse(req.url, true)));
  
  const io = new Server(httpServer, {
    maxHttpBufferSize: 1e7
  });

  io.on("connection", (socket) => {
    
    socket.on("procurar_parceiro", () => {
      filaDeEspera = filaDeEspera.filter((s) => s.id !== socket.id);
      socket.patoAnonimo = `Pato Anônimo #${Math.floor(1000 + Math.random() * 9000)}`;

      if (filaDeEspera.length > 0) {
        const parceiro = filaDeEspera.shift();
        const salaId = `lagoa_${socket.id}_${parceiro.id}`;

        socket.join(salaId);
        parceiro.join(salaId);

        socket.salaAtual = salaId;
        parceiro.salaAtual = salaId;

        confirmacoesSalas[salaId] = 0;

        socket.emit("parceiro_encontrado", { salaId, meuNome: socket.patoAnonimo, parceiroNome: parceiro.patoAnonimo });
        parceiro.emit("parceiro_encontrado", { salaId, meuNome: parceiro.patoAnonimo, parceiroNome: socket.patoAnonimo });
      } else {
        filaDeEspera.push(socket);
        socket.emit("aguardando_parceiro");
      }
    });

    socket.on("confirmar_conexao", (data) => {
      const salaId = data.salaId;
      if (!salaId) return;

      if (confirmacoesSalas[salaId] !== undefined) {
        confirmacoesSalas[salaId] += 1;
        const total = confirmacoesSalas[salaId];

        if (total === 1) {
          io.to(salaId).emit("atualizar_confirmacao", { confirmados: 1 });
        } else if (total >= 2) {
          io.to(salaId).emit("conexao_confirmada", { salaId });
          delete confirmacoesSalas[salaId];
        }
      }
    });

    socket.on("enviar_mensagem", (data) => {
      if (!data.salaId) return;
      const hora = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      io.to(data.salaId).emit("receber_mensagem", {
        id: msgId,
        salaId: data.salaId,
        usuario: data.remetenteNome,
        mensagem: data.mensagem,
        imagem: data.imagem || null,
        audio: data.audio || null,
        hora
      });
    });

    socket.on("apagar_mensagem", (data) => {
      if (!data.salaId || !data.msgId) return;
      io.to(data.salaId).emit("mensagem_apagada", {
        salaId: data.salaId,
        msgId: data.msgId
      });
    });

    // SISTEMA WEBRTC - CONVITE E ACEITE EXPLÍCITO
    socket.on("iniciar_chamada_voz", (data) => {
      socket.to(data.salaId).emit("recebeu_chamada_voz");
    });

    socket.on("aceitar_chamada_voz", (data) => {
      socket.to(data.salaId).emit("chamada_voz_aceita_pelo_parceiro");
    });

    socket.on("webrtc_offer", (data) => {
      socket.to(data.salaId).emit("webrtc_offer", { offer: data.offer });
    });

    socket.on("webrtc_answer", (data) => {
      socket.to(data.salaId).emit("webrtc_answer", { answer: data.answer });
    });

    socket.on("webrtc_ice_candidate", (data) => {
      socket.to(data.salaId).emit("webrtc_ice_candidate", { candidate: data.candidate });
    });

    socket.on("recusar_chamada_voz", (data) => {
      socket.to(data.salaId).emit("chamada_voz_recusada");
    });

    socket.on("encerrar_chamada_voz", (data) => {
      socket.to(data.salaId).emit("chamada_voz_encerrada");
    });

    socket.on("solicitar_chat_privado", (data) => {
      socket.to(data.salaId).emit("recebeu_convite_privado", {
        solicitante: data.meuNome
      });
    });

    socket.on("responder_convite_privado", (data) => {
      if (data.aceito) {
        const novaSalaPrivada = `ninho_${Date.now()}`;
        io.to(data.salaId).emit("migrar_para_privado", { novaSalaPrivada });
      } else {
        socket.to(data.salaId).emit("convite_privado_recusado");
      }
    });

    socket.on("entrar_sala_privada", (data) => {
      socket.join(data.novaSalaPrivada);
    });

    const limpar = () => {
      filaDeEspera = filaDeEspera.filter((s) => s.id !== socket.id);
      if (socket.salaAtual) {
        delete confirmacoesSalas[socket.salaAtual];
        socket.to(socket.salaAtual).emit("parceiro_desconectou");
        socket.leave(socket.salaAtual);
        socket.salaAtual = null;
      }
    };

    socket.on("sair_da_lagoa", limpar);
    socket.on("disconnect", limpar);
  });

  httpServer.listen(port, () => console.log(`> DuckZone rodando na porta ${port}`));
});