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
  mensagens: Mensagem[];
}

export default function ChatPage() {
  const { data: session } = useSession();
  
  const [meuNomeReal, setMeuNomeReal] = useState<string>("");
  const [meuStatusBio, setMeuStatusBio] = useState<string>("Nadando nas águas profundas...");
  const [meuAvatar, setMeuAvatar] = useState<string>("🦆");
  const [modalPerfilAberto, setModalPerfilAberto] = useState<boolean>(false);

  // ESTADOS DE ÁUDIO E REFS
  const [sensibilidade, setSensibilidade] = useState<number>(30);
  const sensibilidadeRef = useRef<number>(30);
  
  const [volumeEntrada, setVolumeEntrada] = useState<number>(100);
  const volumeEntradaRef = useRef<number>(100);

  const [volumeSaida, setVolumeSaida] = useState<number>(100);
  
  const [microfoneMutado, setMicrofoneMutado] = useState<boolean>(false);
  const microfoneMutadoRef = useRef<boolean>(false);

  const [audioMutado, setAudioMutado] = useState<boolean>(false);
  const [testandoMic, setTestandoMic] = useState<boolean>(false);
  
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);
  const testAudioContextRef = useRef<AudioContext | null>(null);

  const inputGainNodeRef = useRef<GainNode | null>(null);
  const testInputGainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => { sensibilidadeRef.current = sensibilidade; }, [sensibilidade]);
  useEffect(() => { volumeEntradaRef.current = volumeEntrada; }, [volumeEntrada]);
  useEffect(() => { microfoneMutadoRef.current = microfoneMutado; }, [microfoneMutado]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = audioMutado;
    }
  }, [audioMutado]);

  useEffect(() => {
    const val = volumeEntrada / 100;
    if (inputGainNodeRef.current && audioContextRef.current) {
      inputGainNodeRef.current.gain.setTargetAtTime(val, audioContextRef.current.currentTime, 0.1);
    }
    if (testInputGainNodeRef.current && testAudioContextRef.current) {
      testInputGainNodeRef.current.gain.setTargetAtTime(val, testAudioContextRef.current.currentTime, 0.1);
    }
  }, [volumeEntrada]);
  
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = volumeSaida / 100;
    }
    if (testAudioRef.current) {
      testAudioRef.current.volume = volumeSaida / 100;
    }
  }, [volumeSaida]);

  useEffect(() => {
    if (session?.user) {
      setMeuNomeReal(session.user.name || session.user.email?.split("@")[0] || "Pato Verificado");
    }
  }, [session]);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const ringtoneCtxRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const testAnimationFrameRef = useRef<number | null>(null);

  const [abaAtiva, setAbaAtiva] = useState<string>("lagoa");
  const abaAtivaRef = useRef<string>("lagoa");
  useEffect(() => { abaAtivaRef.current = abaAtiva; }, [abaAtiva]);

  const [lagoaId, setLagoaId] = useState<string | null>(null);
  const lagoaIdRef = useRef<string | null>(null);
  useEffect(() => { lagoaIdRef.current = lagoaId; }, [lagoaId]);

  const [lagoaPendente, setLagoaPendente] = useState<string | null>(null);
  const [lagoaAtiva, setLagoaAtiva] = useState<boolean>(false);
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

  const [texto, setTexto] = useState("");
  const [imagemBase64, setImagemBase64] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ======= RINGTONES =======
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
    if (ringtoneCtxRef.current && ringtoneCtxRef.current.state !== "closed") {
      ringtoneCtxRef.current.close();
    }
    ringtoneIntervalRef.current = null;
    ringtoneCtxRef.current = null;
  };

  // ======= MOTOR DE ÁUDIO =======
  const capturarAudioFiltroSupremo = async (isTest = false): Promise<MediaStream> => {
    const webrtcConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      sampleRate: 48000,
      channelCount: 1,
      ...({
        googEchoCancellation: true,
        googNoiseSuppression: true,
        googHighpassFilter: true,
        googTypingNoiseDetection: true
      } as any)
    };

    const rawStream = await navigator.mediaDevices.getUserMedia({ audio: webrtcConstraints });

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (isTest) testAudioContextRef.current = audioCtx;
      else audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(rawStream);

      const inputGainNode = audioCtx.createGain();
      inputGainNode.gain.value = volumeEntradaRef.current / 100;
      if (isTest) testInputGainNodeRef.current = inputGainNode;
      else inputGainNodeRef.current = inputGainNode;

      const hp1 = audioCtx.createBiquadFilter(); hp1.type = "highpass"; hp1.frequency.value = 180;
      const hp2 = audioCtx.createBiquadFilter(); hp2.type = "highpass"; hp2.frequency.value = 180;
      const hp3 = audioCtx.createBiquadFilter(); hp3.type = "highpass"; hp3.frequency.value = 180;

      const lp = audioCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000;

      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-15, audioCtx.currentTime);
      compressor.knee.setValueAtTime(0, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(15, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.001, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.1, audioCtx.currentTime);

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      analyser.minDecibels = -90; 
      analyser.maxDecibels = -10; 

      const gateNode = audioCtx.createGain();
      gateNode.gain.value = 0; 

      const destination = audioCtx.createMediaStreamDestination();

      source.connect(inputGainNode);
      inputGainNode.connect(hp1);
      hp1.connect(hp2);
      hp2.connect(hp3);
      hp3.connect(lp);
      lp.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(gateNode);
      gateNode.connect(destination);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      let holdTimer = 0;
      let isGateOpen = false;

      const checkAudioLevel = () => {
        const currentCtx = isTest ? testAudioContextRef.current : audioContextRef.current;
        if (!currentCtx || currentCtx.state === "closed") return;
        
        analyser.getByteFrequencyData(dataArray);
        
        let maxVolume = 0;
        for (let i = 3; i < 35; i++) {
          if (dataArray[i] > maxVolume) {
            maxVolume = dataArray[i];
          }
        }
        
        const volumeAtual = (maxVolume / 255) * 100;

        if (isTest || (!isTest && !testandoMic)) {
          const barVisual = document.getElementById("volume-bar-visual");
          if (barVisual) {
            barVisual.style.width = `${volumeAtual}%`;
            barVisual.style.backgroundColor = volumeAtual > sensibilidadeRef.current ? "#10b981" : "#f43f5e"; 
          }
        }

        const passouSensibilidade = volumeAtual > sensibilidadeRef.current;
        const usuarioMutadoManual = microfoneMutadoRef.current && !isTest; 

        if (passouSensibilidade && !usuarioMutadoManual) {
          holdTimer = 25; 
          if (!isGateOpen) {
            isGateOpen = true;
            gateNode.gain.cancelScheduledValues(currentCtx.currentTime);
            gateNode.gain.setValueAtTime(gateNode.gain.value, currentCtx.currentTime);
            gateNode.gain.linearRampToValueAtTime(1, currentCtx.currentTime + 0.05); 
          }
        } else {
          if (holdTimer > 0 && !usuarioMutadoManual) {
            holdTimer--; 
          } else if (isGateOpen) {
            isGateOpen = false;
            gateNode.gain.cancelScheduledValues(currentCtx.currentTime);
            gateNode.gain.setValueAtTime(gateNode.gain.value, currentCtx.currentTime);
            gateNode.gain.linearRampToValueAtTime(0, currentCtx.currentTime + 0.1); 
          }
        }

        if (isTest) {
          testAnimationFrameRef.current = requestAnimationFrame(checkAudioLevel);
        } else {
          animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
        }
      };

      checkAudioLevel();
      return destination.stream;

    } catch (e) {
      console.warn("Filtro Supremo falhou.", e);
      return rawStream;
    }
  };

  const alternarTesteMic = async () => {
    if (testandoMic) {
      pararTesteMic();
    } else {
      try {
        const stream = await capturarAudioFiltroSupremo(true);
        testStreamRef.current = stream;
        if (testAudioRef.current) {
          testAudioRef.current.srcObject = stream;
          testAudioRef.current.volume = volumeSaida / 100;
        }
        setTestandoMic(true);
      } catch (err) {
        alert("Permissão de microfone negada para o teste.");
      }
    }
  };

  const pararTesteMic = () => {
    if (testAnimationFrameRef.current) {
      cancelAnimationFrame(testAnimationFrameRef.current);
      testAnimationFrameRef.current = null;
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(t => t.stop());
      testStreamRef.current = null;
    }
    if (testAudioContextRef.current) {
      testAudioContextRef.current.close();
      testAudioContextRef.current = null;
    }
    if (testAudioRef.current) {
      testAudioRef.current.srcObject = null;
    }
    setTestandoMic(false);
    
    if (!chamadaAtiva) {
      const barVisual = document.getElementById("volume-bar-visual");
      if (barVisual) barVisual.style.width = "0%";
    }
  };

  const fecharModalPerfil = () => {
    pararTesteMic();
    setModalPerfilAberto(false);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("duckzone_ninhos_privados", JSON.stringify(privados));
    }
  }, [privados]);

  // ======= SOCKET CONEXÃO ÚNICA (SEM RE-TRIGGER POR ABA OU LAGOAID) =======
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    privados.forEach((chat) => {
      socket.emit("entrar_sala_privada", { novaSalaPrivada: chat.id });
    });

    socket.on("aguardando_parceiro", () => {
      setProcurando(true);
      setLagoaPendente(null);
      setLagoaAtiva(false);
      setConfirmados(0);
      setJaAceitou(false);
    });

    socket.on("parceiro_encontrado", (data) => {
      setProcurando(false);
      setLagoaId(data.salaId);
      setLagoaPendente(data.salaId);
      setMeuNomeAnon(data.meuNome);
      setParceiroNomeAnon(data.parceiroNome);
      setLagoaAtiva(false);
      setConfirmados(0);
      setJaAceitou(false);
    });

    socket.on("atualizar_confirmacao", (data: { confirmados: number }) => {
      setConfirmados(data.confirmados);
    });

    socket.on("conexao_confirmada", (data: { salaId: string }) => {
      setLagoaId(data.salaId);
      setLagoaAtiva(true);
      setLagoaPendente(null);
      setLagoaMensagens([]);
      setConfirmados(2);
    });

    socket.on("receber_mensagem", (data: Mensagem & { salaId: string }) => {
      const novaMsg = { id: data.id, usuario: data.usuario, mensagem: data.mensagem, imagem: data.imagem, audio: data.audio, hora: data.hora };
      if (data.salaId.startsWith("ninho_")) {
        setPrivados((prev) => prev.map(chat => 
          chat.id === data.salaId ? { ...chat, mensagens: [...chat.mensagens, novaMsg] } : chat
        ));
      } else {
        setLagoaMensagens((prev) => [...prev, novaMsg]);
      }
    });

    socket.on("mensagem_apagada", (data: { salaId: string; msgId: string }) => {
      if (data.salaId.startsWith("ninho_")) {
        setPrivados((prev) => prev.map(chat => 
          chat.id === data.salaId ? { ...chat, mensagens: chat.mensagens.filter(m => m.id !== data.msgId) } : chat
        ));
      } else {
        setLagoaMensagens((prev) => prev.filter(m => m.id !== data.msgId));
      }
    });

    socket.on("recebeu_chamada_voz", () => {
      setChamadaRecebida(true);
      tocarRingtone('recebendo');
    });

    socket.on("chamada_voz_aceita_pelo_parceiro", async () => {
      pararRingtone();
      setChamadaAtiva(true);
      setStatusConvite(null);
      await enviarOfertaWebRTC();
    });

    socket.on("webrtc_offer", async (data: { offer: RTCSessionDescriptionInit }) => {
      try {
        const pc = obterOuCriarPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const salaAlvo = abaAtivaRef.current !== "lagoa" ? abaAtivaRef.current : lagoaIdRef.current;
        socketRef.current?.emit("webrtc_answer", { salaId: salaAlvo, answer });
        setChamadaAtiva(true);
      } catch (err) {
        console.error("Erro ao processar oferta:", err);
      }
    });

    socket.on("webrtc_answer", async (data: { answer: RTCSessionDescriptionInit }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setChamadaAtiva(true);
      }
    });

    socket.on("webrtc_ice_candidate", async (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {}
      }
    });

    socket.on("chamada_voz_recusada", () => {
      pararRingtone();
      alert("O outro pato recusou a chamada.");
      encerrarChamadaLocal();
    });

    socket.on("chamada_voz_encerrada", () => {
      pararRingtone();
      encerrarChamadaLocal();
    });

    socket.on("recebeu_convite_privado", (data) => {
      setConvitePendente(data.solicitante);
      setStatusConvite(null);
    });

    socket.on("migrar_para_privado", (data) => {
      const novaId = data.novaSalaPrivada;
      socket.emit("entrar_sala_privada", { novaSalaPrivada: novaId });

      setPrivados((prev) => {
        if (prev.some(p => p.id === novaId)) return prev;
        return [
          ...prev, 
          {
            id: novaId,
            mensagens: [{
              id: `sys_${Date.now()}`,
              usuario: "SISTEMA 🔒",
              mensagem: `Vocês entraram em um Ninho Privado! Suas identidades foram reveladas.`,
              hora: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }]
          }
        ];
      });

      setAbaAtiva(novaId);
      setLagoaAtiva(false);
      setConvitePendente(null);
      setStatusConvite(null);
    });

    socket.on("convite_privado_recusado", () => {
      setStatusConvite("O outro pato recusou o convite.");
      setTimeout(() => setStatusConvite(null), 3000);
    });

    socket.on("parceiro_desconectou", () => {
      pararRingtone();
      setLagoaAtiva(false);
      setLagoaId(null);
      setLagoaPendente(null);
      setProcurando(false);
      setJaAceitou(false);
      setConfirmados(0);
      encerrarChamadaLocal();
    });

    return () => {
      pararRingtone();
      pararTesteMic();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lagoaMensagens, privados, abaAtiva]);

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
        const salaAlvo = abaAtiva !== "lagoa" ? abaAtiva : lagoaId;
        socketRef.current?.emit("webrtc_ice_candidate", { salaId: salaAlvo, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteAudioRef.current && e.streams[0]) {
        remoteAudioRef.current.srcObject = e.streams[0];
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const solicitarChamadaVoz = () => {
    const salaAlvo = abaAtiva !== "lagoa" ? abaAtiva : lagoaId;
    if (!salaAlvo) return;

    socketRef.current?.emit("iniciar_chamada_voz", { salaId: salaAlvo });
    setStatusConvite("Chamando Pato... 📞");
    tocarRingtone('chamando');
  };

  const atenderChamadaVoz = async () => {
    pararRingtone();
    const salaAlvo = abaAtiva !== "lagoa" ? abaAtiva : lagoaId;
    if (!salaAlvo) return;

    try {
      const stream = await capturarAudioFiltroSupremo(false);
      localStreamRef.current = stream;

      const pc = obterOuCriarPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      socketRef.current?.emit("aceitar_chamada_voz", { salaId: salaAlvo });
      setChamadaRecebida(false);
      setChamadaAtiva(true);
    } catch {
      alert("Microfone não encontrado ou permissão negada.");
    }
  };

  const enviarOfertaWebRTC = async () => {
    const salaAlvo = abaAtiva !== "lagoa" ? abaAtiva : lagoaId;
    if (!salaAlvo) return;

    try {
      const stream = await capturarAudioFiltroSupremo(false);
      localStreamRef.current = stream;

      const pc = obterOuCriarPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current?.emit("webrtc_offer", { salaId: salaAlvo, offer });
    } catch {
      alert("Microfone não encontrado ou permissão negada.");
    }
  };

  const recusarChamadaVoz = () => {
    pararRingtone();
    const salaAlvo = abaAtiva !== "lagoa" ? abaAtiva : lagoaId;
    if (salaAlvo) socketRef.current?.emit("recusar_chamada_voz", { salaId: salaAlvo });
    setChamadaRecebida(false);
  };

  const alternarMuteMicrofone = () => {
    setMicrofoneMutado((prev) => {
      const novo = !prev;
      if (!novo && audioMutado) {
        setAudioMutado(false);
      }
      return novo;
    });
  };

  const alternarAudioMutado = () => {
    setAudioMutado((prev) => {
      const novo = !prev;
      if (novo) {
        setMicrofoneMutado(true);
      }
      return novo;
    });
  };

  const encerrarChamadaLocal = () => {
    pararRingtone();
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setChamadaAtiva(false);
    setChamadaRecebida(false);
    setMicrofoneMutado(false);
    setAudioMutado(false);
    setStatusConvite(null);
    
    const barVisual = document.getElementById("volume-bar-visual");
    if (barVisual && !testandoMic) barVisual.style.width = "0%";
  };

  const desligarChamada = () => {
    pararRingtone();
    const salaAlvo = abaAtiva !== "lagoa" ? abaAtiva : lagoaId;
    if (salaAlvo) socketRef.current?.emit("encerrar_chamada_voz", { salaId: salaAlvo });
    encerrarChamadaLocal();
  };

  const alternarGravacaoAudioMsg = async () => {
    if (gravandoAudioMsg) {
      msgMediaRecorderRef.current?.stop();
      setGravandoAudioMsg(false);
    } else {
      try {
        const stream = await capturarAudioFiltroSupremo(false);

        const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 128000 }
          : undefined;

        const recorder = new MediaRecorder(stream, options);
        msgMediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

        recorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => enviarAudioMsg(reader.result as string);
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach((track) => track.stop());
        };

        recorder.start();
        setGravandoAudioMsg(true);
      } catch {
        alert("Permissão de microfone negada.");
      }
    }
  };

  const enviarAudioMsg = (audioBase64: string) => {
    const isPrivado = abaAtiva !== "lagoa";
    const salaAlvo = isPrivado ? abaAtiva : lagoaId;
    if (!salaAlvo) return;

    const remetente = isPrivado ? `${meuAvatar} ${meuNomeReal}` : meuNomeAnon;

    socketRef.current?.emit("enviar_mensagem", {
      salaId: salaAlvo,
      remetenteNome: remetente,
      mensagem: "🎤 Mensagem de áudio",
      audio: audioBase64
    });
  };

  const procurarPato = () => { setProcurando(true); socketRef.current?.emit("procurar_parceiro"); };
  
  // CORREÇÃO CRÍTICA DO ACEITE DE CONEXÃO
  const aceitarConexao = () => { 
    if (lagoaPendente && !jaAceitou) { 
      setJaAceitou(true); 
      socketRef.current?.emit("confirmar_conexao", { salaId: lagoaPendente }); 
    } 
  };
  
  const recusarConexao = () => { setLagoaPendente(null); setJaAceitou(false); setConfirmados(0); procurarPato(); };
  
  const solicitarPrivado = () => { if (!lagoaId) return; setStatusConvite("Convite enviado! Aguardando..."); socketRef.current?.emit("solicitar_chat_privado", { salaId: lagoaId, meuNome: meuNomeAnon }); };
  const responderConvite = (aceito: boolean) => { if (!lagoaId) return; socketRef.current?.emit("responder_convite_privado", { salaId: lagoaId, aceito }); setConvitePendente(null); };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = Math.min(img.width, MAX_WIDTH);
          canvas.height = img.height * (img.width > MAX_WIDTH ? scaleSize : 1);

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          setImagemBase64(canvas.toDataURL("image/jpeg", 0.7));
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const apagarMensagem = (msgId: string) => {
    const isPrivado = abaAtiva !== "lagoa";
    const salaAlvo = isPrivado ? abaAtiva : lagoaId;
    if (!salaAlvo) return;
    socketRef.current?.emit("apagar_mensagem", { salaId: salaAlvo, msgId });
  };

  const enviarMensagem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim() && !imagemBase64) return;

    const isPrivado = abaAtiva !== "lagoa";
    const salaAlvo = isPrivado ? abaAtiva : lagoaId;
    if (!salaAlvo) return;

    const remetente = isPrivado ? `${meuAvatar} ${meuNomeReal}` : meuNomeAnon;

    socketRef.current?.emit("enviar_mensagem", {
      salaId: salaAlvo,
      remetenteNome: remetente,
      mensagem: texto,
      imagem: isPrivado ? imagemBase64 : null
    });

    setTexto("");
    setImagemBase64(null);
  };

  const isLagoa = abaAtiva === "lagoa";
  const msgsAtuais = isLagoa ? lagoaMensagens : privados.find(p => p.id === abaAtiva)?.mensagens || [];

  return (
    <div className="app-layout">
      {/* REPRODUTORES DE ÁUDIO INVISÍVEIS */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      <audio ref={testAudioRef} autoPlay muted={false} style={{ display: 'none' }} />

      {/* ESTILOS CUSTOMIZADOS PARA O MODAL E PAINEL DISCORD */}
      <style dangerouslySetInnerHTML={{__html: `
        .discord-slider {
          -webkit-appearance: none;
          width: 100%;
          background: transparent;
        }
        .discord-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: #fff;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 5px rgba(0,0,0,0.5);
          margin-top: -5px;
          transition: transform 0.1s;
        }
        .discord-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        .discord-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: 6px;
          cursor: pointer;
          background: transparent;
        }

        .discord-call-panel-v2 {
          background-color: #111214;
          border: 1px solid #1e1f22;
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .d-call-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .d-call-dot {
          width: 12px;
          height: 12px;
          background-color: #23a559;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(35, 165, 89, 0.6);
          animation: pulse-green 2s infinite;
        }
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(35, 165, 89, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(35, 165, 89, 0); }
          100% { box-shadow: 0 0 0 0 rgba(35, 165, 89, 0); }
        }
        .d-call-text {
          display: flex;
          flex-direction: column;
        }
        .d-call-title {
          color: #23a559;
          font-weight: 700;
          font-size: 14px;
        }
        .d-call-subtitle {
          color: #949ba4;
          font-size: 12px;
          font-weight: 500;
        }
        .d-call-actions {
          display: flex;
          gap: 12px;
        }
        .d-action-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #2b2d31;
          border: 1px solid transparent;
          color: #dbdee1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }
        .d-action-btn:hover {
          background-color: #313338;
          transform: translateY(-2px);
          border-color: #dbdee1;
        }
        .d-action-btn.btn-muted {
          background-color: #da373c;
          color: #fff;
        }
        .d-action-btn.btn-muted:hover {
          background-color: #c93035;
          border-color: transparent;
        }
        .d-action-btn.btn-disconnect {
          background-color: #da373c;
          color: #fff;
          border-radius: 24px;
          width: auto;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 700;
          gap: 8px;
        }
        .d-action-btn.btn-disconnect:hover {
          background-color: #c93035;
          border-color: transparent;
        }

        .d-action-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: -34px;
          background: #111214;
          color: #dbdee1;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
          box-shadow: 0 4px 8px rgba(0,0,0,0.5);
          z-index: 100;
        }
        .d-action-btn:hover::after {
          opacity: 1;
        }

        .pro-input {
          width: 100%;
          background: #121e24;
          border: 1px solid #1f2d35;
          color: #fff;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
        }
        .pro-input:focus {
          border-color: #2dd4bf;
          box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
        }
        .pro-label {
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }
        .avatar-btn {
          font-size: 26px;
          padding: 10px;
          border-radius: 14px;
          cursor: pointer;
          background: #121e24;
          border: 1px solid #1f2d35;
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .avatar-btn:hover {
          background: #1a2830;
          transform: translateY(-2px);
        }
        .avatar-btn.active {
          background: rgba(45, 212, 191, 0.15);
          border-color: #2dd4bf;
          box-shadow: 0 4px 15px rgba(45, 212, 191, 0.2);
          transform: scale(1.05);
        }
        .btn-test-mic {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 800;
          font-size: 14px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #1f2d35;
          background: #121e24;
          color: #f43f5e;
        }
        .btn-test-mic:hover {
          background: rgba(244, 63, 94, 0.05);
          border-color: rgba(244, 63, 94, 0.5);
        }
        .btn-test-mic.active {
          border-color: #f43f5e;
          background: rgba(244, 63, 94, 0.1);
          color: #f43f5e;
          animation: pulse-border 2s infinite;
        }
        .modal-body::-webkit-scrollbar { width: 6px; }
        .modal-body::-webkit-scrollbar-thumb { background: #1f2d35; border-radius: 10px; }
      `}} />

      {/* SIDEBAR INSTAGRAM DIRECT */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link href="/" style={{ textDecoration: 'none', color: '#fff' }}>←</Link>
          <span>DuckZone Direct</span>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
            <span style={{ fontSize: "24px" }}>{meuAvatar}</span>
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meuNomeReal}</span>
              <span style={{ fontSize: "10px", color: "var(--teal-neon)", opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meuStatusBio}</span>
            </div>
          </div>
          <button onClick={() => setModalPerfilAberto(true)} className="back-btn" style={{ fontSize: "10px", padding: "4px 8px" }}>
            Editar ⚙️
          </button>
        </div>

        <div className="chat-list">
          <div className={`chat-item ${isLagoa ? "active" : ""}`} onClick={() => setAbaAtiva("lagoa")}>
            <div className="chat-item-avatar">🌊</div>
            <div className="chat-item-info">
              <span className="chat-item-title">Lagoa Pública</span>
              <span className="chat-item-sub">Mergulho Anônimo</span>
            </div>
          </div>

          {privados.map((chat, i) => (
            <div key={chat.id} className={`chat-item ${abaAtiva === chat.id ? "active" : ""}`} onClick={() => setAbaAtiva(chat.id)}>
              <div className="chat-item-avatar">🔒</div>
              <div className="chat-item-info">
                <span className="chat-item-title">Ninho Privado {i + 1}</span>
                <span className="chat-item-sub">Bate-Papo Exclusivo</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* CHAT PRINCIPAL */}
      <main className="main-chat-area">
        <header className="chat-header">
          <div style={{ fontSize: "16px", fontWeight: "bold", color: "#fff" }}>
            {isLagoa ? "Mergulho Anônimo" : "Ninho Privado"}
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {(isLagoa ? lagoaAtiva : true) && !chamadaAtiva && (
              <button onClick={solicitarChamadaVoz} className="btn-call-start">
                📞 Iniciar Chamada
              </button>
            )}
            {isLagoa && lagoaAtiva && (
              <button onClick={solicitarPrivado} className="back-btn" style={{ borderColor: "#2dd4bf", color: "#2dd4bf" }}>
                Puxar p/ Privado 🔐
              </button>
            )}
          </div>
        </header>

        <div className="chat-body">
          {/* PAINEL CHAMADA ATIVA */}
          {chamadaAtiva && (
            <div className="discord-call-panel-v2">
              <div className="d-call-info">
                <div className="d-call-dot"></div>
                <div className="d-call-text">
                  <span className="d-call-title">Voz Conectada</span>
                  <span className="d-call-subtitle">{isLagoa ? 'Lagoa Pública' : 'Ninho Privado'} • Filtro Ativo</span>
                </div>
              </div>

              <div className="d-call-actions">
                <button 
                  onClick={() => setModalPerfilAberto(true)} 
                  className="d-action-btn"
                  data-tooltip="Configurações"
                >
                  ⚙️
                </button>

                <button 
                  onClick={alternarMuteMicrofone} 
                  className={`d-action-btn ${microfoneMutado ? "btn-muted" : ""}`}
                  data-tooltip={microfoneMutado ? "Desmutar" : "Mutar"}
                >
                  {microfoneMutado ? "🔇" : "🎙️"}
                </button>

                <button 
                  onClick={alternarAudioMutado} 
                  className={`d-action-btn ${audioMutado ? "btn-muted" : ""}`}
                  data-tooltip={audioMutado ? "Escutar" : "Ensurdecer"}
                >
                  {audioMutado ? "🔕" : "🎧"}
                </button>

                <button 
                  onClick={desligarChamada} 
                  className="d-action-btn btn-disconnect"
                >
                  <span>☎️</span> Desconectar
                </button>
              </div>
            </div>
          )}

          {/* PAINEL CHAMADA RECEBIDA */}
          {chamadaRecebida && !chamadaAtiva && (
            <div className="discord-call-panel-v2" style={{ borderLeft: '4px solid #23a559' }}>
              <div className="d-call-info">
                <div className="d-call-dot" style={{animation: 'pulse-green 1s infinite'}}></div>
                <div className="d-call-text">
                  <span className="d-call-title" style={{color: '#fff'}}>Recebendo Chamada...</span>
                  <span className="d-call-subtitle">O outro pato quer falar!</span>
                </div>
              </div>

              <div className="d-call-actions">
                <button 
                  onClick={atenderChamadaVoz} 
                  className="d-action-btn" 
                  style={{backgroundColor: '#23a559', color: '#fff'}} 
                  data-tooltip="Atender"
                >
                  📞
                </button>
                <button 
                  onClick={recusarChamadaVoz} 
                  className="d-action-btn btn-muted" 
                  data-tooltip="Recusar"
                >
                  ✖️
                </button>
              </div>
            </div>
          )}

          {isLagoa && !lagoaAtiva && !lagoaPendente && !procurando && (
            <div className="matching-card">
              <div className="duck-avatar">🎭</div>
              <h2 style={{ fontSize: "24px", fontWeight: "900", color: "#fff", marginBottom: "8px" }}>Lagoa Secreta</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px" }}>A conversa inicial é 100% anônima.</p>
              <button onClick={procurarPato} className="btn-lagoa">ENTRAR NA ÁGUA 🚀</button>
            </div>
          )}

          {isLagoa && procurando && (
            <div className="matching-card">
              <div className="radar-spinner"></div>
              <h2 style={{ color: "#2dd4bf" }}>Procurando um Pato...</h2>
            </div>
          )}

          {isLagoa && lagoaPendente && !lagoaAtiva && (
            <div className="matching-card" style={{ borderColor: "#2dd4bf" }}>
              <h2 style={{ color: "#fff", marginBottom: "8px" }}>Pato Encontrado!</h2>
              <div style={{ display: "inline-block", background: "rgba(20,184,166,0.2)", color: "#2dd4bf", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", marginBottom: "16px" }}>
                Confirmações: {confirmados}/2
              </div>
              <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>Deseja falar com <strong>{parceiroNomeAnon || "um Pato Anônimo"}</strong>?</p>
              <button onClick={aceitarConexao} className="btn-lagoa" style={{ marginBottom: "10px", opacity: jaAceitou ? 0.6 : 1 }} disabled={jaAceitou}>
                {jaAceitou ? "Aguardando outro Pato... ⏳" : "Sim, Conectar! 💚"}
              </button>
              <button onClick={recusarConexao} className="back-btn" style={{ width: "100%", padding: "16px", color: "#f43f5e" }}>Pular</button>
            </div>
          )}

          {(isLagoa ? lagoaAtiva : true) && (
            <>
              {isLagoa && statusConvite && (
                <div style={{ background: "rgba(6,24,33,0.9)", border: "1px solid #2dd4bf", color: "#fff", padding: "10px", textAlign: "center", borderRadius: "10px", marginBottom: "10px" }}>
                  {statusConvite}
                </div>
              )}

              {isLagoa && convitePendente && (
                <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid #10b981", padding: "16px", textAlign: "center", borderRadius: "16px", marginBottom: "12px" }}>
                  <p style={{ color: "#fff", fontWeight: "bold", marginBottom: "12px" }}>🔒 {convitePendente} te convidou para o Privado!</p>
                  <button onClick={() => responderConvite(true)} className="send-btn" style={{ marginRight: "10px" }}>Aceitar (Revelar Perfil)</button>
                  <button onClick={() => responderConvite(false)} className="back-btn" style={{ color: "#f43f5e" }}>Recusar</button>
                </div>
              )}

              <div className="chat-messages">
                {msgsAtuais.map((msg) => {
                  const meuNomeAqui = isLagoa ? meuNomeAnon : `${meuAvatar} ${meuNomeReal}`;
                  const eMinha = msg.usuario === meuNomeAqui;
                  const eSistema = msg.usuario.includes("SISTEMA");

                  return (
                    <div key={msg.id} className={`msg-wrapper ${eSistema ? "system-msg" : eMinha ? "my-msg" : "other-msg"}`}>
                      <div className="msg-header">
                        <span className="msg-meta">{msg.usuario} • {msg.hora}</span>
                        {eMinha && !eSistema && (
                          <button onClick={() => apagarMensagem(msg.id)} className="delete-btn" title="Apagar mensagem">🗑️</button>
                        )}
                      </div>
                      <div className="msg-bubble">
                        {msg.mensagem}
                        {msg.imagem && <img src={msg.imagem} alt="Mídia enviada" style={{ maxWidth: "100%", borderRadius: "10px", marginTop: "8px" }} />}
                        {msg.audio && <audio src={msg.audio} controls style={{ marginTop: "8px", maxWidth: "100%" }} />}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-container">
                {imagemBase64 && (
                  <div className="preview-container">
                    <img src={imagemBase64} alt="Preview" className="preview-img" />
                    <span style={{ fontSize: "12px", color: "#2dd4bf" }}>Foto selecionada</span>
                    <button onClick={() => setImagemBase64(null)} style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", marginLeft: "auto" }}>✕</button>
                  </div>
                )}

                <form onSubmit={enviarMensagem} className="chat-input-area">
                  {!isLagoa && (
                    <label className="attach-clip-btn" title="Anexar Foto">
                      📎
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                    </label>
                  )}
                  <input type="text" className="chat-input" placeholder={gravandoAudioMsg ? "Gravando áudio..." : "Escreva sua mensagem..."} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={gravandoAudioMsg} autoFocus />
                  <button type="button" onClick={alternarGravacaoAudioMsg} className={`mic-btn ${gravandoAudioMsg ? "recording" : ""}`} title="Gravar Áudio">
                    {gravandoAudioMsg ? "🛑" : "🎙️"}
                  </button>
                  <button type="submit" className="send-btn">Enviar</button>
                </form>
              </div>
            </>
          )}
        </div>
      </main>

      {/* MODAL PREMIUM DE CONFIGURAÇÕES */}
      {modalPerfilAberto && (
        <div 
          onClick={fecharModalPerfil} 
          style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000, padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{
              backgroundColor: '#0b141a',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              maxHeight: '90vh',
              border: '1px solid #1f2d35',
              boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* CABEÇALHO FIXO COM X */}
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '20px 24px', borderBottom: '1px solid #1f2d35', 
              background: 'rgba(11, 20, 26, 0.95)', zIndex: 10
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ Configurações e Perfil
              </h3>
              <button 
                onClick={fecharModalPerfil} 
                title="Fechar"
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8',
                  fontSize: '24px', cursor: 'pointer', transition: 'color 0.2s ease',
                  padding: '4px', lineHeight: '1', display: 'flex', alignItems: 'center'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#f43f5e'}
                onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
              >
                ✖
              </button>
            </div>
            
            {/* CORPO DO MODAL */}
            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              {/* SEÇÃO 1: PERFIL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="pro-label">SEU NOME DE EXIBIÇÃO</label>
                  <input 
                    type="text" 
                    value={meuNomeReal} 
                    onChange={(e) => setMeuNomeReal(e.target.value)} 
                    className="pro-input"
                    placeholder="Como os patos te chamam?"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="pro-label">STATUS/BIO DA LAGOA</label>
                  <input 
                    type="text" 
                    value={meuStatusBio} 
                    onChange={(e) => setMeuStatusBio(e.target.value)} 
                    maxLength={50} 
                    className="pro-input"
                    placeholder="No que você está pensando?"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label className="pro-label">SEU AVATAR DA LAGOA</label>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {["🦆", "🦅", "🦉", "🐧", "👑", "🚀"].map((emoji) => (
                      <span 
                        key={emoji} 
                        onClick={() => setMeuAvatar(emoji)}
                        className={`avatar-btn ${meuAvatar === emoji ? 'active' : ''}`}
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #1f2d35" }}></div>

              {/* SEÇÃO 2: ÁUDIO */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* VOLUME ENTRADA */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label className="pro-label" style={{ margin: 0 }}>VOLUME DE ENTRADA (MIC)</label>
                    <span style={{ fontSize: '13px', color: '#2dd4bf', fontWeight: '900' }}>{volumeEntrada}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="200" value={volumeEntrada} 
                    onChange={(e) => setVolumeEntrada(Number(e.target.value))} 
                    className="discord-slider"
                    style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}
                  />
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '6px 0 0 0' }}>Se você soprar muito forte e "estourar", diminua aqui.</p>
                </div>

                {/* VOLUME SAÍDA */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label className="pro-label" style={{ margin: 0 }}>VOLUME DE SAÍDA (LIGAÇÃO)</label>
                    <span style={{ fontSize: '13px', color: '#2dd4bf', fontWeight: '900' }}>{volumeSaida}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" value={volumeSaida} 
                    onChange={(e) => setVolumeSaida(Number(e.target.value))} 
                    className="discord-slider"
                    style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}
                  />
                </div>

                {/* NOISE GATE */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label className="pro-label" style={{ margin: 0 }}>SENSIBILIDADE (NOISE GATE)</label>
                    <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '900' }}>{sensibilidade}%</span>
                  </div>
                  
                  <div style={{ 
                    position: "relative", width: "100%", height: "26px", 
                    background: "#121e24", borderRadius: "8px", overflow: "hidden", border: '1px solid #1f2d35'
                  }}>
                    <div id="volume-bar-visual" style={{ 
                      position: "absolute", top: 0, left: 0, height: "100%", width: "0%", 
                      background: "#f43f5e", transition: "width 0.05s ease-out, background-color 0.1s" 
                    }}></div>
                    <input 
                      type="range" min="1" max="100" value={sensibilidade} 
                      onChange={(e) => setSensibilidade(Number(e.target.value))} 
                      className="discord-slider"
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", margin: 0, background: "transparent", zIndex: 10 }}
                    />
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0 0', lineHeight: '1.5' }}>
                    Ative o teste de voz e fale. Arraste a linha branca para ficar um pouco acima do ruído ambiente, mas abaixo de quando você fala.
                  </p>
                </div>

                {/* BOTÃO DE TESTE */}
                <button 
                  type="button"
                  onClick={alternarTesteMic}
                  className={`btn-test-mic ${testandoMic ? 'active' : ''}`}
                >
                  {testandoMic ? '🛑 Parar Teste de Voz' : '🎙️ Ouvir minha própria voz'}
                </button>
              </div>
            </div>

            {/* RODAPÉ FIXO */}
            <div style={{ 
              padding: '20px 24px', borderTop: '1px solid #1f2d35', 
              background: 'rgba(11, 20, 26, 0.95)', zIndex: 10
            }}>
              <button 
                onClick={fecharModalPerfil} 
                style={{
                  width: '100%', padding: '16px',
                  background: 'linear-gradient(135deg, #2dd4bf, #10b981)',
                  border: 'none', borderRadius: '12px', color: '#020d12',
                  fontSize: '15px', fontWeight: '900', cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 15px rgba(45, 212, 191, 0.3)'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(45, 212, 191, 0.4)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(45, 212, 191, 0.3)'; }}
              >
                SALVAR CONFIGURAÇÕES 💾
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}