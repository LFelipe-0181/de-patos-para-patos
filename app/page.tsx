"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  // Evita erros de hidratação no Next.js
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      width: "100vw",
      background: "radial-gradient(circle at 50% 30%, #082a33 0%, #020d12 60%, #010608 100%)",
      color: "#fff",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "20px",
      boxSizing: "border-box"
    }}>
      <div style={{
        background: "rgba(6, 24, 33, 0.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(45, 212, 191, 0.2)",
        borderRadius: "28px",
        padding: "40px 32px",
        width: "100%",
        maxWidth: "400px",
        textAlign: "center",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(20, 184, 166, 0.15)",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
        
        {/* Cabeçalho do Card */}
        <div>
          <div style={{
            fontSize: "64px",
            marginBottom: "10px",
            animation: "floatDuck 3.5s ease-in-out infinite",
            display: "inline-block"
          }}>
            🦆
          </div>
          <h1 style={{
            fontSize: "32px",
            fontWeight: "900",
            margin: "0 0 5px 0",
            background: "linear-gradient(135deg, #2dd4bf, #34d399)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            DuckZone
          </h1>
          <p style={{
            fontSize: "12px",
            color: "#14b8a6",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            margin: 0,
            opacity: 0.8,
            fontWeight: "bold"
          }}>
            Mergulho Anônimo & Direct
          </p>
        </div>

        {/* Linha Divisória */}
        <div style={{ height: "1px", background: "rgba(45, 212, 191, 0.15)", width: "100%", margin: "4px 0" }}></div>

        {/* Área de Autenticação */}
        {status === "loading" ? (
          <div style={{ padding: "20px 0" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid rgba(45,212,191,0.2)", borderTopColor: "#2dd4bf", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }}></div>
          </div>
        ) : session ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
            
            {/* Box do Usuário Logado */}
            <div style={{ 
              background: "rgba(2, 13, 18, 0.6)", 
              padding: "12px", 
              borderRadius: "16px", 
              width: "100%", 
              border: "1px solid rgba(45, 212, 191, 0.15)" 
            }}>
              <p style={{ fontSize: "10px", color: "#94a3b8", margin: "0 0 4px 0", letterSpacing: "1px" }}>CONECTADO COMO</p>
              <p style={{ fontSize: "14px", fontWeight: "bold", color: "#f1f5f9", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {session.user?.email}
              </p>
            </div>
            
            {/* Botão Principal de Entrar */}
            <Link href="/chat" style={{ width: "100%", textDecoration: "none" }}>
              <button style={{
                width: "100%",
                padding: "16px",
                background: "linear-gradient(135deg, #2dd4bf, #10b981)",
                border: "none",
                borderRadius: "16px",
                color: "#020d12",
                fontSize: "15px",
                fontWeight: "900",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(20, 184, 166, 0.4)",
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 25px rgba(20, 184, 166, 0.6)"; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0px)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(20, 184, 166, 0.4)"; }}
              >
                ENTRAR NA ÁGUA 🚀
              </button>
            </Link>

            {/* Botão de Logout Secundário */}
            <button onClick={() => signOut()} style={{
              background: "transparent",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              color: "#f43f5e",
              padding: "12px",
              borderRadius: "14px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              width: "100%",
              transition: "all 0.2s ease"
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(244, 63, 94, 0.1)"; e.currentTarget.style.borderColor = "#f43f5e"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.3)"; }}
            >
              Sair da Conta 🚪
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0, lineHeight: "1.6" }}>
              Conecte-se para conversar de forma 100% anônima e migrar para salas privadas quando a vibe bater.
            </p>
            <button onClick={() => signIn("google")} style={{
              width: "100%",
              padding: "16px",
              background: "rgba(2, 13, 18, 0.8)",
              border: "1px solid rgba(45, 212, 191, 0.4)",
              borderRadius: "16px",
              color: "#fff",
              fontSize: "15px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              transition: "all 0.2s ease"
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#14b8a6"; e.currentTarget.style.boxShadow = "0 0 15px rgba(20, 184, 166, 0.2)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "rgba(45, 212, 191, 0.4)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0px)"; }}
            >
              <span style={{ fontSize: "20px" }}>🌐</span> Entrar com Google
            </button>
          </div>
        )}
      </div>

      {/* Animações Globais Exclusivas dessa Tela */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes floatDuck {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(4deg); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}