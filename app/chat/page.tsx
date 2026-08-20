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
  naoLida?: boolean;
  icone?: string; 
  amigoRef?: any; 
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
  const [perfilAmigoSelecionado, setPerfilAmigoSelecionado] = useState<any | null>(null); 
  
  const [modalAmigosAberto, setModalAmigosAberto] = useState<boolean>(false);
  const [amigoTagInput, setAmigoTagInput] = useState<string>("");
  const [amigoMensagem, setAmigoMensagem] = useState<string>("");
  
  const [abaAmigos, setAbaAmigos] = useState<'add' | 'pending' | 'list'>('add');
  const [listaPendentes, setListaPendentes] = useState<any[]>([]);
  const [listaAmigosAceitos, setListaAmigosAceitos] = useState<any[]>([]);
  const [meuIdBanco, setMeuIdBanco] = useState<string>("");

  const [menuAberto, setMenuAberto] = useState<boolean>(false);

  const [volumeSaida, setVolumeSaida] = useState<number>(100);
  const [ganhoMicrofone, setGanhoMicrofone] = useState<number>(100);
  const ganhoMicrofoneRef = useRef<number>(100);
  useEffect(() => { ganhoMicrofoneRef.current = ganhoMicrofone; }, [ganhoMicrofone]);
  
  const micGainNodeRef = useRef<GainNode | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  
  useEffect(() => {
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = ganhoMicrofone / 100;
    }
  }, [ganhoMicrofone]);

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
              
              const chatIndex = novosPrivados.findIndex(p => p.id === roomId);

              if (chatIndex === -1) {
                novosPrivados.push({
                  id: roomId,
                  nomeCustom: amigo.name,
                  mensagens: [],
                  naoLida: false,
                  icone: amigo.avatar || "🦆", 
                  amigoRef: amigo 
                });
                mudou = true;
              } else {
                novosPrivados[chatIndex].amigoRef = amigo;
                novosPrivados[chatIndex].icone = amigo.avatar || "🦆";
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
  const [lagoaNaoLida, setLagoaNaoLida] = useState<boolean>(false);
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

  const handleUploadMeuAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image(); img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 180; canvas.height = 180;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, 180, 180);
          setMeuAvatar(canvas.toDataURL("image/jpeg", 0.8));
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadIconeChat = (e: React.ChangeEvent<HTMLInputElement>, chatId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image(); img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 120; canvas.height = 120;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, 120, 120);
          const base64 = canvas.toDataURL("image/jpeg", 0.8);
          setPrivados(prev => prev.map(p => p.id === chatId ? { ...p, icone: base64 } : p));
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const capturarAudioNativo = async (): Promise<MediaStream> => {
    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
    });
    
    if (micAudioCtxRef.current && micAudioCtxRef.current.state !== "closed") {
      micAudioCtxRef.current.close();
    }
    
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    micAudioCtxRef.current = audioCtx;
    
    const source = audioCtx.createMediaStreamSource(rawStream);
    const gainNode = audioCtx.createGain();
    
    gainNode.gain.value = ganhoMicrofoneRef.current / 100;
    micGainNodeRef.current = gainNode;
    
    const destination = audioCtx.createMediaStreamDestination();
    source.connect(gainNode);
    gainNode.connect(destination);
    
    return destination.stream;
  };

  const alternarTesteMic = async () => {
    if (testandoMic) {
      if (testStreamRef.current) testStreamRef.current.getTracks().forEach(t => t.stop());
      if (testAudioRef.current) testAudioRef.current.srcObject = null;
      if (micAudioCtxRef.current && micAudioCtxRef.current.state !== "closed") {
         micAudioCtxRef.current.close();
         micAudioCtxRef.current = null;
      }
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
      const dadosLeves = privados.map(chat => ({ ...chat, amigoRef: null }));
      localStorage.setItem("duckzone_ninhos_privados", JSON.stringify(dadosLeves));
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
          const ehAbaAtiva = data.salaId === abaAtivaRef.current;

          if (existe) {
            return prev.map(chat => chat.id === data.salaId ? { ...chat, mensagens: [...chat.mensagens, novaMsg], naoLida: !ehAbaAtiva || chat.naoLida } : chat);
          } else {
            return [...prev, { id: data.salaId, nomeCustom: "Novo Amigo", mensagens: [novaMsg], naoLida: !ehAbaAtiva, icone: "🔒" }];
          }
        });
      } else { 
        setLagoaMensagens((prev) => [...prev, novaMsg]); 
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
        return [...prev, { id: novaId, mensagens: [{ id: `sys_${Date.now()}`, usuario: "SISTEMA 🔒", mensagem: `Vocês entraram em um Ninho Privado! Suas identidades foram reveladas.`, hora: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) }], naoLida: false, icone: "🔒" }];
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
    
    const emailsAmigos = listaAmigosAceitos.map(amizade => {
       const amigo = amizade.senderId === meuIdBanco ? amizade.receiver : amizade.sender;
       return amigo.email;
    });

    socketRef.current?.emit("procurar_parceiro", {
      meuGenero: meuGenero,
      preferencia: preferenciasGenero,
      meuEmail: session?.user?.email, 
      amigosEmails: emailsAmigos
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
    if (micAudioCtxRef.current && micAudioCtxRef.current.state !== "closed") {
       micAudioCtxRef.current.close();
       micAudioCtxRef.current = null;
    }
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
            if (salaAlvo) socketRef.current?.emit("enviar_mensagem", { salaId: salaAlvo, remetenteNome: abaAtiva !== "lagoa" ? `${meuNomeReal}#${minhaTag}` : meuNomeAnon, mensagem: "🎤 Mensagem de áudio", audio: reader.result as string });
          };
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach((track) => track.stop());
          if (micAudioCtxRef.current && micAudioCtxRef.current.state !== "closed") {
             micAudioCtxRef.current.close();
             micAudioCtxRef.current = null;
          }
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
    socketRef.current?.emit("enviar_mensagem", { salaId: salaAlvo, remetenteNome: isPrivado ? `${meuNomeReal}#${minhaTag}` : meuNomeAnon, mensagem: texto, imagem: isPrivado ? imagemBase64 : null });
    setTexto(""); setImagemBase64(null);
  };

  const apagarMensagem = (msgId: string) => {
    const salaAlvo = abaAtiva !== "lagoa" ? abaAtiva : lagoaId;
    if (salaAlvo) socketRef.current?.emit("apagar_mensagem", { salaId: salaAlvo, msgId });
  };

  const isLagoa = abaAtiva === "lagoa";
  const chatAtivoData = privados.find(p => p.id === abaAtiva);
  const msgsAtuais = isLagoa ? lagoaMensagens : chatAtivoData?.mensagens || [];

  return (
    <div className="app-layout">
      {menuAberto && <div className="menu-overlay open" onClick={() => setMenuAberto(false)}></div>}

      <audio ref={remoteAudioRef} autoPlay playsInline controls={false} style={{ display: 'none' }} />
      <audio ref={testAudioRef} autoPlay playsInline muted={false} style={{ display: 'none' }} />

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');

        /* 🚀 DESIGN PREMIUM DARK/CYBERPUNK E GLASSMORPHISM */
        .app-layout { 
          display: flex; width: 100vw; height: 100vh; overflow: hidden; 
          font-family: 'Inter', sans-serif; color: #fff;
          background-color: #020617; 
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(45, 212, 191, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(14, 165, 233, 0.08) 0%, transparent 40%);
        }
        
        /* 🔥 SCROLLBAR INVISÍVEL ELEGANTE */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(45, 212, 191, 0.5); }
        * { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.1) transparent; }
        
        /* SIDEBAR FLUTUANTE DE VIDRO */
        .sidebar { 
          width: 340px; display: flex; flex-direction: column; z-index: 100; flex-shrink: 0; 
          margin: 16px 0 16px 16px; border-radius: 24px;
          background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .main-chat-area { 
          flex: 1; display: flex; flex-direction: column; position: relative; min-width: 0; 
          padding: 16px;
        }

        .chat-container-inner {
          flex: 1; display: flex; flex-direction: column;
          background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(12px);
          border-radius: 24px; border: 1px solid rgba(255,255,255,0.05);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          overflow: hidden;
        }

        .hamburger-btn { display: none; background: transparent; border: none; color: #fff; font-size: 26px; cursor: pointer; padding: 0; margin-right: 16px; transition: transform 0.2s; }
        .hamburger-btn:active { transform: scale(0.9); }
        .menu-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 90; backdrop-filter: blur(5px); }
        
        @media (max-width: 768px) {
          .sidebar { position: absolute; height: calc(100% - 32px); top: 0; left: 0; transform: translateX(-110%); max-width: 85vw; }
          .sidebar.open { transform: translateX(0); }
          .hamburger-btn { display: block; }
          .menu-overlay.open { display: block; }
          .main-chat-area { padding: 8px; width: 100%; }
        }

        /* PERFIL DE VIDRO */
        .sidebar-header { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .back-link { text-decoration: none; color: #94a3b8; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; transition: color 0.2s; }
        .back-link:hover { color: #2dd4bf; }

        .profile-card-container { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .profile-card { background: linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8)); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 12px; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        .profile-card-avatar { width: 48px; height: 48px; background: rgba(0,0,0,0.3); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 26px; border: 1px solid rgba(45,212,191,0.3); flex-shrink: 0; overflow: hidden; box-shadow: 0 0 10px rgba(45,212,191,0.2); }
        .profile-card-details { display: flex; flex-direction: column; overflow: hidden; flex: 1; }
        .profile-card-name { font-size: 14px; font-weight: 900; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.5px; }
        .profile-card-tag { font-size: 11px; color: #2dd4bf; font-family: monospace; font-weight: bold; }
        .profile-card-bio { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }

        .profile-actions-inline { display: flex; gap: 6px; }
        .icon-action-btn { width: 34px; height: 34px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.05); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; cursor: pointer; transition: all 0.2s; }
        .icon-action-btn:hover { background: #2dd4bf; color: #020617; border-color: #2dd4bf; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(45, 212, 191, 0.3); }

        /* LISTA DE CHATS */
        .chat-list { display: flex; flex-direction: column; overflow-y: auto; flex: 1; padding: 12px; gap: 6px; }
        .chat-item { display: flex; align-items: center; padding: 12px; gap: 14px; cursor: pointer; transition: all 0.2s; border-radius: 14px; border: 1px solid transparent; }
        .chat-item:hover { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.05); }
        .chat-item.active { background: rgba(45, 212, 191, 0.1); border-color: rgba(45, 212, 191, 0.2); box-shadow: inset 0 0 20px rgba(45, 212, 191, 0.05); }
        
        .chat-item-avatar { width: 44px; height: 44px; border-radius: 14px; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; overflow: hidden; }
        .chat-item-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .chat-item-title { font-weight: 800; font-size: 14px; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.3px; }
        .chat-item-sub { font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }

        .unread-dot { width: 10px; height: 10px; background-color: #f43f5e; border-radius: 50%; box-shadow: 0 0 10px rgba(244, 63, 94, 0.8); flex-shrink: 0; }

        /* 💬 HEADER DO CHAT */
        .chat-header { display: flex; padding: 16px 24px; background: rgba(15, 23, 42, 0.6); border-bottom: 1px solid rgba(255,255,255,0.05); align-items: center; justify-content: space-between; z-index: 10; }

        /* 💬 MENSAGENS (ESTILO WHATSAPP/TELEGRAM PREMIUM) */
        .chat-messages { padding: 24px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; flex: 1; }
        .message-wrapper { display: flex; gap: 12px; max-width: 80%; animation: slideUp 0.3s ease-out forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .message-wrapper.is-mine { align-self: flex-end; flex-direction: row; }
        .message-wrapper.is-other { align-self: flex-start; flex-direction: row; }
        .message-wrapper.is-system { align-self: center; max-width: 100%; justify-content: center; }
        
        .message-avatar { width: 38px; height: 38px; border-radius: 50%; background: rgba(0,0,0,0.3); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 20px; overflow: hidden; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: 0.2s; border: 2px solid transparent; }
        .message-avatar:hover { transform: scale(1.1); box-shadow: 0 6px 15px rgba(0,0,0,0.5); }
        .is-mine .message-avatar { border-color: rgba(45, 212, 191, 0.5); }
        .is-other .message-avatar { border-color: rgba(255, 255, 255, 0.1); }
        
        .message-content { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .is-mine .message-content { align-items: flex-end; }
        .is-other .message-content { align-items: flex-start; }
        
        .message-sender { font-size: 12px; color: #94a3b8; font-weight: 800; cursor: pointer; transition: 0.2s; letter-spacing: 0.5px; }
        .message-sender:hover { color: #2dd4bf; }
        
        .message-bubble { padding: 12px 18px; font-size: 15px; line-height: 1.5; color: #fff; word-break: break-word; box-shadow: 0 4px 15px rgba(0,0,0,0.2); position: relative; }
        .is-mine .message-bubble { background: linear-gradient(135deg, #0ea5e9, #2dd4bf); color: #020617; border-radius: 20px 20px 4px 20px; font-weight: 500; }
        .is-other .message-bubble { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); color: #f8fafc; border: 1px solid rgba(255,255,255,0.05); border-radius: 20px 20px 20px 4px; }
        .is-system .message-bubble { background: rgba(15, 23, 42, 0.8); color: #cbd5e1; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; font-size: 12px; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
        
        .message-time { font-size: 10px; color: #64748b; margin-top: 4px; display: flex; gap: 8px; align-items: center; font-weight: 800; }
        .delete-msg { color: #f43f5e; cursor: pointer; opacity: 0; transition: 0.2s; background: rgba(244,63,94,0.1); padding: 2px 6px; border-radius: 4px; }
        .message-wrapper:hover .delete-msg { opacity: 1; }

        /* INPUT DE MENSAGEM */
        .chat-input-container { padding: 16px 24px; background: rgba(15, 23, 42, 0.6); border-top: 1px solid rgba(255,255,255,0.05); }
        .chat-input-wrapper { display: flex; gap: 12px; align-items: center; background: rgba(0,0,0,0.3); padding: 6px 6px 6px 16px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.05); transition: border 0.3s; }
        .chat-input-wrapper:focus-within { border-color: rgba(45, 212, 191, 0.5); box-shadow: 0 0 15px rgba(45, 212, 191, 0.1); }
        .chat-input-field { flex: 1; background: transparent; border: none; color: #fff; outline: none; font-size: 15px; font-family: 'Inter', sans-serif; }
        .chat-input-field::placeholder { color: #64748b; }

        .btn-anexo { cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; color: #94a3b8; transition: 0.2s; padding: 8px; border-radius: 50%; }
        .btn-anexo:hover { color: #2dd4bf; background: rgba(45, 212, 191, 0.1); }
        
        .btn-enviar { background: linear-gradient(135deg, #0ea5e9, #2dd4bf); color: #020617; border: none; border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 10px rgba(45, 212, 191, 0.3); transition: transform 0.2s; }
        .btn-enviar:hover { transform: scale(1.05); }

        /* CLASSES EXTRÍDAS DO INLINE PARA PREVENIR ERROS DE COMPILAÇÃO DO SWC */
        .status-convite-box { background: rgba(15, 23, 42, 0.8); border: 1px solid #2dd4bf; color: #fff; padding: 12px 20px; text-align: center; border-radius: 12px; margin: 0 auto 20px; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); backdrop-filter: blur(10px); }
        .status-convite-box.is-chamando { display: flex; justify-content: space-between; align-items: center; }
        .convite-privado-box { background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05)); border: 1px solid #10b981; padding: 20px; text-align: center; border-radius: 20px; margin: 0 auto 20px; max-width: 400px; backdrop-filter: blur(10px); box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .timer-lagoa { padding: 12px; text-align: center; font-size: 12px; font-weight: 800; border-radius: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 12px 16px; transition: all 0.3s; }
        .timer-lagoa.safe { background-color: rgba(45, 212, 191, 0.05); border: 1px dashed #2dd4bf; color: #2dd4bf; }
        .timer-lagoa.danger { background-color: rgba(244, 63, 94, 0.1); border: 1px dashed #f43f5e; color: #f43f5e; }
        .matching-card { margin: auto; text-align: center; padding: 40px; background: rgba(15, 23, 42, 0.8); border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); max-width: 450px; backdrop-filter: blur(20px); box-shadow: 0 20px 40px rgba(0,0,0,0.5); }

        /* PAINEL DE LIGAÇÃO */
        .discord-slider { -webkit-appearance: none; width: 100%; background: transparent; }
        .discord-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; background: #2dd4bf; border-radius: 50%; cursor: pointer; box-shadow: 0 0 10px rgba(45,212,191,0.5); margin-top: -5px; }
        .discord-slider::-webkit-slider-runnable-track { width: 100%; height: 6px; cursor: pointer; background: rgba(255,255,255,0.1); border-radius: 3px; }
        
        .discord-call-panel-v2 { background: rgba(15, 23, 42, 0.8); border-bottom: 1px solid rgba(255,255,255,0.05); padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
        .d-call-info { display: flex; align-items: center; gap: 12px; }
        .d-call-dot { width: 10px; height: 10px; background-color: #2dd4bf; border-radius: 50%; box-shadow: 0 0 10px rgba(45, 212, 191, 0.6); animation: pulse-neon 2s infinite; }
        @keyframes pulse-neon { 0% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(45, 212, 191, 0); } 100% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0); } }
        .d-call-text { display: flex; flex-direction: column; }
        .d-call-title { color: #2dd4bf; font-weight: 800; font-size: 14px; letter-spacing: 0.5px; }
        .d-call-subtitle { color: #94a3b8; font-size: 12px; font-weight: 500; }
        .d-call-actions { display: flex; gap: 10px; }
        .d-action-btn { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px solid transparent; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; transition: 0.2s; }
        .d-action-btn:hover { background: rgba(255,255,255,0.1); }
        .d-action-btn.btn-muted { background-color: rgba(244,63,94,0.2); color: #f43f5e; border-color: rgba(244,63,94,0.3); }
        .d-action-btn.btn-disconnect { background: #f43f5e; color: #fff; border-radius: 20px; width: auto; padding: 0 16px; font-size: 13px; font-weight: 800; gap: 6px; box-shadow: 0 4px 10px rgba(244,63,94,0.3); }

        .pro-input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 14px 16px; border-radius: 12px; font-size: 14px; outline: none; transition: 0.2s; }
        .pro-input:focus { border-color: #2dd4bf; box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1); }
        .pro-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .avatar-btn { font-size: 26px; padding: 10px; border-radius: 14px; cursor: pointer; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); flex: 1; display: flex; justify-content: center; transition: 0.2s; }
        .avatar-btn:hover { transform: translateY(-2px); }
        .avatar-btn.active { background: rgba(45, 212, 191, 0.15); border-color: #2dd4bf; box-shadow: 0 4px 10px rgba(45,212,191,0.2); }
        .btn-test-mic { width: 100%; padding: 16px; border-radius: 12px; cursor: pointer; font-weight: 900; font-size: 14px; border: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.3); color: #2dd4bf; display: flex; justify-content: center; gap: 8px; transition: 0.2s; }
        .btn-test-mic.active { border-color: #f43f5e; color: #f43f5e; background: rgba(244, 63, 94, 0.1); box-shadow: 0 0 15px rgba(244,63,94,0.2); }
        
        .friend-card { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: rgba(0,0,0,0.2); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 12px; transition: all 0.2s ease; cursor: pointer; }
        .friend-card:hover { background: rgba(15,23,42,0.8); border-color: #2dd4bf; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
        
        .pref-btn { flex: 1; padding: 12px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; text-align: center; border: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.3); color: #94a3b8; transition: 0.2s; letter-spacing: 0.5px; }
        .pref-btn:hover { background: rgba(255,255,255,0.05); }
        .pref-btn.active { background: linear-gradient(135deg, rgba(14,165,233,0.2), rgba(45,212,191,0.2)); border-color: #2dd4bf; color: #2dd4bf; box-shadow: 0 0 15px rgba(45,212,191,0.1); }
      `}} />

      <aside className={`sidebar ${menuAberto ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/" className="back-link">
            ← Voltar para o Início
          </Link>
        </div>

        <div className="profile-card-container">
          <div className="profile-card">
            <div className="profile-card-avatar">
              {meuAvatar.startsWith("data:image/") ? (
                <img src={meuAvatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }} />
              ) : (
                meuAvatar
              )}
            </div>
            <div className="profile-card-details">
              <span className="profile-card-name">{meuNomeReal}</span>
              <span className="profile-card-tag">#{minhaTag}</span>
              <span className="profile-card-bio">{meuStatusBio}</span>
            </div>
            
            <div className="profile-actions-inline">
              <button onClick={() => { setModalPerfilAberto(true); setAbaConfig('perfil'); }} className="icon-action-btn" title="Configurações">⚙️</button>
              <button onClick={() => { setModalAmigosAberto(true); setAbaAmigos('add'); setAmigoMensagem(""); }} className="icon-action-btn" title="Amigos">👥</button>
            </div>
          </div>
        </div>

        <div className="chat-list">
          <div className={`chat-item ${isLagoa ? "active" : ""}`} onClick={() => { setAbaAtiva("lagoa"); setMenuAberto(false); setLagoaNaoLida(false); }}>
            <div className="chat-item-avatar">🌊</div>
            <div className="chat-item-info">
              <span className="chat-item-title">Lagoa Pública</span>
              <span className="chat-item-sub">Mergulho Anônimo</span>
            </div>
            {lagoaNaoLida && <div className="unread-dot"></div>}
          </div>

          {privados.map((chat, i) => (
            <div key={chat.id} className={`chat-item ${abaAtiva === chat.id ? "active" : ""}`} onClick={() => { setAbaAtiva(chat.id); setMenuAberto(false); setPrivados(prev => prev.map(p => p.id === chat.id ? { ...p, naoLida: false } : p)); }}>
              <div className="chat-item-avatar">
                {chat.icone && chat.icone.startsWith("data:image/") ? (
                  <img src={chat.icone} alt="Icone" style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }} />
                ) : (
                  chat.icone || "🔒"
                )}
              </div>
              <div className="chat-item-info">
                <span className="chat-item-title">{chat.nomeCustom || `Ninho Privado ${i + 1}`}</span>
                <span className="chat-item-sub">Bate-Papo Seguro</span>
              </div>
              {chat.naoLida && <div className="unread-dot"></div>}
            </div>
          ))}
        </div>
      </aside>

      <main className="main-chat-area">
        <div className="chat-container-inner">
          <header className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button className="hamburger-btn" onClick={() => setMenuAberto(true)}>☰</button>
              
              {editandoNome === abaAtiva && !isLagoa ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select 
                    value={chatAtivoData?.icone?.startsWith("data:image/") ? "🔒" : chatAtivoData?.icone || "🔒"}
                    onChange={(e) => setPrivados(prev => prev.map(p => p.id === abaAtiva ? { ...p, icone: e.target.value } : p))}
                    style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid #2dd4bf', borderRadius: '6px', padding: '8px', outline: 'none', fontSize: '18px', cursor: 'pointer' }}
                  >
                    {["🔒", "🦆", "❤️", "🔥", "🚀", "🎮", "🎵", "⭐", "💼", "🍻", "😎", "👾", "🤖", "🍕"].map(emoji => (
                      <option key={emoji} value={emoji}>{emoji}</option>
                    ))}
                  </select>

                  <label style={{ cursor: 'pointer', background: 'rgba(0,0,0,0.3)', border: '1px solid #2dd4bf', color: '#2dd4bf', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🖼️ Foto
                    <input type="file" accept="image/*" onChange={(e) => handleUploadIconeChat(e, abaAtiva)} style={{ display: 'none' }} />
                  </label>

                  <input 
                    value={nomePrivadoInput} 
                    onChange={(e) => setNomePrivadoInput(e.target.value)}
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter') {
                        setPrivados(prev => prev.map(p => p.id === abaAtiva ? { ...p, nomeCustom: nomePrivadoInput || p.nomeCustom } : p));
                        setEditandoNome(null);
                      }
                    }}
                    autoFocus
                    style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid #2dd4bf', borderRadius: '6px', padding: '8px 10px', outline: 'none', fontSize: '16px', fontWeight: 'bold', maxWidth: '140px' }}
                  />
                  <button onClick={() => {
                    setPrivados(prev => prev.map(p => p.id === abaAtiva ? { ...p, nomeCustom: nomePrivadoInput || p.nomeCustom } : p));
                    setEditandoNome(null);
                  }} style={{background: 'linear-gradient(135deg, #0ea5e9, #2dd4bf)', color: '#020617', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer'}}>OK</button>
                  
                  <button onClick={() => {
                    if(confirm("Tem certeza que deseja apagar e sair deste chat?")) {
                      setPrivados(prev => prev.filter(p => p.id !== abaAtiva));
                      setAbaAtiva("lagoa");
                      setEditandoNome(null);
                    }
                  }} style={{background: 'rgba(244,63,94,0.2)', color: '#f43f5e', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', border: '1px solid rgba(244,63,94,0.5)', cursor: 'pointer', marginLeft: '6px'}} title="Apagar Chat Definitivamente">🗑️</button>
                </div>
              ) : (
                <span 
                  style={{ fontSize: "18px", fontWeight: "900", color: "#fff", display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.5px' }}
                >
                  {isLagoa ? "Mergulho Anônimo" : (
                    <>
                      <span style={{ cursor: 'pointer' }} onClick={() => chatAtivoData?.amigoRef && setPerfilAmigoSelecionado(chatAtivoData.amigoRef)}>
                        {chatAtivoData?.icone?.startsWith("data:image/") ? (
                          <img src={chatAtivoData.icone} alt="Icone Chat" style={{ width: '32px', height: '32px', borderRadius: '10px', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.3)', borderRadius:'10px', fontSize:'18px' }}>
                            {chatAtivoData?.icone || "🔒"}
                          </div>
                        )}
                      </span>
                      <span style={{ cursor: 'pointer' }} onClick={() => chatAtivoData?.amigoRef && setPerfilAmigoSelecionado(chatAtivoData.amigoRef)}>
                        {chatAtivoData?.nomeCustom || "Ninho Privado"}
                      </span>
                    </>
                  )}
                  {!isLagoa && <span onClick={() => { setEditandoNome(abaAtiva); setNomePrivadoInput(chatAtivoData?.nomeCustom || `Ninho Privado`); }} style={{fontSize: '14px', marginLeft: '4px', opacity: 0.5, cursor: 'pointer'}} title="Editar Chat">✏️</span>}
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {!isLagoa && !chamadaAtiva && (
                <button onClick={solicitarChamadaVoz} className="btn-call-start" style={{ padding: '8px 16px', background: 'rgba(35, 165, 89, 0.15)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.5)', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: '0.2s' }}>
                  📞 <span className="hide-on-mobile">Ligar</span>
                </button>
              )}

              {isLagoa && lagoaAtiva && (
                <>
                  <button onClick={solicitarPrivado} style={{ padding: '8px 12px', background: 'rgba(45, 212, 191, 0.1)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.5)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    <span className="hide-on-mobile">Puxar </span>🔐
                  </button>
                  <button onClick={sairDaLagoa} style={{ padding: '8px 12px', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.5)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    <span className="hide-on-mobile">Sair </span>🚪
                  </button>
                </>
              )}
            </div>
          </header>

          {chamadaAtiva && !isLagoa && (
            <div className="discord-call-panel-v2">
              <div className="d-call-info">
                <div className="d-call-dot"></div>
                <div className="d-call-text">
                  <span className="d-call-title">Voz Conectada</span>
                  <span className="d-call-subtitle">Sinal Estável</span>
                </div>
              </div>
              <div className="d-call-actions">
                <button onClick={() => setModalPerfilAberto(true)} className="d-action-btn hide-on-mobile" title="Configurar Áudio">⚙️</button>
                <button onClick={alternarMuteMicrofone} className={`d-action-btn ${microfoneMutado ? "btn-muted" : ""}`}>
                  {microfoneMutado ? "🔇" : "🎙️"}
                </button>
                <button onClick={alternarAudioMutado} className={`d-action-btn ${audioMutado ? "btn-muted" : ""}`}>
                  {audioMutado ? "🔕" : "🎧"}
                </button>
                <button onClick={desligarChamada} className="d-action-btn btn-disconnect">Desligar</button>
              </div>
            </div>
          )}

          {chamadaRecebida && !chamadaAtiva && !isLagoa && (
            <div className="discord-call-panel-v2" style={{ background: 'linear-gradient(90deg, rgba(35,165,89,0.2), transparent)' }}>
              <div className="d-call-info">
                <div className="d-call-dot"></div>
                <div className="d-call-text">
                  <span className="d-call-title" style={{color: '#fff'}}>Chamada Recebida...</span>
                  <span className="d-call-subtitle">O outro pato quer falar!</span>
                </div>
              </div>
              <div className="d-call-actions">
                <button onClick={atenderChamadaVoz} className="d-action-btn" style={{backgroundColor: '#23a559', color: '#fff', boxShadow: '0 0 15px rgba(35,165,89,0.5)'}}>📞</button>
                <button onClick={recusarChamadaVoz} className="d-action-btn btn-muted">✖️</button>
              </div>
            </div>
          )}

          <div className="chat-messages">
            {isLagoa && lagoaAtiva && tempoRestante !== null && (
              <div className={`timer-lagoa ${tempoRestante <= 60 ? 'danger' : 'safe'}`}>
                {tempoRestante <= 60 ? "⚠️ " : "⏳ "} A Lagoa fechará em {Math.floor(tempoRestante / 60)}:{(tempoRestante % 60).toString().padStart(2, '0')}
              </div>
            )}

            {isLagoa && !lagoaAtiva && !lagoaPendente && !procurando && (
              <div className="matching-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
                <div className="duck-avatar" style={{ fontSize: '80px', marginBottom: '20px', filter: 'drop-shadow(0 0 20px rgba(45,212,191,0.5))' }}>🎭</div>
                <h2 style={{ fontSize: "28px", fontWeight: "900", color: "#fff", marginBottom: "12px", letterSpacing: '1px' }}>Lagoa Secreta</h2>
                <p style={{ color: "#94a3b8", fontSize: "15px", marginBottom: "32px", lineHeight: '1.6' }}>Mergulhe anonimamente. Você tem 6 minutos para conhecer alguém antes que a lagoa feche.</p>
                
                <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                  <label className="pro-label" style={{ display: 'block', marginBottom: '12px' }}>COM QUEM VOCÊ QUER CONVERSAR?</label>
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <button type="button" onClick={() => togglePreferencia('qualquer')} className={`pref-btn ${preferenciasGenero.includes('qualquer') ? 'active' : ''}`}>Qualquer</button>
                    <button type="button" onClick={() => togglePreferencia('masculino')} className={`pref-btn ${preferenciasGenero.includes('masculino') ? 'active' : ''}`}>Masculinos</button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => togglePreferencia('feminino')} className={`pref-btn ${preferenciasGenero.includes('feminino') ? 'active' : ''}`}>Femininos</button>
                    <button type="button" onClick={() => togglePreferencia('nao-binario')} className={`pref-btn ${preferenciasGenero.includes('nao-binario') ? 'active' : ''}`}>Não-Binários</button>
                  </div>
                </div>

                <button onClick={procurarPato} style={{ width: '100%', padding: '16px 32px', fontSize: '16px', fontWeight: '900', background: 'linear-gradient(135deg, #0ea5e9, #2dd4bf)', color: '#020617', border: 'none', borderRadius: '14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(45,212,191,0.4)', transition: '0.2s', textTransform: 'uppercase', letterSpacing: '1px' }}>ENTRAR NA ÁGUA 🚀</button>
              </div>
            )}

            {isLagoa && procurando && (
              <div className="matching-card" style={{ border: '1px solid #2dd4bf', boxShadow: '0 0 40px rgba(45,212,191,0.15)' }}>
                <div className="radar-spinner" style={{ margin: '0 auto 30px', width: '70px', height: '70px', border: '4px solid rgba(45, 212, 191, 0.1)', borderTopColor: '#2dd4bf', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <h2 style={{ color: "#2dd4bf", fontSize: '22px', marginBottom: '12px', letterSpacing: '1px', fontWeight: '900' }}>Rastreando...</h2>
                <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '32px' }}>Buscando um pato compatível nas redondezas.</p>
                
                <button onClick={cancelarBusca} style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.5)', color: '#f43f5e', padding: '12px 32px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
                  Cancelar Busca
                </button>
              </div>
            )}

            {isLagoa && lagoaPendente && !lagoaAtiva && (
              <div className="matching-card" style={{ border: '1px solid #2dd4bf', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                <h2 style={{ color: "#fff", marginBottom: "16px", fontSize: '26px', fontWeight: '900' }}>Alvo Encontrado!</h2>
                <div style={{ display: "inline-block", background: "rgba(45,212,191,0.15)", color: "#2dd4bf", padding: "8px 20px", borderRadius: "20px", fontSize: "14px", fontWeight: "900", marginBottom: "24px", border: '1px solid rgba(45,212,191,0.3)' }}>
                  Aguardando aceitação: {confirmados}/2
                </div>
                <p style={{ color: "#e2e8f0", marginBottom: "32px", fontSize: '16px' }}>Deseja conversar com <strong>{parceiroNomeAnon || "um Pato Misterioso"}</strong>?</p>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button onClick={recusarConexao} style={{ flex: 1, padding: '14px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.5)', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', transition: '0.2s' }}>Pular ❌</button>
                  <button onClick={aceitarConexao} style={{ flex: 2, padding: '14px', background: jaAceitou ? '#10b981' : 'linear-gradient(135deg, #0ea5e9, #2dd4bf)', color: '#020617', fontWeight: '900', border: 'none', borderRadius: '12px', cursor: jaAceitou ? 'default' : 'pointer', boxShadow: '0 4px 15px rgba(45,212,191,0.3)', transition: '0.2s' }} disabled={jaAceitou}>
                    {jaAceitou ? "⏳ Aguardando..." : "Conectar! 🚀"}
                  </button>
                </div>
              </div>
            )}

            {(isLagoa ? lagoaAtiva : true) && (
              <>
                {statusConvite && (
                  <div className={`status-convite-box ${(!isLagoa && statusConvite.includes("Chamando")) ? 'is-chamando' : ''}`}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{statusConvite}</span>
                    {!isLagoa && statusConvite.includes("Chamando") && (
                       <button onClick={desligarChamada} style={{ background: "#f43f5e", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", boxShadow: '0 2px 8px rgba(244,63,94,0.4)' }}>Cancelar</button>
                    )}
                  </div>
                )}

                {isLagoa && convitePendente && (
                  <div className="convite-privado-box">
                    <div style={{ fontSize: '30px', marginBottom: '10px' }}>🔐</div>
                    <p style={{ color: "#fff", fontWeight: "900", marginBottom: "20px", fontSize: '16px' }}>{convitePendente} quer te levar pro Privado!</p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => responderConvite(false)} style={{ flex: 1, padding: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.5)', color: '#f43f5e', fontWeight: 'bold', borderRadius: '10px', cursor: 'pointer' }}>Recusar</button>
                      <button onClick={() => responderConvite(true)} style={{ flex: 1, padding: '12px', background: '#10b981', border: 'none', color: '#020617', fontWeight: '900', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}>Aceitar</button>
                    </div>
                  </div>
                )}

                {msgsAtuais.map((msg) => {
                  let nomeLimpo = msg.usuario;
                  if (nomeLimpo.includes("data:image")) {
                    const match = nomeLimpo.match(/([a-zA-Z0-9_ -]+#\d{4})/);
                    if (match) nomeLimpo = match[1];
                    else nomeLimpo = nomeLimpo.split(" ").pop() || "Pato";
                  }
                  nomeLimpo = nomeLimpo.replace(/^[^\w\s]+/, '').trim();

                  const eSistema = nomeLimpo.includes("SISTEMA");
                  const eMinha = !eSistema && nomeLimpo.includes(`#${minhaTag}`);

                  let avatarMsg = "🦆";
                  if (isLagoa) {
                    avatarMsg = eSistema ? "🤖" : "🎭";
                  } else {
                    if (eSistema) avatarMsg = "🤖";
                    else if (eMinha) avatarMsg = meuAvatar;
                    else avatarMsg = chatAtivoData?.amigoRef?.avatar || chatAtivoData?.icone || "🦆"; 
                  }

                  return (
                    <div key={msg.id} className={`message-wrapper ${eMinha && !eSistema ? 'is-mine' : eSistema ? 'is-system' : 'is-other'}`}>
                      {!eMinha && !eSistema && (
                        <div className="message-avatar" onClick={() => { if(!isLagoa && chatAtivoData?.amigoRef) setPerfilAmigoSelecionado(chatAtivoData.amigoRef) }}>
                          {avatarMsg.startsWith("data:image/") ? <img src={avatarMsg} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : avatarMsg}
                        </div>
                      )}
                      
                      <div className="message-content">
                        {!eSistema && (
                          <span className="message-sender" onClick={() => { if(!eMinha && !isLagoa && chatAtivoData?.amigoRef) setPerfilAmigoSelecionado(chatAtivoData.amigoRef) }}>
                            {nomeLimpo}
                          </span>
                        )}

                        <div className="message-bubble">
                          {msg.mensagem}
                          {msg.imagem && <img src={msg.imagem} alt="Mídia" style={{ maxWidth: "300px", borderRadius: "12px", marginTop: "8px", display: 'block', border: '1px solid rgba(255,255,255,0.1)' }} />}
                          {msg.audio && <audio src={msg.audio} controls style={{ marginTop: "8px", maxWidth: "100%", height: '36px', display: 'block', borderRadius: '18px' }} />}
                        </div>
                        
                        <div className="message-time">
                          {msg.hora}
                          {eMinha && !eSistema && <span className="delete-msg" onClick={() => apagarMensagem(msg.id)}>Excluir</span>}
                        </div>
                      </div>

                      {eMinha && !eSistema && (
                        <div className="message-avatar">
                          {avatarMsg.startsWith("data:image/") ? <img src={avatarMsg} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : avatarMsg}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}
        </div>

        {(isLagoa ? lagoaAtiva : true) && (
          <div className="chat-input-container">
            {imagemBase64 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '12px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <img src={imagemBase64} alt="Preview" style={{ height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                <span style={{ fontSize: '13px', color: '#94a3b8', flex: 1 }}>Imagem anexada</span>
                <button onClick={() => setImagemBase64(null)} style={{ background: "rgba(244,63,94,0.2)", border: "none", color: "#f43f5e", cursor: "pointer", fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px' }}>Remover</button>
              </div>
            )}
            
            <form onSubmit={enviarMensagem} className="chat-input-wrapper">
              {!isLagoa && (
                <label className="btn-anexo" title="Anexar Imagem">
                  📎 <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                </label>
              )}
              
              <input 
                type="text" 
                placeholder={gravandoAudioMsg ? "Gravando áudio... Fale agora!" : "Escreva uma mensagem..."} 
                value={texto} 
                onChange={(e) => setTexto(e.target.value)} 
                disabled={gravandoAudioMsg} 
                className="chat-input-field" 
              />
              
              <button type="button" onClick={alternarGravacaoAudioMsg} className="btn-anexo" style={{ color: gravandoAudioMsg ? '#f43f5e' : '#94a3b8', background: gravandoAudioMsg ? 'rgba(244,63,94,0.1)' : 'transparent' }}>
                {gravandoAudioMsg ? "🛑" : "🎙️"}
              </button>
              
              <button type="submit" className="btn-enviar">➤</button>
            </form>
          </div>
        )}
      </main>

      {/* MODAL DE PERFIL DO AMIGO */}
      {perfilAmigoSelecionado && (
        <div onClick={() => setPerfilAmigoSelecionado(null)} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(10px)', zIndex: 1000, padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#0b141a', borderRadius: '24px', width: '100%', maxWidth: '360px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, #0b141a 100%)', position: 'relative' }}>
              <button onClick={() => setPerfilAmigoSelecionado(null)} style={{ position: 'absolute', top: '16px', right: '20px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '32px', height: '32px', color: '#94a3b8', fontSize: '16px', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✖</button>
              
              <div style={{ width: '110px', height: '110px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '50px', border: '4px solid #2dd4bf', overflow: 'hidden', boxShadow: '0 0 20px rgba(45,212,191,0.3)' }}>
                {perfilAmigoSelecionado.avatar && perfilAmigoSelecionado.avatar.startsWith("data:image/") ? (
                  <img src={perfilAmigoSelecionado.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  perfilAmigoSelecionado.avatar || "🦆"
                )}
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#fff', letterSpacing: '0.5px' }}>{perfilAmigoSelecionado.name}</h2>
                <span style={{ fontSize: '15px', color: '#2dd4bf', fontFamily: 'monospace', fontWeight: 'bold' }}>#{perfilAmigoSelecionado.tag}</span>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', width: '100%', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', marginTop: '8px' }}>
                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '14px', fontStyle: 'italic', lineHeight: '1.5' }}>"{perfilAmigoSelecionado.bio || 'Mergulhando no lago...'}"</p>
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '1px' }}>
                  IDENTIDADE: <span style={{ color: '#fff', marginLeft: '6px' }}>{perfilAmigoSelecionado.gender || 'Secreta'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIGURAÇÕES */}
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
                    <label className="pro-label">AVATAR DO PERFIL</label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {["🦆", "🦅", "🦉", "🐧", "👑", "🚀"].map((emoji) => (
                        <span key={emoji} onClick={() => setMeuAvatar(emoji)} className={`avatar-btn ${meuAvatar === emoji ? 'active' : ''}`}>{emoji}</span>
                      ))}

                      <label style={{ cursor: 'pointer', padding: '10px 14px', borderRadius: '14px', background: meuAvatar.startsWith("data:image/") ? 'rgba(45, 212, 191, 0.15)' : '#121e24', border: meuAvatar.startsWith("data:image/") ? '1px solid #2dd4bf' : '1px solid #1f2d35', color: '#2dd4bf', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📷 Foto da Galeria
                        <input type="file" accept="image/*" onChange={handleUploadMeuAvatar} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {abaConfig === 'audio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label className="pro-label">VOLUME DE SAÍDA (ALTO-FALANTE)</label>
                    <span style={{ fontSize: '12px', color: '#2dd4bf', fontWeight: 'bold' }}>{volumeSaida}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={volumeSaida} onChange={(e) => setVolumeSaida(Number(e.target.value))} className="discord-slider" />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                    <label className="pro-label">GANHO DO MICROFONE (ENTRADA)</label>
                    <span style={{ fontSize: '12px', color: '#f43f5e', fontWeight: 'bold' }}>{ganhoMicrofone}%</span>
                  </div>
                  <input type="range" min="0" max="200" value={ganhoMicrofone} onChange={(e) => setGanhoMicrofone(Number(e.target.value))} className="discord-slider" />

                  <button type="button" onClick={alternarTesteMic} className={`btn-test-mic ${testandoMic ? 'active' : ''}`} style={{ marginTop: '10px' }}>
                    {testandoMic ? '🛑 Parar Teste' : '🎙️ Ouvir meu microfone'}
                  </button>
                  <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', marginTop: '8px' }}>Use o botão acima para testar o ganho do seu microfone e a altura do seu alto-falante simultaneamente.</p>
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
              <button onClick={fecharModalPerfil} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #0ea5e9, #2dd4bf)', border: 'none', borderRadius: '12px', color: '#020d12', fontWeight: '900', cursor: 'pointer', fontSize: '15px' }}>
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
                    <button type="submit" style={{ padding: '0 20px', background: 'linear-gradient(135deg, #0ea5e9, #2dd4bf)', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', color: '#020d12' }}>Enviar</button>
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
                            {req.sender.avatar && req.sender.avatar.startsWith("data:image/") ? (
                              <img src={req.sender.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              req.sender.avatar || "🦆"
                            )}
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
                              {amigo.avatar && amigo.avatar.startsWith("data:image/") ? (
                                <img src={amigo.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                amigo.avatar || "🦆"
                              )}
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