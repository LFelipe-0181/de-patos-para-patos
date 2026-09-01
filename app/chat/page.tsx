"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import "../theme.css";

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
  
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const isDark = theme === "dark";
  const duckImgSrc = isDark ? "/pato-roxo.png" : "/pato-amarelo.png";
  const lagoImgSrc = isDark ? "/lago-dark.png" : "/lago-claro.png";

  const [abaChat, setAbaChat] = useState<"grupos" | "amigos" | "config">("grupos");
  
  const [meuNomeReal, setMeuNomeReal] = useState<string>("Carregando...");
  const [minhaTag, setMinhaTag] = useState<string>("....");
  const [meuStatusBio, setMeuStatusBio] = useState<string>("Nadando nas águas profundas...");
  const [meuAvatar, setMeuAvatar] = useState<string>("🦆");
  
  const [meuGenero, setMeuGenero] = useState<string>("prefiro-nao-dizer");
  const isGeneroSecreto = meuGenero === "prefiro-nao-dizer" || meuGenero === "Prefiro não informar";
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
  const [menuMensagemAberto, setMenuMensagemAberto] = useState<string | null>(null);
  
  const [respondendoA, setRespondendoA] = useState<{ id: string, usuario: string, texto: string } | null>(null);

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

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
            setMeuNomeReal(session?.user?.name || "Pato Logado");
            setMinhaTag(session?.user?.email?.length.toString().padStart(4, '0') || "2629");
          }
        })
        .catch(() => {
          setMeuNomeReal(session?.user?.name || "Pato Local");
          setMinhaTag(session?.user?.email?.length.toString().padStart(4, '0') || "2629");
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
                novosPrivados[chatIndex].nomeCustom = amigo.name;
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
            name: meuNomeReal.startsWith("ERRO") ? "Pato" : meuNomeReal,
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

  const obterOuCriarPeerConnection = () => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
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
        iceCandidatesQueue.current.forEach(async (c) => { try { await peerConnectionRef.current!.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e){} });
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
    if (isGeneroSecreto && valor !== 'qualquer') return alert("Opção bloqueada por preferir não informar o gênero.");
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
    
    try {
      tocarRingtone('chamando');
    } catch (e) {
      console.warn("Ringtone error", e);
    }
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
    
    let msgFinal = texto;
    if (respondendoA) {
       msgFinal = `[Respondendo ${respondendoA.usuario}: ${respondendoA.texto.substring(0, 30)}${respondendoA.texto.length > 30 ? '...' : ''}]\n\n${texto}`;
    }

    const isPrivado = abaAtiva !== "lagoa"; const salaAlvo = isPrivado ? abaAtiva : lagoaId;
    if (!salaAlvo) return;
    socketRef.current?.emit("enviar_mensagem", { salaId: salaAlvo, remetenteNome: isPrivado ? `${meuNomeReal}#${minhaTag}` : meuNomeAnon, mensagem: msgFinal, imagem: isPrivado ? imagemBase64 : null });
    
    setTexto(""); 
    setImagemBase64(null);
    setRespondendoA(null);
  };

  const apagarMensagem = (msgId: string) => {
    const salaAlvo = abaAtiva !== "lagoa" ? abaAtiva : lagoaId;
    if (salaAlvo) socketRef.current?.emit("apagar_mensagem", { salaId: salaAlvo, msgId });
  };

  const isLagoa = abaAtiva === "lagoa";
  const chatAtivoData = privados.find(p => p.id === abaAtiva);
  const msgsAtuais = isLagoa ? lagoaMensagens : chatAtivoData?.mensagens || [];
  const ehChatDeAmigo = Boolean(chatAtivoData?.amigoRef);

  return (
    <div data-theme={theme} className="app-layout" onClick={() => setMenuMensagemAberto(null)}>
      {menuAberto && <div className="menu-overlay open" onClick={() => setMenuAberto(false)}></div>}

      <audio ref={remoteAudioRef} autoPlay playsInline controls={false} style={{ display: 'none' }} />
      <audio ref={testAudioRef} autoPlay playsInline muted={false} style={{ display: 'none' }} />

      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--icon-color); }
        * { scrollbar-width: thin; scrollbar-color: rgba(0, 0, 0, 0.2) transparent; }

        /* ✅ 100dvh para funcionar bem nos navegadores mobile e não esconder a barra de baixo */
        .app-layout { display: flex; flex-direction: row; width: 100vw; height: 100vh; height: 100dvh; overflow: hidden; background: var(--bg-gradient); color: var(--text-main); font-family: -apple-system, sans-serif; }
        
        .chat-icon-rail { width: 68px; background-color: rgba(0, 0, 0, 0.08); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; align-items: center; padding: 20px 0; gap: 16px; z-index: 20; flex-shrink: 0; }
        .rail-btn { width: 46px; height: 46px; border-radius: 14px; border: 1px solid var(--border-color); background-color: var(--bg-input); color: var(--text-main); display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; transition: all 0.2s; }
        .rail-btn.active { background: var(--btn-blue-grad); color: #fff; border-color: transparent; }
        .rail-btn-duck { width: 28px; height: 28px; object-fit: contain; }
        
        .chat-sidebar { width: 340px; background-color: rgba(255, 255, 255, 0.2); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; box-sizing: border-box; transition: transform 0.3s ease; z-index: 15; backdrop-filter: blur(5px); flex-shrink: 0; }
        
        .sidebar-header-area { padding: 20px 16px 10px; display: flex; justify-content: space-between; align-items: center; }
        .sidebar-title { font-size: 18px; font-weight: 800; color: var(--text-main); margin: 0; }
        .sidebar-close-btn { display: none; background: transparent; border: none; color: var(--text-main); font-size: 24px; cursor: pointer; padding: 0; line-height: 1; opacity: 0.7; }
        .sidebar-close-btn:hover { opacity: 1; }

        .sidebar-scroll { flex: 1; overflow-y: auto; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 8px; }
        
        .friend-item-btn { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; background-color: var(--bg-input); border: 1px solid var(--border-color); font-size: 14px; font-weight: 600; color: var(--text-main); cursor: pointer; transition: transform 0.15s; }
        .friend-item-btn:hover { border-color: var(--icon-color); }
        .friend-item-btn.active { background: var(--btn-blue-grad); color: #fff; border-color: transparent; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; }
        .status-dot.online { background-color: #10b981; } .status-dot.offline { background-color: #9ca3af; }
        
        .chat-main-area { flex: 1; display: flex; flex-direction: column; justify-content: space-between; position: relative; min-width: 0; background: transparent; }
        .chat-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: var(--chat-header-bg); border-bottom: 1px solid var(--border-color); }
        .chat-header-user { display: flex; align-items: center; gap: 12px; }
        .chat-avatar { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; border: 2px solid var(--icon-color); color: var(--icon-color); cursor: pointer; background: var(--bg-input); }
        .chat-header-name { font-size: 18px; font-weight: 700; color: var(--text-main); }
        .chat-icons { display: flex; gap: 18px; font-size: 20px; color: var(--icon-color); cursor: pointer; }
        
        .chat-messages { flex: 1; padding: 24px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
        .chat-bubble { padding: 10px 14px; font-size: 14px; box-shadow: var(--chat-glow); line-height: 1.45; word-break: break-word; }
        
        .chat-bubble-wrapper { display: flex; gap: 12px; align-items: flex-end; width: 100%; position: relative; }
        .msg-options-container { position: relative; display: flex; align-items: center; justify-content: center; }
        .msg-dots-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 20px; padding: 4px; opacity: 0; transition: opacity 0.2s ease; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; }
        .chat-bubble-wrapper:hover .msg-dots-btn { opacity: 1; }
        .msg-dots-btn:hover { background: rgba(0,0,0,0.1); color: var(--text-main); }
        
        .msg-dropdown { position: absolute; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 50; display: flex; flex-direction: column; min-width: 140px; overflow: hidden; padding: 6px 0; }
        .msg-dropdown-btn { background: transparent; border: none; padding: 10px 16px; text-align: left; color: var(--text-main); font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s; display: flex; gap: 8px; align-items: center; }
        .msg-dropdown-btn:hover { background: var(--bg-input); }
        .msg-dropdown-btn.danger { color: #f43f5e; }

        .chat-input-area { padding: 16px 24px; background: transparent; display: flex; flex-direction: column; align-items: center; }
        .reply-box { width: 100%; max-width: 800px; display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); border: 1px solid var(--border-color); border-bottom: none; border-radius: 16px 16px 0 0; padding: 12px 16px; margin-bottom: -16px; z-index: 5; box-shadow: 0 -4px 10px rgba(0,0,0,0.05); }
        .chat-input-bar { width: 100%; max-width: 800px; display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 99px; padding: 12px 20px; background: var(--bg-input); box-shadow: 0 4px 15px rgba(0,0,0,0.05); z-index: 10; position: relative; }
        .chat-input-bar.is-replying { border-radius: 0 0 16px 16px; }
        
        .chat-input-bar input { flex: 1; background: transparent; border: none; outline: none; color: var(--text-main); margin-left: 12px; font-size: 15px; }
        
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .modal-card { background: var(--bg-card); width: 100%; max-width: 400px; border-radius: 20px; border: 1px solid var(--border-color); overflow: hidden; display: flex; flex-direction: column; max-height: 85vh; }
        .modal-header { padding: 16px 20px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); color: var(--text-main); font-weight: bold; }
        .modal-body { padding: 20px; overflow-y: auto; color: var(--text-main); display: flex; flex-direction: column; gap: 16px;}
        
        .d-call-panel { background: var(--bg-input); border: 1px solid var(--border-color); margin: 12px 24px; padding: 12px 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }
        .d-action-btn { width: 40px; height: 40px; border-radius: 50%; border: none; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .pro-input { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); outline: none; font-size: 14px; }
        
        .lagoa-card-container { position: relative; background-color: var(--lagoa-card-bg); border: 1px solid var(--lagoa-border); border-radius: 16px; padding: 40px 24px 24px; max-width: 420px; width: 100%; text-align: center; margin-top: 50px; box-shadow: 0px 15px 40px rgba(0,0,0,0.3); }
        .lagoa-top-img { position: absolute; top: -45px; left: 50%; transform: translateX(-50%); width: 110px; z-index: 10; }
        .lagoa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .lagoa-btn { background: var(--lagoa-btn-bg); border: 1px solid rgba(255,255,255,0.2); border-radius: 99px; padding: 12px 4px; color: var(--lagoa-text); font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: var(--lagoa-btn-shadow); transition: all 0.2s ease; }
        .lagoa-btn:hover { transform: translateY(-2px); }
        .lagoa-btn.active { box-shadow: var(--lagoa-btn-shadow-active); border-color: rgba(0,0,0,0.05); background: rgba(0,0,0,0.02); font-weight: 800; }
        .lagoa-footer-text { font-size: 11px; color: var(--lagoa-text); line-height: 1.4; opacity: 0.8; margin: 0; }
        .lagoa-card-container p, .lagoa-card-container h2 { color: var(--lagoa-text) !important; }

        .hamburger-btn { display: none; background: transparent; border: none; color: var(--icon-color); font-size: 26px; cursor: pointer; padding: 0; margin-right: 16px; transition: transform 0.2s; }
        
        .search-spinner { 
          width: 60px; height: 60px; 
          border: 5px solid var(--border-color); 
          border-top-color: transparent !important; 
          border-radius: 50%; 
          animation: spin 1s linear infinite; 
          margin: 0 auto 20px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ========================================= */
        /* 📱 MOBILE RESPONSIVE (BOTTOM NAV BAR) 📱 */
        /* ========================================= */
        @media (max-width: 768px) {
          .app-layout { 
            display: block; 
          }
          .chat-icon-rail {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 60px;
            flex-direction: row;
            border-right: none;
            border-top: 1px solid var(--border-color);
            padding: 0;
            justify-content: space-evenly;
            background: var(--bg-card);
            z-index: 100;
          }
          .chat-main-area {
            position: absolute;
            top: 0;
            left: 0;
            height: 100dvh;
            width: 100%;
            padding-bottom: 60px;
            box-sizing: border-box;
          }
          .chat-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: calc(100dvh - 60px);
            width: 85vw;
            max-width: 320px;
            transform: translateX(-100%);
            z-index: 105;
            background: var(--bg-gradient);
            box-shadow: 5px 0 25px rgba(0,0,0,0.5);
          }
          .chat-sidebar.open {
            transform: translateX(0);
          }
          .hamburger-btn { display: block; }
          .menu-overlay.open { display: block; z-index: 100; }
          .sidebar-close-btn { display: block; }
          
          .chat-bubble-wrapper:hover .msg-dots-btn,
          .msg-dots-btn {
            opacity: 1; 
          }
          
          .lagoa-card-container {
            padding: 40px 16px 20px;
            margin-top: 30px;
            max-width: 90%;
          }
          .lagoa-btn {
            font-size: 12px;
            padding: 10px 4px;
          }
        }
      `}} />

      <div className="chat-icon-rail">
        <button className={`rail-btn ${abaChat === "grupos" ? "active" : ""}`} onClick={() => { setAbaChat("grupos"); setMenuAberto(true); }} title="Ninhos & Lagoa">
          <img src={duckImgSrc} alt="Pato" className="rail-btn-duck" />
        </button>
        <button className={`rail-btn ${abaChat === "amigos" ? "active" : ""}`} onClick={() => { setAbaChat("amigos"); setMenuAberto(true); }} title="Amigos">👥</button>
        <button className={`rail-btn ${abaChat === "config" ? "active" : ""}`} onClick={() => { setAbaChat("config"); setMenuAberto(true); }} title="Configurações">⚙️</button>
      </div>

      <div className={`chat-sidebar ${menuAberto ? 'open' : ''}`}>
        {abaChat === "grupos" && (
          <>
            <div className="sidebar-header-area">
              <h3 className="sidebar-title">Ninhos & Lagoas</h3>
              <button className="sidebar-close-btn" onClick={() => setMenuAberto(false)}>✖</button>
            </div>
            <div className="sidebar-scroll">
              <div className={`friend-item-btn ${isLagoa ? "active" : ""}`} onClick={() => { setAbaAtiva("lagoa"); setMenuAberto(false); setLagoaNaoLida(false); }}>
                <span style={{fontSize: '20px'}}>🌊</span> Lagoa Pública
                {lagoaNaoLida && <div className="status-dot online" style={{marginLeft: 'auto', backgroundColor: '#f43f5e'}}></div>}
              </div>
              {privados.map((chat) => (
                <div key={chat.id} className={`friend-item-btn ${abaAtiva === chat.id ? "active" : ""}`} onClick={() => { setAbaAtiva(chat.id); setMenuAberto(false); setPrivados(prev => prev.map(p => p.id === chat.id ? { ...p, naoLida: false } : p)); }}>
                  <span style={{fontSize: '20px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', overflow: 'hidden'}}>
                    {chat.icone && chat.icone.startsWith("data:") ? <img src={chat.icone} style={{width:'100%', height:'100%', objectFit: 'cover'}}/> : (chat.icone || "🔒")}
                  </span> 
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{chat.nomeCustom || "Ninho Privado"}</span>
                  {chat.naoLida && <div className="status-dot online" style={{marginLeft: 'auto', backgroundColor: '#f43f5e'}}></div>}
                </div>
              ))}
            </div>
          </>
        )}

        {abaChat === "amigos" && (
          <>
            <div className="sidebar-header-area">
              <h3 className="sidebar-title">Amigos</h3>
              <button className="sidebar-close-btn" onClick={() => setMenuAberto(false)}>✖</button>
            </div>
            
            <div className="sidebar-scroll">
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', padding: '6px', borderRadius: '16px', marginBottom: '20px', border: '1px solid var(--border-color)', gap: '4px' }}>
                <button onClick={() => setAbaAmigos('add')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', background: abaAmigos === 'add' ? 'var(--btn-blue-grad)' : 'transparent', color: abaAmigos === 'add' ? '#fff' : 'var(--text-main)', transition: '0.2s' }}>Add</button>
                <button onClick={() => setAbaAmigos('pending')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', background: abaAmigos === 'pending' ? 'var(--btn-blue-grad)' : 'transparent', color: abaAmigos === 'pending' ? '#fff' : 'var(--text-main)', transition: '0.2s' }}>Pendentes</button>
                <button onClick={() => setAbaAmigos('list')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', background: abaAmigos === 'list' ? 'var(--btn-blue-grad)' : 'transparent', color: abaAmigos === 'list' ? '#fff' : 'var(--text-main)', transition: '0.2s' }}>Lista</button>
              </div>

              {abaAmigos === 'add' ? (
                <form onSubmit={enviarConviteAmizade} style={{display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-input)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border-color)'}}>
                  <span style={{fontSize: '14px', color: 'var(--text-main)', fontWeight: 'bold', textAlign: 'center'}}>Convidar Novo Pato</span>
                  <input className="pro-input" value={amigoTagInput} onChange={(e) => setAmigoTagInput(e.target.value)} placeholder="Nome#Tag" required />
                  <button type="submit" style={{padding: '14px', background: 'var(--btn-blue-grad)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px'}}>Enviar Convite 🚀</button>
                  {amigoMensagem && <div style={{fontSize: '13px', color: 'var(--text-main)', marginTop: '8px', textAlign: 'center', background: 'rgba(0,0,0,0.05)', padding: '10px', borderRadius: '8px'}}>{amigoMensagem}</div>}
                </form>
              ) : abaAmigos === 'pending' ? (
                <div>
                  {listaPendentes.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>Nenhum convite pendente. 🦗</p>
                  ) : (
                    listaPendentes.map(req => (
                      <div key={req.id} style={{display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-input)', borderRadius: '16px', marginBottom: '12px', border: '1px solid var(--border-color)'}}>
                        <span style={{color: 'var(--text-main)', fontSize: '14px', display: 'flex', alignItems: 'center', fontWeight: 'bold'}}>{req.sender.name}</span>
                        <div style={{display: 'flex', gap: '8px'}}>
                          <button onClick={() => responderConviteAmizade(req.id, 'ACCEPT')} style={{background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '16px'}}>✓</button>
                          <button onClick={() => responderConviteAmizade(req.id, 'REJECT')} style={{background: '#f43f5e', color: '#fff', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '16px'}}>✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                listaAmigosAceitos.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>Você ainda não tem amigos. 🦆</p>
                ) : (
                  listaAmigosAceitos.map((amizade) => {
                    const amigo = amizade.senderId === meuIdBanco ? amizade.receiver : amizade.sender;
                    return (
                      <div key={amizade.id} className="friend-item-btn" onClick={() => iniciarChatComAmigo(amizade.id)}>
                        <div className="status-dot online"></div> {amigo.name}
                      </div>
                    );
                  })
                )
              )}
            </div>
          </>
        )}

        {abaChat === "config" && (
          <>
            <div className="sidebar-header-area">
              <h3 className="sidebar-title">Configurações</h3>
              <button className="sidebar-close-btn" onClick={() => setMenuAberto(false)}>✖</button>
            </div>
            <div className="sidebar-scroll" style={{ paddingBottom: '30px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                 <label className="pro-label">Nome de Exibição</label>
                 <input className="pro-input" value={meuNomeReal} onChange={e => setMeuNomeReal(e.target.value)} placeholder="Nome" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                 <label className="pro-label">Sua Tag</label>
                 <input className="pro-input" value={`#${minhaTag}`} disabled style={{opacity: 0.6}} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                 <label className="pro-label">Status / Bio</label>
                 <input className="pro-input" value={meuStatusBio} onChange={e => setMeuStatusBio(e.target.value)} placeholder="Status/Bio" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                 <label className="pro-label">Gênero</label>
                 <select className="pro-input" value={meuGenero} onChange={e => setMeuGenero(e.target.value)}>
                   <option value="prefiro-nao-dizer">Prefiro não dizer</option>
                   <option value="masculino">Masculino</option>
                   <option value="feminino">Feminino</option>
                   <option value="nao-binario">Não-Binário</option>
                 </select>
              </div>

              <button onClick={fecharModalPerfil} style={{padding: '16px', background: 'var(--btn-blue-grad)', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '24px'}}>
                Salvar Alterações
              </button>
              
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button onClick={toggleTheme} style={{padding: '16px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer'}}>
                  Tema: {isDark ? "Escuro 🌙" : "Claro ☀️"}
                </button>
                <button onClick={handleToggleNotificacoes} style={{padding: '16px', background: permiteNotificacoes ? '#10b981' : 'var(--bg-input)', color: permiteNotificacoes ? '#fff' : 'var(--text-main)', border: `1px solid ${permiteNotificacoes ? '#10b981' : 'var(--border-color)'}`, borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer'}}>
                  Notificações {permiteNotificacoes ? "ON ✅" : "OFF ❌"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="chat-main-area">
        <header className="chat-header">
          <div className="chat-header-user">
            <button className="hamburger-btn" onClick={() => setMenuAberto(!menuAberto)}>
              {menuAberto ? "✖" : "☰"}
            </button>
            <div className="chat-avatar" onClick={() => { if(!isLagoa && !ehChatDeAmigo) setEditandoNome(abaAtiva); }}>
              {isLagoa ? "🌊" : (chatAtivoData?.icone && chatAtivoData.icone.startsWith("data:") ? <img src={chatAtivoData.icone} style={{width:'100%', height:'100%', borderRadius:'50%'}}/> : (chatAtivoData?.icone || "👤"))}
            </div>
            
            {editandoNome === abaAtiva && !isLagoa && !ehChatDeAmigo ? (
              <div style={{display: 'flex', gap: '8px'}}>
                <input className="pro-input" value={nomePrivadoInput} onChange={e => setNomePrivadoInput(e.target.value)} style={{padding: '6px 10px'}} autoFocus onKeyDown={e => { if(e.key === 'Enter') { setPrivados(prev => prev.map(p => p.id === abaAtiva ? {...p, nomeCustom: nomePrivadoInput} : p)); setEditandoNome(null); } }} />
                <button onClick={() => { setPrivados(prev => prev.map(p => p.id === abaAtiva ? {...p, nomeCustom: nomePrivadoInput} : p)); setEditandoNome(null); }} style={{background: 'var(--btn-gold-grad)', color: '#000', border: 'none', borderRadius: '8px', padding: '0 12px'}}>OK</button>
              </div>
            ) : (
              <span className="chat-header-name">{isLagoa ? "Mergulho Anônimo" : (chatAtivoData?.nomeCustom || "Ninho Privado")}</span>
            )}
          </div>
          <div className="chat-icons">
            {!isLagoa && !chamadaAtiva && <span onClick={solicitarChamadaVoz}>📞</span>}
            {isLagoa && lagoaAtiva && <span onClick={solicitarPrivado} title="Mover p/ Privado">🔐</span>}
            {isLagoa && lagoaAtiva && <span onClick={sairDaLagoa} title="Sair" style={{color: '#f43f5e'}}>🚪</span>}
          </div>
        </header>

        {((isLagoa && lagoaAtiva) || !isLagoa) && statusConvite && (
          <div style={{ 
            position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
            background: "var(--btn-blue-grad)", border: "1px solid var(--border-color)", color: "#fff", 
            padding: "12px 24px", textAlign: "center", borderRadius: "99px", zIndex: 999,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: '16px',
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
          }}>
            <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{statusConvite}</span>
            {!isLagoa && statusConvite.includes("Chamando") && (
               <button onClick={desligarChamada} style={{ background: "#f43f5e", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "99px", fontWeight: 'bold', cursor: "pointer" }}>Desligar ✖</button>
            )}
          </div>
        )}

        {isLagoa && !lagoaAtiva && !procurando && !lagoaPendente && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            
            <div className="lagoa-card-container">
              <img src={lagoImgSrc} alt="Lagoa" className="lagoa-top-img" />
              
              <p style={{ fontSize: '15px', marginBottom: '32px', fontWeight: '500' }}>
                Selecione que tipo de pessoa deseja encontrar na lagoa.
              </p>
              
              <div className="lagoa-grid">
                {[
                  { label: 'Homens', val: 'masculino' },
                  { label: 'Mulheres', val: 'feminino' },
                  { label: 'Não Binários', val: 'nao-binario' },
                  { label: 'Transgêneros', val: 'transgenero' },
                  { label: 'Gênero Fluido', val: 'genero-fluido' },
                  { label: 'Qualquer pessoa', val: 'qualquer' }
                ].map(item => (
                  <button 
                    key={item.val} 
                    className={`lagoa-btn ${preferenciasGenero.includes(item.val) ? 'active' : ''}`} 
                    onClick={() => togglePreferencia(item.val)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <p className="lagoa-footer-text">
                Caso tenha selecionado "prefiro não informar" você será encontrado como<br/>"qualquer pessoa".
              </p>
            </div>

            <button onClick={procurarPato} style={{ marginTop: '24px', padding: '16px 40px', background: 'var(--btn-blue-grad)', color: '#fff', border: 'none', borderRadius: '99px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              MERGULHAR 🚀
            </button>
          </div>
        )}

        {isLagoa && procurando && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="search-spinner"></div>
            <h3 style={{color: 'var(--text-main)', margin: '0 0 20px 0'}}>Procurando patos...</h3>
            <button onClick={cancelarBusca} style={{ background: 'var(--bg-input)', color: '#f43f5e', border: '1px solid #f43f5e', padding: '10px 30px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
          </div>
        )}

        {isLagoa && lagoaPendente && !lagoaAtiva && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h2 style={{color: 'var(--text-main)'}}>Pato Encontrado!</h2>
            <div style={{ background: 'var(--bg-input)', padding: '6px 16px', borderRadius: '20px', border: '1px solid var(--border-color)', color: 'var(--icon-color)', fontWeight: 'bold', margin: '16px 0' }}>Confirmados: {confirmados}/2</div>
            <div style={{display: 'flex', gap: '12px', marginTop: '10px'}}>
              <button onClick={aceitarConexao} disabled={jaAceitou} style={{background: jaAceitou ? '#10b981' : 'var(--btn-blue-grad)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer'}}>
                {jaAceitou ? "Aguardando..." : "Conectar 💚"}
              </button>
              <button onClick={recusarConexao} style={{background: 'var(--bg-input)', border: '1px solid #f43f5e', color: '#f43f5e', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer'}}>Pular ❌</button>
            </div>
          </div>
        )}

        <div className="chat-messages">
          {chamadaAtiva && (
            <div className="d-call-panel">
              <span style={{color: 'var(--text-main)', fontWeight: 'bold'}}>📞 Voz Conectada</span>
              <div style={{display: 'flex', gap: '12px'}}>
                <button onClick={alternarMuteMicrofone} className="d-action-btn" style={{background: microfoneMutado ? '#f43f5e' : 'var(--bg-input)', color: microfoneMutado ? '#fff' : 'var(--text-main)', border: '1px solid var(--border-color)'}}>{microfoneMutado ? "🔇" : "🎙️"}</button>
                <button onClick={desligarChamada} className="d-action-btn" style={{background: '#f43f5e', color: '#fff', width: 'auto', padding: '0 16px', borderRadius: '24px'}}>Desligar ☎️</button>
              </div>
            </div>
          )}
          {chamadaRecebida && !chamadaAtiva && (
            <div className="d-call-panel" style={{borderColor: '#10b981'}}>
              <span style={{color: '#10b981', fontWeight: 'bold'}}>📞 Recebendo Ligação...</span>
              <div style={{display: 'flex', gap: '12px'}}>
                <button onClick={atenderChamadaVoz} className="d-action-btn" style={{background: '#10b981', color: '#fff'}}>✓</button>
                <button onClick={recusarChamadaVoz} className="d-action-btn" style={{background: '#f43f5e', color: '#fff'}}>✕</button>
              </div>
            </div>
          )}
          
          {((isLagoa && lagoaAtiva) || !isLagoa) && msgsAtuais.map(msg => {
            const eMinha = msg.usuario === (isLagoa ? meuNomeAnon : `${meuNomeReal}#${minhaTag}`);
            const eSistema = msg.usuario.includes("SISTEMA");

            let nomeLimpo = msg.usuario;
            if (nomeLimpo.includes("data:image")) {
              const match = nomeLimpo.match(/([a-zA-Z0-9_ -]+#\d{4})/);
              if (match) nomeLimpo = match[1];
              else nomeLimpo = nomeLimpo.split(" ").pop() || "Pato";
            }
            nomeLimpo = nomeLimpo.replace(/^[^\w\s]+/, '').trim();

            let avatarMsg = "🦆";
            if (isLagoa) {
              avatarMsg = eSistema ? "🤖" : "🎭";
            } else {
              if (eSistema) avatarMsg = "🤖";
              else if (eMinha) avatarMsg = meuAvatar;
              else avatarMsg = chatAtivoData?.amigoRef?.avatar || chatAtivoData?.icone || "🦆";
            }

            const isReply = msg.mensagem.startsWith("[Respondendo");
            let replyInfo = null;
            let msgContent = msg.mensagem;
            if (isReply) {
              const match = msg.mensagem.match(/\[Respondendo (.*?): (.*?)\]\n\n([\s\S]*)/);
              if (match) {
                replyInfo = { user: match[1], text: match[2] };
                msgContent = match[3];
              }
            }

            return (
              <div key={msg.id} className="chat-bubble-wrapper" style={{ 
                flexDirection: eMinha && !eSistema ? 'row-reverse' : 'row',
                justifyContent: eSistema ? 'center' : 'flex-start' 
              }}>
                
                {!eSistema && (
                  <div 
                    onClick={() => { if(!eMinha && chatAtivoData?.amigoRef) setPerfilAmigoSelecionado(chatAtivoData.amigoRef); }}
                    style={{ 
                      width: '36px', height: '36px', borderRadius: '50%', background: 'transparent', border: '1px solid var(--border-color)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, overflow: 'hidden', 
                      cursor: !eMinha && chatAtivoData?.amigoRef ? 'pointer' : 'default' 
                    }}
                  >
                    {avatarMsg.startsWith("data:image/") ? (
                      <img src={avatarMsg} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      avatarMsg
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: eMinha ? 'row-reverse' : 'row', alignItems: 'center', gap: '8px', maxWidth: '75%' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: eMinha && !eSistema ? 'flex-end' : 'flex-start' }}>
                    {!eMinha && !eSistema && <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', opacity: 0.7 }}>{nomeLimpo}</div>}
                    
                    <div className={`chat-bubble ${eMinha ? 'me' : 'other'}`} style={{ 
                      background: eSistema ? 'var(--bg-input)' : (eMinha ? 'var(--bubble-me)' : 'var(--bubble-other)'), 
                      color: eSistema ? 'var(--text-main)' : (eMinha ? (isDark ? '#fff' : 'var(--text-main)') : 'var(--text-main)'), 
                      borderRadius: eMinha ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                      border: eSistema ? '1px solid var(--border-color)' : '' 
                    }}>
                      
                      {replyInfo && (
                        <div style={{ 
                          background: 'rgba(0,0,0,0.1)', 
                          borderLeft: '4px solid var(--icon-color)', 
                          padding: '6px 10px', 
                          borderRadius: '4px', 
                          marginBottom: '8px',
                          fontSize: '12px'
                        }}>
                          <span style={{ fontWeight: 'bold', display: 'block', color: eMinha && isDark ? '#fff' : 'var(--icon-color)' }}>{replyInfo.user}</span>
                          <span style={{ opacity: 0.8 }}>{replyInfo.text}</span>
                        </div>
                      )}

                      {msgContent}
                      
                      {msg.imagem && <img src={msg.imagem} alt="Mídia" style={{maxWidth: '100%', borderRadius: '8px', marginTop: '8px'}}/>}
                      {msg.audio && <audio src={msg.audio} controls style={{marginTop: '8px', width: '100%'}}/>}
                      <div style={{fontSize: '10px', textAlign: 'right', marginTop: '4px', opacity: 0.5}}>{msg.hora}</div>
                    </div>
                  </div>

                  {!eSistema && (
                    <div className="msg-options-container" onClick={(e) => e.stopPropagation()}>
                      <button className="msg-dots-btn" onClick={() => setMenuMensagemAberto(menuMensagemAberto === msg.id ? null : msg.id)}>⋮</button>
                      
                      {menuMensagemAberto === msg.id && (
                        <div className="msg-dropdown" style={eMinha ? { right: '100%', marginRight: '8px', bottom: '0' } : { left: '100%', marginLeft: '8px', bottom: '0' }}>
                          
                          <button className="msg-dropdown-btn" onClick={() => { 
                            setRespondendoA({ id: msg.id, usuario: nomeLimpo, texto: msgContent });
                            setMenuMensagemAberto(null); 
                          }}>
                            ↩ Responder
                          </button>
                          
                          {eMinha && (
                            <button className="msg-dropdown-btn" onClick={() => { 
                              setTexto(msgContent); 
                              apagarMensagem(msg.id); 
                              setMenuMensagemAberto(null); 
                            }}>
                              ✏️ Editar
                            </button>
                          )}
                          
                          {eMinha && (
                            <button className="msg-dropdown-btn danger" onClick={() => { 
                              apagarMensagem(msg.id); 
                              setMenuMensagemAberto(null); 
                            }}>
                              🗑️ Apagar
                            </button>
                          )}
                          
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {((isLagoa && lagoaAtiva) || !isLagoa) && (
          <div className="chat-input-area">
            {imagemBase64 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: '16px', marginBottom: '12px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '800px' }}>
                <img src={imagemBase64} style={{ height: '40px', borderRadius: '4px' }} />
                <span onClick={() => setImagemBase64(null)} style={{ cursor: 'pointer', color: '#f43f5e', fontWeight: 'bold', marginLeft: 'auto' }}>✕ Remover Foto</span>
              </div>
            )}
            
            {respondendoA && (
              <div className="reply-box">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--icon-color)' }}>Respondendo {respondendoA.usuario}:</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{respondendoA.texto.substring(0, 50)}{respondendoA.texto.length > 50 ? '...' : ''}</span>
                </div>
                <button onClick={() => setRespondendoA(null)} style={{ background: 'transparent', border: 'none', color: '#f43f5e', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
            )}

            <form onSubmit={enviarMensagem} className={`chat-input-bar ${respondendoA ? 'is-replying' : ''}`}>
              <label style={{ cursor: 'pointer', color: 'var(--icon-color)', marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                📎 <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </label>
              <button type="button" onClick={alternarGravacaoAudioMsg} style={{ background: 'transparent', border: 'none', color: gravandoAudioMsg ? '#f43f5e' : 'var(--icon-color)', fontSize: '18px', cursor: 'pointer', padding: 0 }}>
                {gravandoAudioMsg ? "🛑" : "🎙️"}
              </button>
              <input type="text" placeholder={gravandoAudioMsg ? "Gravando áudio..." : "Digite uma mensagem..."} value={texto} onChange={e => setTexto(e.target.value)} disabled={gravandoAudioMsg} />
              <button type="submit" style={{ background: 'transparent', border: 'none', color: 'var(--icon-color)', fontSize: '20px', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>➤</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}