"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";

interface Mensagem {
  id: string;
  usuario: string;
  mensagem: string;
  imagem?: string | null;
  audio?: string | null;
  hora: string;
}

interface ChatPrivado {
  id: string;
  nomeCustom?: string;
  mensagens: Mensagem[];
  naoLida?: boolean; // 🔴 NOVO: Propriedade para controlar a bolinha vermelha
}

export default function ChatPage() {
  const { data: session } = useSession();
  
  const [meuNomeReal, setMeuNomeReal] = useState<string>("");
  const [minhaTag, setMinhaTag] = useState<string>("....");
  const [meuStatusBio, setMeuStatusBio] = useState<string>("Nadando nas águas profundas...");
  const [meuAvatar, setMeuAvatar] = useState<string>("🦆");
  
  const [meuGenero, setMeuGenero] = useState<string>("prefiro-nao-dizer");
  const [preferenciasGenero, setPreferenciasGenero] = useState<string[]>(["qualquer"]);
  
  const [abaConfig, setAbaConfig] = useState<'perfil' | 'audio' | 'notificacoes'>('perfil');
  const [permiteNotificacoes, setPermiteNotificacoes] = useState<boolean>(false);
  const permiteNotificacoesRef = useRef<boolean>(false);
  
  const [modalPerfilAberto, setModalPerfilAberto] = useState<boolean>(false);
  
  const [modalAmigosAberto, setModalAmigosAberto] = useState<boolean>(false);
  const [amigoTagInput, setAmigoTagInput] = useState<string>("");
  const [amigoMensagem, setAmigoMensagem] = useState<string>("");
  
  const [abaAmigos, setAbaAmigos] = useState<'add' | 'pending' | 'list'>('add');
  const [listaPendentes, setListaPendentes] = useState<any[]>([]);
  const [listaAmigosAceitos, setListaAmigosAceitos] = useState<any[]>([]);
  const [meuIdBanco, setMeuIdBanco] = useState<string>("");

  const [menuAberto, setMenuAberto] = useState<boolean>(false);

  const [volumeSaida, setVolumeSaida] = useState<number>(100);
  const [microfoneMutado, setMicrofoneMutado] = useState<boolean>(false);
  const [audioMutado, setAudioMutado] = useState<boolean>(false);
  const [testandoMic, setTestandoMic] = useState<boolean>(false);
  
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  const [tempoRestante, setTempoRestante] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const salva = localStorage.getItem('duckzone_notificacoes') === 'true';
      if (salva && Notification.permission === "granted") {
        setPermiteNotificacoes(true);
        permiteNotificacoesRef.current = true;
      }
    }
  }, []);

  const handleToggleNotificacoes = async () => {
    if (!permiteNotificacoes) {
      if (!("Notification" in window)) {
        alert("Este navegador não suporta notificações de área de trabalho.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setPermiteNotificacoes(true);
        permiteNotificacoesRef.current = true;
        localStorage.setItem('duckzone_notificacoes', 'true');
        new Notification("DuckZone", { body: "Notificações ativadas com sucesso! 🦆" });
      } else {
        alert("Você precisa permitir as notificações no navegador para ativar essa função.");
      }
    } else {
      setPermiteNotificacoes(false);
      permiteNotificacoesRef.current = false;
      localStorage.setItem('duckzone_notificacoes', 'false');
    }
  };

  const dispararNotificacao = (titulo: string, corpo: string) => {
    if (permiteNotificacoesRef.current && "Notification" in window && Notification.permission === "granted") {
      if (document.hidden) {
        new Notification(titulo, { body: corpo, icon: "🦆" });
      }
    }
  };

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = audioMutado;
      remoteAudioRef.current.volume = volumeSaida / 100;
    }
    if (testAudioRef.current) {
      testAudioRef.current.volume = volumeSaida / 100;
    }
  }, [audioMutado, volumeSaida]);

  useEffect(() => {
    if (session?.user) {
      const email = session.user.email || `${session.user.name?.toLowerCase().replace(/\s+/g, '')}@duckzone.local`;
      const name = session.user.name || "Pato Verificado";

      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && !data.error) {
            setMeuNomeReal(data.name);
            setMinhaTag(data.tag || "2629");
            if (data.avatar) setMeuAvatar(data.avatar);
            if (data.bio) setMeuStatusBio(data.bio);
            if (data.gender) setMeuGenero(data.gender);
          } else {
            setMeuNomeReal(`ERRO: ${data.error || 'Desconhecido'}`);
            setMinhaTag("0000");
          }
        })
        .catch((err) => {
          setMeuNomeReal(`FALHA: ${err.message}`);
          setMinhaTag("0000");
        });
    }
  }, [session]);

  const buscarAmigos = async () => {
    if (!session?.user?.email) return;
    try {
      const res = await fetch(`/api/friends?email=${session.user.email}`);
      const data = await res.json();
      if (res.ok) {
        setListaPendentes(data.pendentes || []);
        setListaAmigosAceitos(data.amigos || []);
        setMeuIdBanco(data.myId);

        const amigos = data.amigos || [];
        if (amigos.length > 0) {
          setPrivados((prev) => {
            const novosPrivados = [...prev];
            let mudou = false;

            amigos.forEach((amizade: any) => {
              const roomId = `ninho_friend_${amizade.id}`;
              const amigo = amizade.senderId === data.myId ? amizade.receiver : amizade.sender;

              if (!novosPrivados.some(p => p.id === roomId)) {
                novosPrivados.push({
                  id: roomId,
                  nomeCustom: amigo.name,
                  mensagens: [],
                  naoLida: false
                });
                mudou = true;
              }
              socketRef.current?.emit("entrar_sala_privada", { novaSalaPrivada: roomId });
            });

            return mudou ? novosPrivados : prev;
          });
        }
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (session?.user?.email) {
      buscarAmigos();
    }
  }, [session, modalAmigosAberto, abaAmigos]);

  const enviarConviteAmizade = async (e: React.FormEvent) => {
    e.preventDefault();
    setAmigoMensagem("Enviando convite... ⏳");
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderEmail: session?.user?.email, targetTagString: amigoTagInput })
      });
      const data = await res.json();
      if (res.ok) { setAmigoMensagem(`✅ ${data.message}`); setAmigoTagInput(""); } 
      else { setAmigoMensagem(`❌ ${data.error}`); }
    } catch (err) { setAmigoMensagem("❌ Erro ao conectar com o servidor."); }
  };

  const responderConviteAmizade = async (id: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      await fetch('/api/friends', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: id, action })
      });
      buscarAmigos(); 
    } catch (e) { console.error(e); }
  };

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const ringtoneCtxRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [abaAtiva, setAbaAtiva] = useState<string>("lagoa");
  const abaAtivaRef = useRef<string>("lagoa");
  useEffect(() => { abaAtivaRef.current = abaAtiva; }, [abaAtiva]);

  const [lagoaId, setLagoaId] = useState<string | null>(null);
  const lagoaIdRef = useRef<string | null>(null);
  useEffect(() => { lagoaIdRef.current = lagoaId; }, [lagoaId]);

  const [lagoaPendente, setLagoaPendente] = useState<string | null>(null);
  const [lagoaAtiva, setLagoaAtiva] = useState<boolean>(false);
  const [lagoaNaoLida, setLagoaNaoLida] = useState<boolean>(false); // 🔴 NOVO: Bolinha para a Lagoa
  const [procurando, setProcurando] = useState<boolean>(false);
  
  const [confirmados, setConfirmados] = useState<number>(0);
  const [jaAceitou, setJaAceitou] = useState<boolean>(false);

  const [meuNomeAnon, setMeuNomeAnon] = useState<string>("");
  const [parceiroNomeAnon, setParceiroNomeAnon] = useState<string>("");
  
  const [lagoaMensagens, setLagoaMensagens] = useState<Mensagem[]>([]);
  const [convitePendente, setConvitePendente] = useState<string | null>(null);
  const [statusConvite, setStatusConvite] = useState<string | null>(null);

  const [chamadaAtiva, setChamadaAtiva] = useState<boolean>(false);
  const [chamadaRecebida, setChamadaRecebida] = useState<boolean>(false);

  const [gravandoAudioMsg, setGravandoAudioMsg] = useState<boolean>(false);
  const msgMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [privados, setPrivados] = useState<ChatPrivado[]>(() => {
    if (typeof window !== "undefined") {
      const salvos = localStorage.getItem("duckzone_ninhos_privados");
      return salvos ? JSON.parse(salvos) : [];
    }
    return [];
  });

  const iniciarChatComAmigo = (amizadeId: string) => {
    const roomId = `ninho_friend_${amizadeId}`; 
    setAbaAtiva(roomId);
    setMenuAberto(false);
    setModalAmigosAberto(false);
    // Limpa a notificação ao abrir
    setPrivados(prev => prev.map(p => p.id === roomId ? { ...p, naoLida: false } : p));
  };

  const [texto, setTexto] = useState("");
  const [imagemBase64, setImagemBase64] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [editandoNome, setEditandoNome] = useState<string | null>(null);
  const [nomePrivadoInput, setNomePrivadoInput] = useState<string>("");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lagoaAtiva) {
      setTempoRestante(360);
      interval = setInterval(() => {
        setTempoRestante((prev) => {
          if (prev !== null && prev > 0) return prev - 1;
          return 0;
        });
      }, 1000);
    } else {
      setTempoRestante(null);
    }
    return () => clearInterval(interval);
  }, [lagoaAtiva]);

  const capturarAudioNativo = async (): Promise<MediaStream> => {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
  };

  const alternarTesteMic = async () => {
    if (testandoMic) {
      if (testStreamRef.current) testStreamRef.current.getTracks().forEach(t => t.stop());
      if (testAudioRef.current) testAudioRef.current.srcObject = null;
      setTestandoMic(false);
    } else {
      try {
        const stream = await capturarAudioNativo();
        testStreamRef.current = stream;
        if (testAudioRef.current) testAudioRef.current.srcObject = stream;
        setTestandoMic(true);
      } catch (err) { alert("Permissão de microfone negada."); }
    }
  };

  const fecharModalPerfil = async () => {
    if (testandoMic) alternarTesteMic();
    
    if (session?.user?.email) {
      try {
        await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: session.user.email,
            name: meuNomeReal,
            bio: meuStatusBio,
            avatar: meuAvatar,
            gender: meuGenero
          })
        });
      } catch (error) {
        console.error("Erro ao salvar perfil", error);
      }
    }

    setModalPerfilAberto(false);
  };

  const tocarRingtone = (tipo: 'chamando' | 'recebendo') => {
    pararRingtone();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ringtoneCtxRef.current = ctx;

    const beep = () => {
      if (ctx.state === "closed") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tipo === 'chamando' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(tipo === 'chamando' ? 440 : 600, ctx.currentTime);
      if (tipo === 'recebendo') osc.frequency.setValueAtTime(800, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    };

    beep();
    ringtoneIntervalRef.current = setInterval(beep, tipo === 'chamando' ? 2000 : 1000);
  };

  const pararRingtone = () => {
    if (ringtoneIntervalRef.current) clearInterval(ringtoneIntervalRef.current);
    if (ringtoneCtxRef.current && ringtoneCtxRef.current.state !== "closed") ringtoneCtxRef.current.close();
    ringtoneIntervalRef.current = null;
    ringtoneCtxRef.current = null;
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("duckzone_ninhos_privados", JSON.stringify(privados));
    }
  }, [privados]);
  // ====== SOCKET E WEBRTC ======
  const obterOuCriarPeerConnection = () => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
      ]
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const salaAlvo = abaAtivaRef.current !== "lagoa" ? abaAtivaRef.current : lagoaIdRef.current;
        socketRef.current?.emit("webrtc_ice_candidate", { salaId: salaAlvo, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        if (e.streams && e.streams[0]) {
          remoteAudioRef.current.srcObject = e.streams[0];
        } else {
          const stream = new MediaStream();
          stream.addTrack(e.track);
          remoteAudioRef.current.srcObject = stream;
        }
        const playPromise = remoteAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => { window.addEventListener('click', () => { remoteAudioRef.current?.play(); }, { once: true }); });
        }
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const enviarOfertaWebRTC = async () => {
    const salaAlvo = abaAtivaRef.current !== "lagoa" ? abaAtivaRef.current : lagoaIdRef.current;
    if (!salaAlvo || abaAtivaRef.current === "lagoa") return;
    try {
      const stream = await capturarAudioNativo();
      localStreamRef.current = stream;
      const pc = obterOuCriarPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("webrtc_offer", { salaId: salaAlvo, offer });
    } catch { alert("Microfone negado."); }
  };

  const atenderChamadaVoz = async () => {
    pararRingtone();
    const salaAlvo = abaAtivaRef.current !== "lagoa" ? abaAtivaRef.current : lagoaIdRef.current;
    if (!salaAlvo || abaAtivaRef.current === "lagoa") return;
    try {
      const stream = await capturarAudioNativo();
      localStreamRef.current = stream;
      const pc = obterOuCriarPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      socketRef.current?.emit("aceitar_chamada_voz", { salaId: salaAlvo });
      setChamadaRecebida(false); setChamadaAtiva(true);
    } catch { alert("Microfone negado."); }
  };

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    privados.forEach((chat) => socket.emit("entrar_sala_privada", { novaSalaPrivada: chat.id }));

    socket.on("aguardando_parceiro", () => { setProcurando(true); setLagoaPendente(null); setLagoaAtiva(false); setConfirmados(0); setJaAceitou(false); });
    socket.on("parceiro_encontrado", (data) => { setProcurando(false); setLagoaId(data.salaId); setLagoaPendente(data.salaId); setMeuNomeAnon(data.meuNome); setParceiroNomeAnon(data.parceiroNome); setLagoaAtiva(false); setConfirmados(0); setJaAceitou(false); });
    socket.on("atualizar_confirmacao", (data) => setConfirmados(data.confirmados));
    socket.on("conexao_confirmada", (data) => { setLagoaId(data.salaId); setLagoaAtiva(true); setLagoaPendente(null); setLagoaMensagens([]); setConfirmados(2); setLagoaNaoLida(false); });
    socket.on("tempo_esgotado", () => { alert("A lagoa fechou (6 min)!"); sairDaLagoa(); });

    socket.on("receber_mensagem", (data: Mensagem & { salaId: string }) => {
      const novaMsg = { id: data.id, usuario: data.usuario, mensagem: data.mensagem, imagem: data.imagem, audio: data.audio, hora: data.hora };
      
      if (data.salaId.startsWith("ninho_")) {
        setPrivados((prev) => {
          const existe = prev.some(c => c.id === data.salaId);
          // 🔴 NOVO: Verifica se o chat da mensagem é o que está ativo no momento
          const ehAbaAtiva = data.salaId === abaAtivaRef.current;

          if (existe) {
            return prev.map(chat => chat.id === data.salaId ? { ...chat, mensagens: [...chat.mensagens, novaMsg], naoLida: !ehAbaAtiva || chat.naoLida } : chat);
          } else {
            return [...prev, { id: data.salaId, nomeCustom: "Novo Amigo", mensagens: [novaMsg], naoLida: !ehAbaAtiva }];
          }
        });
      } else { 
        setLagoaMensagens((prev) => [...prev, novaMsg]); 
        // 🔴 NOVO: Se receber mensagem na lagoa e eu não estiver nela, acende a bolinha
        if (abaAtivaRef.current !== "lagoa") setLagoaNaoLida(true);
      }

      const isSistema = data.usuario.includes("SISTEMA");
      if (!isSistema) {
        dispararNotificacao(`DuckZone: ${data.usuario}`, novaMsg.mensagem);
      }
    });

    socket.on("mensagem_apagada", (data) => {
      if (data.salaId.startsWith("ninho_")) {
        setPrivados((prev) => prev.map(chat => chat.id === data.salaId ? { ...chat, mensagens: chat.mensagens.filter(m => m.id !== data.msgId) } : chat));
      } else { setLagoaMensagens((prev) => prev.filter(m => m.id !== data.msgId)); }
    });

    socket.on("recebeu_chamada_voz", () => { 
      setChamadaRecebida(true); 
      tocarRingtone('recebendo'); 
      dispararNotificacao("DuckZone", "📞 Alguém está te ligando!"); 
    });
    socket.on("chamada_voz_aceita_pelo_parceiro", async () => { pararRingtone(); setChamadaAtiva(true); setStatusConvite(null); await enviarOfertaWebRTC(); });

    socket.on("webrtc_offer", async (data) => {
      try {
        const pc = obterOuCriarPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        iceCandidatesQueue.current.forEach(async (c) => { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch(e){} });
        iceCandidatesQueue.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const salaAlvo = abaAtivaRef.current !== "lagoa" ? abaAtivaRef.current : lagoaIdRef.current;
        socketRef.current?.emit("webrtc_answer", { salaId: salaAlvo, answer });
        setChamadaAtiva(true);
      } catch (err) { console.error("Erro oferta:", err); }
    });

    socket.on("webrtc_answer", async (data) => {
      if (peerConnectionRef.current) { 
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer)); 
        iceCandidatesQueue.current.forEach(async (c) => { try { await peerConnectionRef.current!.addIceCandidate(new RTCIceCandidate(c)); } catch(e){} });
        iceCandidatesQueue.current = [];
        setChamadaAtiva(true); 
      }
    });

    socket.on("webrtc_ice_candidate", async (data) => {
      if (data.candidate) { 
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {} 
        } else { iceCandidatesQueue.current.push(data.candidate); }
      }
    });

    socket.on("chamada_voz_recusada", () => { pararRingtone(); alert("O outro pato recusou a chamada."); encerrarChamadaLocal(); });
    socket.on("chamada_voz_encerrada", () => { pararRingtone(); encerrarChamadaLocal(); });
    
    socket.on("recebeu_convite_privado", (data) => { 
      setConvitePendente(data.solicitante); 
      setStatusConvite(null); 
      dispararNotificacao("DuckZone", `🔒 ${data.solicitante} te convidou para um Ninho Privado!`);
    });

    socket.on("migrar_para_privado", (data) => {
      const novaId = data.novaSalaPrivada;
      socket.emit("entrar_sala_privada", { novaSalaPrivada: novaId });
      setPrivados((prev) => {
        if (prev.some(p => p.id === novaId)) return prev;
        return [...prev, { id: novaId, mensagens: [{ id: `sys_${Date.now()}`, usuario: "SISTEMA 🔒", mensagem: `Vocês entraram em um Ninho Privado! Suas identidades foram reveladas.`, hora: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }], naoLida: false }];
      });
      setAbaAtiva(novaId); setLagoaAtiva(false); setConvitePendente(null); setStatusConvite(null); setLagoaNaoLida(false);
    });

    socket.on("convite_privado_recusado", () => { setStatusConvite("O pato recusou o convite."); setTimeout(() => setStatusConvite(null), 3000); });
    socket.on("parceiro_desconectou", () => { pararRingtone(); setLagoaAtiva(false); setLagoaId(null); setLagoaPendente(null); setProcurando(false); setJaAceitou(false); setConfirmados(0); encerrarChamadaLocal(); setLagoaNaoLida(false); });

    return () => { pararRingtone(); if(testandoMic) alternarTesteMic(); socket.disconnect(); };
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lagoaMensagens, privados, abaAtiva]);

  const togglePreferencia = (valor: string) => {
    setPreferenciasGenero((prev) => {
      if (valor === 'qualquer') return ['qualquer'];
      
      const semQualquer = prev.filter(p => p !== 'qualquer');
      if (semQualquer.includes(valor)) {
        const nova = semQualquer.filter(p => p !== valor);
        return nova.length === 0 ? ['qualquer'] : nova;
      } else {
        return [...semQualquer, valor];
      }
    });
  };

  const procurarPato = () => { 
    setProcurando(true); 
    socketRef.current?.emit("procurar_parceiro", {
      meuGenero: meuGenero,
      preferencia: preferenciasGenero
    }); 
  };

  const cancelarBusca = () => {
    setProcurando(false);
    socketRef.current?.emit("cancelar_busca");
  };
  
  const aceitarConexao = () => { if (lagoaPendente && !jaAceitou) { setJaAceitou(true); socketRef.current?.emit("confirmar_conexao", { salaId: lagoaPendente }); } };
  const recusarConexao = () => { setLagoaPendente(null); setJaAceitou(false); setConfirmados(0); procurarPato(); };
  const solicitarPrivado = () => { if (!lagoaId) return; setStatusConvite("Convite enviado! Aguardando..."); socketRef.current?.emit("solicitar_chat_privado", { salaId: lagoaId, meuNome: `${meuNomeReal}#${minhaTag}` }); };
  const responderConvite = (aceito: boolean) => { if (!lagoaId) return; socketRef.current?.emit("responder_convite_privado", { salaId: lagoaId, aceito }); setConvitePendente(null); };

  const sairDaLagoa = () => {
    socketRef.current?.emit("sair_da_lagoa");
    encerrarChamadaLocal();
    setLagoaAtiva(false); setLagoaId(null); setConfirmados(0); setTempoRestante(null); setLagoaNaoLida(false);
  };

  const solicitarChamadaVoz = () => {
    const salaAlvo = abaAtivaRef.current !== "lagoa" ? abaAtivaRef.current : lagoaIdRef.current;
    if (!salaAlvo || abaAtivaRef.current === "lagoa") return;
    socketRef.current?.emit("iniciar_chamada_voz", { salaId: salaAlvo });
    setStatusConvite("Chamando... 📞");
    tocarRingtone('chamando');
  };

  const recusarChamadaVoz = () => { 
    pararRingtone(); 
    const salaAlvo = abaAtivaRef.current !== "lagoa" ? abaAtivaRef.current : lagoaIdRef.current;
    if (salaAlvo && abaAtivaRef.current !== "lagoa") socketRef.current?.emit("recusar_chamada_voz", { salaId: salaAlvo }); 
    setChamadaRecebida(false); 
  };

  const alternarMuteMicrofone = () => {
    setMicrofoneMutado((prev) => {
      const novo = !prev;
      if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !novo);
      if (!novo && audioMutado) setAudioMutado(false);
      return novo;
    });
  };

  const alternarAudioMutado = () => {
    setAudioMutado((prev) => {
      const novo = !prev;
      if (novo && !microfoneMutado) alternarMuteMicrofone();
      return novo;
    });
  };

  const encerrarChamadaLocal = () => {
    pararRingtone();
    if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    iceCandidatesQueue.current = [];
    setChamadaAtiva(false); setChamadaRecebida(false); setMicrofoneMutado(false); setAudioMutado(false); setStatusConvite(null);
  };

  const desligarChamada = () => { 
    pararRingtone(); 
    const salaAlvo = abaAtivaRef.current !== "lagoa" ? abaAtivaRef.current : lagoaIdRef.current;
    if (salaAlvo && abaAtivaRef.current !== "lagoa") socketRef.current?.emit("encerrar_chamada_voz", { salaId: salaAlvo }); 
    encerrarChamadaLocal(); 
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image(); img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800; const scaleSize = MAX_WIDTH / img.width;
          canvas.width = Math.min(img.width, MAX_WIDTH); canvas.height = img.height * (img.width > MAX_WIDTH ? scaleSize : 1);
          const ctx = canvas.getContext("2d"); ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          setImagemBase64(canvas.toDataURL("image/jpeg", 0.7));
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const alternarGravacaoAudioMsg = async () => {
    if (gravandoAudioMsg) {
      msgMediaRecorderRef.current?.stop(); setGravandoAudioMsg(false);
    } else {
      try {
        const stream = await capturarAudioNativo();
        const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 128000 } : undefined;
        const recorder = new MediaRecorder(stream, options);
        msgMediaRecorderRef.current = recorder;
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            const salaAlvo = abaAtiva !== "lagoa" ? abaAtiva : lagoaId;
            if (salaAlvo) socketRef.current?.emit("enviar_mensagem", { salaId: salaAlvo, remetenteNome: abaAtiva !== "lagoa" ? `${meuAvatar} ${meuNomeReal}#${minhaTag}` : meuNomeAnon, mensagem: "🎤 Mensagem de áudio", audio: reader.result as string });
          };
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach((track) => track.stop());
        };
        recorder.start();
        setGravandoAudioMsg(true);
      } catch { alert("Microfone negado."); }
    }
  };

  const enviarMensagem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim() && !imagemBase64) return;
    const isPrivado = abaAtiva !== "lagoa"; const salaAlvo = isPrivado ? abaAtiva : lagoaId;
    if (!salaAlvo) return;
    socketRef.current?.emit("enviar_mensagem", { salaId: salaAlvo, remetenteNome: isPrivado ? `${meuAvatar} ${meuNomeReal}#${minhaTag}` : meuNomeAnon, mensagem: texto, imagem: isPrivado ? imagemBase64 : null });
    setTexto(""); setImagemBase64(null);
  };

  const apagarMensagem = (msgId: string) => {
    const salaAlvo = abaAtiva !== "lagoa" ? abaAtiva : lagoaId;
    if (salaAlvo) socketRef.current?.emit("apagar_mensagem", { salaId: salaAlvo, msgId });
  };

  const isLagoa = abaAtiva === "lagoa";
  const msgsAtuais = isLagoa ? lagoaMensagens : privados.find(p => p.id === abaAtiva)?.mensagens || [];

  return (
    <div className="app-layout">
      {menuAberto && <div className="menu-overlay open" onClick={() => setMenuAberto(false)}></div>}

      <audio ref={remoteAudioRef} autoPlay playsInline controls={false} style={{ display: 'none' }} />
      <audio ref={testAudioRef} autoPlay playsInline muted={false} style={{ display: 'none' }} />

      <style dangerouslySetInnerHTML={{__html: `
        /* RESET E ESTRUTURA GLOBAL */
        .app-layout { display: flex; width: 100vw; height: 100vh; overflow: hidden; background: #020d12; color: #fff; font-family: sans-serif; }
        .sidebar { width: 340px; background: #0b141a; border-right: 1px solid #1f2d35; display: flex; flex-direction: column; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); z-index: 100; flex-shrink: 0; }
        .main-chat-area { flex: 1; display: flex; flex-direction: column; position: relative; min-width: 0; background: #020d12; }
        .hamburger-btn { display: none; background: transparent; border: none; color: #fff; font-size: 26px; cursor: pointer; padding: 0; margin-right: 16px; transition: transform 0.2s; }
        .hamburger-btn:active { transform: scale(0.9); }
        .menu-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 90; backdrop-filter: blur(3px); }
        
        @media (max-width: 768px) {
          .sidebar { position: absolute; height: 100%; top: 0; left: 0; transform: translateX(-100%); max-width: 85vw; box-shadow: 5px 0 25px rgba(0,0,0,0.5); }
          .sidebar.open { transform: translateX(0); }
          .hamburger-btn { display: block; }
          .menu-overlay.open { display: block; }
          .main-chat-area { width: 100%; }
        }

        /* PERFIL REDESENHADO (ESTILO CARD DISCORD/TELEGRAM) */
        .sidebar-header { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); background: #0b141a; }
        .back-link { text-decoration: none; color: #94a3b8; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; transition: color 0.2s; }
        .back-link:hover { color: #2dd4bf; }

        .profile-card-container { padding: 12px 16px; border-bottom: 1px solid #1f2d35; }
        .profile-card { background: linear-gradient(135deg, #0f1c24, #12212b); border: 1px solid #1f2d35; border-radius: 16px; padding: 12px; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .profile-card-avatar { width: 46px; height: 48px; background: #1a2830; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 26px; border: 1px solid rgba(45,212,191,0.2); flex-shrink: 0; }
        .profile-card-details { display: flex; flex-direction: column; overflow: hidden; flex: 1; }
        .profile-card-name { font-size: 14px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .profile-card-tag { font-size: 11px; color: #2dd4bf; font-family: monospace; font-weight: bold; }
        .profile-card-bio { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }

        .profile-actions-inline { display: flex; gap: 6px; }
        .icon-action-btn { width: 34px; height: 34px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; cursor: pointer; transition: all 0.2s; }
        .icon-action-btn:hover { background: #2dd4bf; color: #020d12; border-color: #2dd4bf; transform: translateY(-1px); }

        /* LISTA DE CHATS */
        .chat-list { display: flex; flex-direction: column; overflow-y: auto; flex: 1; padding: 12px 12px; gap: 6px; }
        .chat-item { display: flex; align-items: center; padding: 10px 14px; gap: 14px; cursor: pointer; transition: all 0.2s; border-radius: 12px; border: 1px solid transparent; }
        .chat-item:hover { background: #121e24; border-color: rgba(255,255,255,0.04); }
        .chat-item.active { background: rgba(45, 212, 191, 0.1); border-color: rgba(45, 212, 191, 0.3); }
        
        .chat-item-avatar { width: 42px; height: 42px; border-radius: 12px; background: #1a2830; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .chat-item-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .chat-item-title { font-weight: 700; font-size: 14px; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-item-sub { font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }

        /* 🔴 NOVO: Estilo da bolinha de mensagem não lida */
        .unread-dot {
          width: 10px;
          height: 10px;
          background-color: #f43f5e;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(244, 63, 94, 0.8);
          flex-shrink: 0;
        }

        /* PAINEL DE LIGAÇÃO DISCORD */
        .discord-slider { -webkit-appearance: none; width: 100%; background: transparent; }
        .discord-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; background: #fff; border-radius: 50%; cursor: pointer; box-shadow: 0 0 5px rgba(0,0,0,0.5); margin-top: -5px; }
        .discord-slider::-webkit-slider-runnable-track { width: 100%; height: 6px; cursor: pointer; background: transparent; }
        .discord-call-panel-v2 { background-color: #111214; border: 1px solid #1e1f22; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; margin: 10px 16px; }
        .d-call-info { display: flex; align-items: center; gap: 12px; }
        .d-call-dot { width: 12px; height: 12px; background-color: #23a559; border-radius: 50%; box-shadow: 0 0 8px rgba(35, 165, 89, 0.6); animation: pulse-green 2s infinite; }
        @keyframes pulse-green { 0% { box-shadow: 0 0 0 0 rgba(35, 165, 89, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(35, 165, 89, 0); } 100% { box-shadow: 0 0 0 0 rgba(35, 165, 89, 0); } }
        .d-call-text { display: flex; flex-direction: column; }
        .d-call-title { color: #23a559; font-weight: 700; font-size: 14px; }
        .d-call-subtitle { color: #949ba4; font-size: 12px; font-weight: 500; }
        .d-call-actions { display: flex; gap: 12px; }
        .d-action-btn { width: 40px; height: 40px; border-radius: 50%; background-color: #2b2d31; border: 1px solid transparent; color: #dbdee1; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; }
        .d-action-btn:hover { background-color: #313338; border-color: #dbdee1; }
        .d-action-btn.btn-muted { background-color: #da373c; color: #fff; }
        .d-action-btn.btn-disconnect { background-color: #da373c; color: #fff; border-radius: 24px; width: auto; padding: 0 16px; font-size: 14px; font-weight: 700; gap: 8px; }
        
        .pro-input { width: 100%; background: #121e24; border: 1px solid #1f2d35; color: #fff; padding: 14px 16px; border-radius: 12px; font-size: 14px; outline: none; }
        .pro-input:focus { border-color: #2dd4bf; box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1); }
        .pro-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .avatar-btn { font-size: 26px; padding: 10px; border-radius: 14px; cursor: pointer; background: #121e24; border: 1px solid #1f2d35; flex: 1; display: flex; justify-content: center; }
        .avatar-btn.active { background: rgba(45, 212, 191, 0.15); border-color: #2dd4bf; }
        .btn-test-mic { width: 100%; padding: 16px; border-radius: 12px; cursor: pointer; font-weight: 800; font-size: 14px; border: 1px solid #1f2d35; background: #121e24; color: #f43f5e; display: flex; justify-content: center; gap: 8px;}
        .btn-test-mic.active { border-color: #f43f5e; background: rgba(244, 63, 94, 0.1); }
        
        .friend-card { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #121e24; border-radius: 16px; border: 1px solid #1f2d35; margin-bottom: 12px; transition: all 0.2s ease; cursor: pointer; }
        .friend-card:hover { background: #1a2830; border-color: #2dd4bf; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .friend-avatar-wrap { position: relative; width: 48px; height: 48px; background: #0b141a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); }
        .friend-info { display: flex; flex-direction: column; }
        .friend-name { font-weight: 800; font-size: 16px; color: #fff; display: flex; align-items: center; gap: 6px; }
        .friend-tag { font-size: 13px; color: #94a3b8; font-family: monospace; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 6px; }
        .chat-action-btn { width: 40px; height: 40px; border-radius: 50%; background: rgba(45, 212, 191, 0.1); border: 1px solid rgba(45, 212, 191, 0.2); display: flex; align-items: center; justify-content: center; font-size: 18px; color: #2dd4bf; transition: all 0.2s; }
        .friend-card:hover .chat-action-btn { background: #2dd4bf; color: #000; transform: scale(1.1); }
        .btn-accept { background: #10b981; color: #020d12; border: none; padding: 10px 16px; border-radius: 10px; cursor: pointer; font-weight: 900; transition: 0.2s; }
        .btn-accept:hover { background: #059669; transform: scale(1.05); }
        .btn-reject { background: transparent; color: #f43f5e; border: 1px solid #f43f5e; padding: 10px 16px; border-radius: 10px; cursor: pointer; font-weight: 900; transition: 0.2s; }
        .btn-reject:hover { background: rgba(244, 63, 94, 0.1); transform: scale(1.05); }
        
        .pref-btn { flex: 1; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer; text-align: center; border: 1px solid #1f2d35; background: #121e24; color: #94a3b8; transition: 0.2s; }
        .pref-btn.active { background: rgba(45, 212, 191, 0.15); border-color: #2dd4bf; color: #2dd4bf; }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        
        @media (max-width: 500px) {
          .hide-on-mobile { display: none !important; }
          .d-call-info { max-width: 50%; }
          .d-call-subtitle { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        }
      `}} />

      <aside className={`sidebar ${menuAberto ? 'open' : ''}`}>
        {/* BOTÃO VOLTAR SUPER CLEAN */}
        <div className="sidebar-header">
          <Link href="/" className="back-link">
            ← Voltar para o Início
          </Link>
        </div>

        {/* PERFIL EM CARD ELEGANTE COM BOTOES DE AÇÃO EM ÍCONE */}
        <div className="profile-card-container">
          <div className="profile-card">
            <div className="profile-card-avatar">{meuAvatar}</div>
            <div className="profile-card-details">
              <span className="profile-card-name">{meuNomeReal}</span>
              <span className="profile-card-tag">#{minhaTag}</span>
              <span className="profile-card-bio">{meuStatusBio}</span>
            </div>
            
            <div className="profile-actions-inline">
              <button 
                onClick={() => { setModalPerfilAberto(true); setAbaConfig('perfil'); }} 
                className="icon-action-btn" 
                title="Configurações"
              >
                ⚙️
              </button>
              <button 
                onClick={() => { setModalAmigosAberto(true); setAbaAmigos('add'); setAmigoMensagem(""); }} 
                className="icon-action-btn" 
                title="Amigos"
              >
                👥
              </button>
            </div>
          </div>
        </div>

        {/* LISTA DE CHATS ESTILIZADA */}
        <div className="chat-list">
          {/* 🔴 NOVO: Limpa a notificação ao clicar na Lagoa */}
          <div className={`chat-item ${isLagoa ? "active" : ""}`} onClick={() => { setAbaAtiva("lagoa"); setMenuAberto(false); setLagoaNaoLida(false); }}>
            <div className="chat-item-avatar">🌊</div>
            <div className="chat-item-info">
              <span className="chat-item-title">Lagoa Pública</span>
              <span className="chat-item-sub">Mergulho Anônimo</span>
            </div>
            {lagoaNaoLida && <div className="unread-dot"></div>}
          </div>

          {privados.map((chat, i) => (
            /* 🔴 NOVO: Limpa a notificação ao clicar em um Ninho Privado */
            <div key={chat.id} className={`chat-item ${abaAtiva === chat.id ? "active" : ""}`} onClick={() => { setAbaAtiva(chat.id); setMenuAberto(false); setPrivados(prev => prev.map(p => p.id === chat.id ? { ...p, naoLida: false } : p)); }}>
              <div className="chat-item-avatar">🔒</div>
              <div className="chat-item-info">
                <span className="chat-item-title">{chat.nomeCustom || `Ninho Privado ${i + 1}`}</span>
                <span className="chat-item-sub">Bate-Papo Seguro</span>
              </div>
              {/* 🔴 NOVO: Renderiza a bolinha vermelha se a propriedade naoLida for true */}
              {chat.naoLida && <div className="unread-dot"></div>}
            </div>
          ))}
        </div>
      </aside>

      <main className="main-chat-area">
        <header className="chat-header" style={{ display: 'flex', padding: '16px 20px', background: '#0b141a', borderBottom: '1px solid #1f2d35', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="hamburger-btn" onClick={() => setMenuAberto(true)}>☰</button>
            
            {editandoNome === abaAtiva && !isLagoa ? (
              <input 
                value={nomePrivadoInput} 
                onChange={(e) => setNomePrivadoInput(e.target.value)}
                onBlur={() => {
                   setPrivados(prev => prev.map(p => p.id === abaAtiva ? { ...p, nomeCustom: nomePrivadoInput || p.nomeCustom } : p));
                   setEditandoNome(null);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                autoFocus
                style={{ background: '#121e24', color: '#fff', border: '1px solid #2dd4bf', borderRadius: '4px', padding: '6px 10px', outline: 'none', fontSize: '16px', fontWeight: 'bold' }}
              />
            ) : (
              <span 
                onClick={() => { if(!isLagoa) { setEditandoNome(abaAtiva); setNomePrivadoInput(privados.find(p => p.id === abaAtiva)?.nomeCustom || `Ninho Privado`); } }} 
                style={{ cursor: isLagoa ? 'default' : 'pointer', fontSize: "18px", fontWeight: "900", color: "#fff", display: 'flex', alignItems: 'center', letterSpacing: '0.5px' }}
              >
                {isLagoa ? "Mergulho Anônimo" : (privados.find(p => p.id === abaAtiva)?.nomeCustom || "Ninho Privado")}
                {!isLagoa && <span style={{fontSize: '14px', marginLeft: '8px', opacity: 0.5}}>✏️</span>}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {!isLagoa && !chamadaAtiva && (
              <button onClick={solicitarChamadaVoz} className="btn-call-start" style={{ padding: '8px 16px', background: 'rgba(35, 165, 89, 0.15)', color: '#23a559', border: '1px solid #23a559', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                📞 <span className="hide-on-mobile">Ligar</span>
              </button>
            )}

            {isLagoa && lagoaAtiva && (
              <>
                <button onClick={solicitarPrivado} style={{ padding: '8px 12px', background: 'rgba(45, 212, 191, 0.1)', color: '#2dd4bf', border: '1px solid #2dd4bf', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  <span className="hide-on-mobile">Puxar </span>🔐
                </button>
                <button onClick={sairDaLagoa} style={{ padding: '8px 12px', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  <span className="hide-on-mobile">Sair </span>🚪
                </button>
              </>
            )}
          </div>
        </header>

        <div className="chat-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {isLagoa && lagoaAtiva && tempoRestante !== null && (
            <div style={{
              backgroundColor: tempoRestante <= 60 ? 'rgba(244, 63, 94, 0.2)' : 'rgba(45, 212, 191, 0.1)',
              border: `1px solid ${tempoRestante <= 60 ? '#f43f5e' : '#2dd4bf'}`,
              color: tempoRestante <= 60 ? '#f43f5e' : '#2dd4bf',
              padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', margin: '12px 16px', borderRadius: '10px', transition: 'all 0.3s'
            }}>
              {tempoRestante <= 60 ? "⚠️ " : "⏳ "} A Lagoa fechará em {Math.floor(tempoRestante / 60)}:{(tempoRestante % 60).toString().padStart(2, '0')}. Puxe para o Privado!
            </div>
          )}

          {chamadaAtiva && !isLagoa && (
            <div className="discord-call-panel-v2">
              <div className="d-call-info">
                <div className="d-call-dot"></div>
                <div className="d-call-text">
                  <span className="d-call-title">Voz Conectada</span>
                  <span className="d-call-subtitle">Ninho Privado</span>
                </div>
              </div>
              <div className="d-call-actions">
                <button onClick={() => setModalPerfilAberto(true)} className="d-action-btn hide-on-mobile">⚙️</button>
                <button onClick={alternarMuteMicrofone} className={`d-action-btn ${microfoneMutado ? "btn-muted" : ""}`}>
                  {microfoneMutado ? "🔇" : "🎙️"}
                </button>
                <button onClick={alternarAudioMutado} className={`d-action-btn ${audioMutado ? "btn-muted" : ""}`}>
                  {audioMutado ? "🔕" : "🎧"}
                </button>
                <button onClick={desligarChamada} className="d-action-btn btn-disconnect"><span>☎️</span></button>
              </div>
            </div>
          )}

          {chamadaRecebida && !chamadaAtiva && !isLagoa && (
            <div className="discord-call-panel-v2" style={{ borderLeft: '4px solid #23a559' }}>
              <div className="d-call-info">
                <div className="d-call-dot" style={{animation: 'pulse-green 1s infinite'}}></div>
                <div className="d-call-text">
                  <span className="d-call-title" style={{color: '#fff'}}>Recebendo Chamada...</span>
                  <span className="d-call-subtitle">O outro pato quer falar!</span>
                </div>
              </div>
              <div className="d-call-actions">
                <button onClick={atenderChamadaVoz} className="d-action-btn" style={{backgroundColor: '#23a559', color: '#fff'}}>📞</button>
                <button onClick={recusarChamadaVoz} className="d-action-btn btn-muted">✖️</button>
              </div>
            </div>
          )}

          {isLagoa && !lagoaAtiva && !lagoaPendente && !procurando && (
            <div className="matching-card" style={{ margin: 'auto', textAlign: 'center', padding: '40px 20px', background: '#0b141a', borderRadius: '16px', border: '1px solid #1f2d35', maxWidth: '450px' }}>
              <div className="duck-avatar" style={{ fontSize: '80px', marginBottom: '20px' }}>🎭</div>
              <h2 style={{ fontSize: "28px", fontWeight: "900", color: "#fff", marginBottom: "12px" }}>Lagoa Secreta</h2>
              <p style={{ color: "#94a3b8", fontSize: "15px", marginBottom: "32px", lineHeight: '1.5' }}>Mergulhe anonimamente. Você tem 6 minutos para conhecer alguém antes que a lagoa feche.</p>
              
              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                <label className="pro-label" style={{ display: 'block', marginBottom: '12px' }}>COM QUEM VOCÊ QUER CONVERSAR?</label>
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button type="button" onClick={() => togglePreferencia('qualquer')} className={`pref-btn ${preferenciasGenero.includes('qualquer') ? 'active' : ''}`}>
                    Qualquer Pessoa
                  </button>
                  <button type="button" onClick={() => togglePreferencia('masculino')} className={`pref-btn ${preferenciasGenero.includes('masculino') ? 'active' : ''}`}>
                    Masculinos
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => togglePreferencia('feminino')} className={`pref-btn ${preferenciasGenero.includes('feminino') ? 'active' : ''}`}>
                    Femininos
                  </button>
                  <button type="button" onClick={() => togglePreferencia('nao-binario')} className={`pref-btn ${preferenciasGenero.includes('nao-binario') ? 'active' : ''}`}>
                    Não-Binários
                  </button>
                </div>
              </div>

              <button onClick={procurarPato} style={{ width: '100%', padding: '16px 32px', fontSize: '16px', fontWeight: '900', background: '#2dd4bf', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(45,212,191,0.3)' }}>ENTRAR NA ÁGUA 🚀</button>
            </div>
          )}

          {isLagoa && procurando && (
            <div className="matching-card" style={{ margin: 'auto', textAlign: 'center', padding: '40px 20px', background: '#0b141a', border: '1px solid #2dd4bf', borderRadius: '16px', maxWidth: '400px', boxShadow: '0 0 20px rgba(45,212,191,0.1)' }}>
              <div className="radar-spinner" style={{ margin: '0 auto 24px', width: '60px', height: '60px', border: '4px solid rgba(45, 212, 191, 0.2)', borderTopColor: '#2dd4bf', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <h2 style={{ color: "#2dd4bf", fontSize: '20px', marginBottom: '8px' }}>Procurando um Pato...</h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '32px' }}>Aguardando alguém compatível pular na lagoa.</p>
              
              <button onClick={cancelarBusca} style={{ background: 'transparent', border: '1px solid #f43f5e', color: '#f43f5e', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
                Cancelar Busca ✖
              </button>
            </div>
          )}

          {isLagoa && lagoaPendente && !lagoaAtiva && (
            <div className="matching-card" style={{ margin: 'auto', textAlign: 'center', padding: '40px 20px', background: '#0b141a', border: '1px solid #2dd4bf', borderRadius: '20px' }}>
              <h2 style={{ color: "#fff", marginBottom: "12px", fontSize: '22px' }}>Pato Encontrado!</h2>
              <div style={{ display: "inline-block", background: "rgba(20,184,166,0.2)", color: "#2dd4bf", padding: "6px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "bold", marginBottom: "20px" }}>
                Confirmações: {confirmados}/2
              </div>
              <p style={{ color: "#94a3b8", marginBottom: "24px" }}>Deseja falar com <strong>{parceiroNomeAnon || "um Pato Anônimo"}</strong>?</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '200px', margin: '0 auto' }}>
                <button onClick={aceitarConexao} style={{ padding: '14px', background: jaAceitou ? '#10b981' : '#2dd4bf', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: jaAceitou ? 'default' : 'pointer' }} disabled={jaAceitou}>
                  {jaAceitou ? "Aguardando... ⏳" : "Conectar! 💚"}
                </button>
                <button onClick={recusarConexao} style={{ padding: '14px', background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Pular ❌</button>
              </div>
            </div>
          )}

          {(isLagoa ? lagoaAtiva : true) && (
            <>
              {statusConvite && (
                <div style={{ 
                  background: "rgba(6,24,33,0.9)", border: "1px solid #2dd4bf", color: "#fff", 
                  padding: "10px 16px", textAlign: "center", borderRadius: "10px", margin: "10px 16px",
                  display: (!isLagoa && statusConvite.includes("Chamando")) ? "flex" : "block", 
                  justifyContent: "space-between", alignItems: "center" 
                }}>
                  <span>{statusConvite}</span>
                  {!isLagoa && statusConvite.includes("Chamando") && (
                     <button onClick={desligarChamada} style={{ background: "#f43f5e", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Cancelar ✖</button>
                  )}
                </div>
              )}

              {isLagoa && convitePendente && (
                <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid #10b981", padding: "16px", textAlign: "center", borderRadius: "16px", margin: "10px 16px" }}>
                  <p style={{ color: "#fff", fontWeight: "bold", marginBottom: "12px" }}>🔒 {convitePendente} te convidou para o Privado!</p>
                  <button onClick={() => responderConvite(true)} style={{ padding: '10px 16px', background: '#10b981', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', marginRight: '10px' }}>Aceitar</button>
                  <button onClick={() => responderConvite(false)} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #f43f5e', color: '#f43f5e', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }}>Recusar</button>
                </div>
              )}

              <div className="chat-messages" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {msgsAtuais.map((msg) => {
                  const meuNomeAqui = isLagoa ? meuNomeAnon : `${meuAvatar} ${meuNomeReal}#${minhaTag}`;
                  const eMinha = msg.usuario === meuNomeAqui;
                  const eSistema = msg.usuario.includes("SISTEMA");

                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: eSistema ? 'center' : eMinha ? 'flex-end' : 'flex-start' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {msg.usuario} • {msg.hora}
                        {eMinha && !eSistema && <span onClick={() => apagarMensagem(msg.id)} style={{ cursor: 'pointer' }}>🗑️</span>}
                      </div>
                      <div style={{ 
                        background: eSistema ? '#1e293b' : eMinha ? '#2dd4bf' : '#1e293b', 
                        color: eSistema ? '#cbd5e1' : eMinha ? '#020d12' : '#fff',
                        padding: '10px 14px', borderRadius: eMinha ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        maxWidth: '85%', fontSize: '15px', lineHeight: '1.4', wordBreak: 'break-word',
                        border: eSistema ? '1px solid #334155' : 'none'
                      }}>
                        {msg.mensagem}
                        {msg.imagem && <img src={msg.imagem} alt="Mídia" style={{ maxWidth: "100%", borderRadius: "8px", marginTop: "8px" }} />}
                        {msg.audio && <audio src={msg.audio} controls style={{ marginTop: "8px", maxWidth: "100%", height: '36px' }} />}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ padding: '16px', background: '#0b141a', borderTop: '1px solid #1f2d35' }}>
                {imagemBase64 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#121e24', padding: '8px', borderRadius: '8px', marginBottom: '10px' }}>
                    <img src={imagemBase64} alt="Preview" style={{ height: '40px', borderRadius: '4px' }} />
                    <button onClick={() => setImagemBase64(null)} style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", marginLeft: "auto", fontWeight: 'bold' }}>✕ Remover Foto</button>
                  </div>
                )}
                <form onSubmit={enviarMensagem} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {!isLagoa && (
                    <label style={{ cursor: 'pointer', fontSize: '20px', padding: '8px', background: '#121e24', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      📎 <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                    </label>
                  )}
                  <input type="text" placeholder={gravandoAudioMsg ? "Gravando áudio..." : "Digite uma mensagem..."} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={gravandoAudioMsg} style={{ flex: 1, background: '#121e24', border: '1px solid #1f2d35', color: '#fff', padding: '14px 16px', borderRadius: '24px', outline: 'none', fontSize: '15px' }} />
                  <button type="button" onClick={alternarGravacaoAudioMsg} style={{ background: gravandoAudioMsg ? 'rgba(244,63,94,0.2)' : '#121e24', border: gravandoAudioMsg ? '1px solid #f43f5e' : '1px solid #1f2d35', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {gravandoAudioMsg ? "🛑" : "🎙️"}
                  </button>
                  <button type="submit" style={{ background: '#2dd4bf', color: '#000', border: 'none', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}>➤</button>
                </form>
              </div>
            </>
          )}
        </div>
      </main>

      {/* MODAL DE PERFIL TURBINADO COM NOTIFICAÇÕES */}
      {modalPerfilAberto && (
        <div onClick={fecharModalPerfil} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#0b141a', borderRadius: '20px', width: '100%', maxWidth: '400px', maxHeight: '90vh', border: '1px solid #1f2d35', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid #1f2d35', background: '#0b141a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>⚙️ Configurações</h3>
                <button onClick={fecharModalPerfil} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}>✖</button>
              </div>
              <div style={{ display: 'flex' }}>
                <button onClick={() => setAbaConfig('perfil')} style={{ flex: 1, padding: '12px 0', background: 'transparent', border: 'none', color: abaConfig === 'perfil' ? '#2dd4bf' : '#94a3b8', fontWeight: 'bold', borderBottom: abaConfig === 'perfil' ? '2px solid #2dd4bf' : '2px solid transparent', cursor: 'pointer' }}>👤 Perfil</button>
                <button onClick={() => setAbaConfig('audio')} style={{ flex: 1, padding: '12px 0', background: 'transparent', border: 'none', color: abaConfig === 'audio' ? '#2dd4bf' : '#94a3b8', fontWeight: 'bold', borderBottom: abaConfig === 'audio' ? '2px solid #2dd4bf' : '2px solid transparent', cursor: 'pointer' }}>🎙️ Áudio</button>
                <button onClick={() => setAbaConfig('notificacoes')} style={{ flex: 1, padding: '12px 0', background: 'transparent', border: 'none', color: abaConfig === 'notificacoes' ? '#2dd4bf' : '#94a3b8', fontWeight: 'bold', borderBottom: abaConfig === 'notificacoes' ? '2px solid #2dd4bf' : '2px solid transparent', cursor: 'pointer' }}>🔔 Alertas</button>
              </div>
            </div>
            
            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {abaConfig === 'perfil' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="pro-label">NOME DE EXIBIÇÃO</label>
                    <input type="text" value={meuNomeReal} onChange={(e) => setMeuNomeReal(e.target.value)} className="pro-input" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="pro-label">TAG DO USUÁRIO</label>
                    <input type="text" value={`#${minhaTag}`} disabled className="pro-input" style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="pro-label">GÊNERO / IDENTIDADE</label>
                    <select value={meuGenero} onChange={(e) => setMeuGenero(e.target.value)} className="pro-input" style={{ cursor: 'pointer' }}>
                      <option value="prefiro-nao-dizer">Prefiro não dizer</option>
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="nao-binario">Não-Binário</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="pro-label">STATUS/BIO</label>
                    <input type="text" value={meuStatusBio} onChange={(e) => setMeuStatusBio(e.target.value)} maxLength={50} className="pro-input" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="pro-label">AVATAR</label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {["🦆", "🦅", "🦉", "🐧", "👑", "🚀"].map((emoji) => (
                        <span key={emoji} onClick={() => setMeuAvatar(emoji)} className={`avatar-btn ${meuAvatar === emoji ? 'active' : ''}`}>{emoji}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {abaConfig === 'audio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label className="pro-label">VOLUME DE SAÍDA</label>
                    <span style={{ fontSize: '12px', color: '#2dd4bf', fontWeight: 'bold' }}>{volumeSaida}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={volumeSaida} onChange={(e) => setVolumeSaida(Number(e.target.value))} className="discord-slider" />
                  <button type="button" onClick={alternarTesteMic} className={`btn-test-mic ${testandoMic ? 'active' : ''}`} style={{ marginTop: '10px' }}>
                    {testandoMic ? '🛑 Parar Teste' : '🎙️ Ouvir meu microfone'}
                  </button>
                  <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', marginTop: '8px' }}>Use o botão acima para falar e ouvir a sua própria voz para testar a qualidade do seu microfone e do seu alto-falante.</p>
                </div>
              )}

              {abaConfig === 'notificacoes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, paddingRight: '16px' }}>
                      <label className="pro-label" style={{ display: 'block', marginBottom: '4px' }}>NOTIFICAÇÕES DE ÁREA DE TRABALHO</label>
                      <span style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.4', display: 'block' }}>
                        Receba um alerta na tela do seu dispositivo quando receber mensagens, convites ou ligações enquanto não estiver com a aba do chat aberta.
                      </span>
                    </div>
                    
                    <button 
                      onClick={handleToggleNotificacoes}
                      style={{
                        width: '52px', height: '28px', borderRadius: '14px', border: 'none',
                        background: permiteNotificacoes ? '#10b981' : '#1f2d35',
                        position: 'relative', cursor: 'pointer', transition: 'background 0.3s',
                        flexShrink: 0
                      }}
                    >
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: '3px', left: permiteNotificacoes ? '27px' : '3px',
                        transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </button>
                  </div>
                  
                  {permiteNotificacoes && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '12px', borderRadius: '8px', color: '#10b981', fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}>
                      ✅ O DuckZone está autorizado a enviar notificações.
                    </div>
                  )}
                </div>
              )}

            </div>
            <div style={{ padding: '20px 24px', borderTop: '1px solid #1f2d35', background: '#080e12' }}>
              <button onClick={fecharModalPerfil} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #2dd4bf, #10b981)', border: 'none', borderRadius: '12px', color: '#020d12', fontWeight: '900', cursor: 'pointer', fontSize: '15px' }}>
                SALVAR E FECHAR 💾
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AMIGOS */}
      {modalAmigosAberto && (
        <div onClick={() => setModalAmigosAberto(false)} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#0b141a', borderRadius: '20px', width: '100%', maxWidth: '450px', minHeight: '400px', maxHeight: '80vh', border: '1px solid #1f2d35', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid #1f2d35', background: '#0b141a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>🦆 Amigos</h3>
                <button onClick={() => setModalAmigosAberto(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}>✖</button>
              </div>
              <div style={{ display: 'flex' }}>
                <button onClick={() => setAbaAmigos('add')} style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: abaAmigos === 'add' ? '#2dd4bf' : '#94a3b8', fontWeight: 'bold', borderBottom: abaAmigos === 'add' ? '2px solid #2dd4bf' : '2px solid transparent', cursor: 'pointer' }}>Adicionar</button>
                <button onClick={() => setAbaAmigos('pending')} style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: abaAmigos === 'pending' ? '#2dd4bf' : '#94a3b8', fontWeight: 'bold', borderBottom: abaAmigos === 'pending' ? '2px solid #2dd4bf' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  Pendentes {listaPendentes.length > 0 && <span style={{ background: '#f43f5e', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', color: '#fff' }}>{listaPendentes.length}</span>}
                </button>
                <button onClick={() => setAbaAmigos('list')} style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: abaAmigos === 'list' ? '#2dd4bf' : '#94a3b8', fontWeight: 'bold', borderBottom: abaAmigos === 'list' ? '2px solid #2dd4bf' : '2px solid transparent', cursor: 'pointer' }}>Meus Amigos</button>
              </div>
            </div>
            
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              {abaAmigos === 'add' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Digite a Tag do pato. Ex: <strong>Pato#0000</strong></p>
                  <form onSubmit={enviarConviteAmizade} style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Nome#Tag" value={amigoTagInput} onChange={(e) => setAmigoTagInput(e.target.value)} className="pro-input" required style={{ flex: 1 }} />
                    <button type="submit" style={{ padding: '0 20px', background: '#2dd4bf', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', color: '#020d12' }}>Enviar</button>
                  </form>
                  {amigoMensagem && <div style={{ color: amigoMensagem.includes('✅') ? '#10b981' : '#f43f5e', fontSize: '14px', fontWeight: 'bold', textAlign: 'center', background: amigoMensagem.includes('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', padding: '12px', borderRadius: '8px' }}>{amigoMensagem}</div>}
                </div>
              )}

              {abaAmigos === 'pending' && (
                <div>
                  {listaPendentes.length === 0 ? (
                    <p style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>Nenhum convite pendente. 🦗</p>
                  ) : (
                    listaPendentes.map((req) => (
                      <div key={req.id} className="friend-card" style={{ cursor: 'default' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="friend-avatar-wrap">
                            {req.sender.avatar}
                          </div>
                          <div className="friend-info">
                            <div className="friend-name">{req.sender.name}</div>
                            <div style={{ marginTop: '4px' }}>
                              <span className="friend-tag">#{req.sender.tag}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-accept" onClick={() => responderConviteAmizade(req.id, 'ACCEPT')}>✓</button>
                          <button className="btn-reject" onClick={() => responderConviteAmizade(req.id, 'REJECT')}>✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {abaAmigos === 'list' && (
                <div>
                  {listaAmigosAceitos.length === 0 ? (
                    <p style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>Você ainda não tem amigos na lagoa. 🦆😢</p>
                  ) : (
                    listaAmigosAceitos.map((amizade) => {
                      const amigo = amizade.senderId === meuIdBanco ? amizade.receiver : amizade.sender;
                      return (
                        <div key={amizade.id} className="friend-card" onClick={() => iniciarChatComAmigo(amizade.id)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="friend-avatar-wrap">
                              {amigo.avatar}
                            </div>
                            <div className="friend-info">
                              <div className="friend-name">
                                {amigo.name}
                              </div>
                              <div style={{ marginTop: '4px' }}>
                                <span className="friend-tag">#{amigo.tag}</span>
                              </div>
                            </div>
                          </div>
                          <div className="chat-action-btn">
                            💬
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}