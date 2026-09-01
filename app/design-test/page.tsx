"use client";

import { useState } from "react";
import "../theme.css";

export default function SandboxDesignPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  
  // Telas do fluxo: intro -> cadastro_nome -> cadastro_genero -> lagoa -> chat
  const [telaAtiva, setTelaAtiva] = useState<"intro" | "cadastro_nome" | "cadastro_genero" | "lagoa" | "chat">("intro");
  
  // Abas do Chat (Sidebar)
  const [abaChat, setAbaChat] = useState<"grupos" | "amigos" | "config">("amigos");

  // Estados dos formulários e inputs
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [genero, setGenero] = useState("Selecione");
  const [filtroLagoa, setFiltroLagoa] = useState("");
  const [chatInput, setChatInput] = useState("");

  // Lista dinâmica de amigos / chats ativos
  const [amigoAtivo, setAmigoAtivo] = useState({ id: 1, nome: "PatoAnônimo_99", status: "online" });
  const [amigos, setAmigos] = useState([
    { id: 1, nome: "PatoAnônimo_99", status: "online" },
    { id: 2, nome: "PatoProgramador", status: "offline" },
    { id: 3, nome: "DuckMaster", status: "online" }
  ]);

  const [mensagens, setMensagens] = useState([
    { id: 1, sender: "me", text: "Opa, beleza? Cheguei na DuckZone!" },
    { id: 2, sender: "other", text: "E aí! Curtiu o visual do novo chat?" }
  ]);

  const isDark = theme === "dark";
  const duckImgSrc = isDark ? "/pato-roxo.png" : "/pato-amarelo.png";
  const lagoImgSrc = isDark ? "/lago-dark.png" : "/lago-claro.png";

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Regra de negócio para "Prefiro não informar"
  const isGeneroSecreto = genero === "Prefiro não informar";

  const handleSelecionarFiltroLagoa = (filtro: string) => {
    if (isGeneroSecreto && filtro !== "Qualquer pessoa") {
      alert("Como você preferiu não informar o gênero, só pode buscar por 'Qualquer pessoa'.");
      return;
    }
    setFiltroLagoa(filtro);
    setAmigoAtivo({ id: 999, nome: `Pato Anônimo (${filtro})`, status: "online" });
    setTelaAtiva("chat");
  };

  const handleEnviarMensagem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setMensagens([...mensagens, { id: Date.now(), sender: "me", text: chatInput }]);
    setChatInput("");
  };

  return (
    <div data-theme={theme} className={`app-wrapper ${telaAtiva === "chat" ? "chat-mode" : ""} ${telaAtiva === "intro" ? "intro-bg" : ""}`}>
      <style dangerouslySetInnerHTML={{__html: `
        .app-wrapper {
          min-height: 100vh;
          width: 100vw;
          background: var(--bg-gradient);
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          transition: background 0.4s ease;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        /* FUNDO DA INTRODUÇÃO USANDO O DEGRADÊ DO BOTÃO AZUL */
        .app-wrapper.intro-bg {
          background: var(--btn-blue-grad) !important;
        }

        .app-wrapper.chat-mode {
          padding: 0;
          height: 100vh;
          overflow: hidden;
        }

        .auth-container {
          width: 100%;
          max-width: 440px;
          padding: 24px;
          box-sizing: border-box;
          position: relative;
        }

        .main-card {
          position: relative;
          width: 100%;
          background-color: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 28px;
          padding: 40px 24px 30px 24px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          box-sizing: border-box;
        }

        .duck-top-center {
          position: absolute;
          top: -35px;
          left: 50%;
          transform: translateX(-50%);
          width: 70px;
          height: 70px;
          object-fit: contain;
          z-index: 10;
        }

        .duck-top-left-group {
          position: absolute;
          top: -45px;
          left: 10px;
          display: flex;
          align-items: flex-end;
          gap: 2px;
          z-index: 10;
        }
        
        .duck-small { width: 30px; height: 30px; object-fit: contain; }
        .duck-medium { width: 40px; height: 40px; object-fit: contain; }
        .duck-large { width: 60px; height: 60px; object-fit: contain; }

        .card-logo {
          width: 180px;
          margin: 0 auto 20px auto;
          display: block;
        }
        
        .bottom-logo {
          position: relative;
          width: 120px;
          margin: 20px auto 0 auto;
          display: block;
        }

        .text-intro {
          font-size: 14px;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.5;
          margin-bottom: 16px;
        }

        .bullet-list {
          font-size: 13.5px;
          color: var(--text-main);
          padding-left: 20px;
          margin-bottom: 24px;
          font-weight: 600;
          line-height: 1.6;
        }

        .card-title {
          font-size: 15px;
          color: var(--text-main);
          text-align: center;
          margin-bottom: 20px;
          font-weight: 500;
        }

        .form-input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 99px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-input);
          color: #000;
          font-size: 15px;
          outline: none;
          margin-bottom: 16px;
          box-sizing: border-box;
        }

        .btn-action {
          width: 100%;
          padding: 14px;
          border-radius: 99px;
          border: none;
          background: var(--btn-blue-grad);
          color: #ffffff;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
        }

        .theme-toggle-btn {
          background: none;
          border: none;
          color: var(--text-main);
          text-decoration: underline;
          font-size: 13px;
          cursor: pointer;
          margin-top: 16px;
          display: block;
          width: 100%;
          text-align: center;
        }

        .lagoa-top-img {
          position: absolute;
          top: -60px;
          left: 50%;
          transform: translateX(-50%);
          width: 130px;
          height: auto;
          z-index: 10;
        }

        .grid-lagoa {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }

        .btn-lagoa {
          padding: 12px 8px;
          border-radius: 99px;
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          color: var(--text-main);
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .lagoa-footer {
          font-size: 11px;
          color: var(--text-muted);
          text-align: center;
        }

        /* CHAT FULLSCREEN */
        .chat-layout-fullscreen {
          width: 100vw;
          height: 100vh;
          display: flex;
          background: var(--bg-gradient);
          overflow: hidden;
        }

        .chat-icon-rail {
          width: 68px;
          background-color: rgba(0, 0, 0, 0.08);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 0;
          gap: 16px;
          z-index: 10;
        }

        .rail-btn {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-input);
          color: var(--text-main);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .rail-btn.active {
          background: var(--btn-blue-grad);
          color: #fff;
        }

        .rail-btn-duck {
          width: 28px;
          height: 28px;
          object-fit: contain;
        }

        .chat-sidebar {
          width: 280px;
          background-color: rgba(255, 255, 255, 0.2);
          border-right: 1px solid var(--border-color);
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-sizing: border-box;
        }

        .sidebar-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-main);
          margin: 0;
        }

        .friend-item-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background-color: var(--bg-input);
          border: 1px solid var(--border-color);
          font-size: 14px;
          font-weight: 600;
          color: var(--text-main);
          cursor: pointer;
          transition: transform 0.15s;
        }

        .friend-item-btn.active {
          border-width: 2px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .status-dot.online { background-color: #10b981; }
        .status-dot.offline { background-color: #9ca3af; }

        .chat-main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          position: relative;
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: var(--chat-header-bg);
          border-bottom: 1px solid var(--icon-color);
        }

        .chat-header-user {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chat-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background-color: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          border: 2px solid var(--icon-color);
          color: var(--icon-color);
        }

        .chat-header-name {
          font-size: 18px;
          font-weight: 700;
          color: var(--icon-color);
        }

        .chat-icons {
          display: flex;
          gap: 18px;
          font-size: 20px;
          color: var(--icon-color);
          cursor: pointer;
        }

        .chat-messages {
          flex: 1;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
        }

        .chat-bubble {
          max-width: 60%;
          padding: 14px 20px;
          border-radius: 24px;
          font-size: 15px;
          color: #000;
          box-shadow: var(--chat-glow);
          line-height: 1.45;
        }

        .chat-bubble.me {
          align-self: flex-end;
          background-color: var(--bubble-me);
          border-bottom-right-radius: 4px;
        }

        .chat-bubble.other {
          align-self: flex-start;
          background-color: var(--bubble-other);
          border-bottom-left-radius: 4px;
        }

        .chat-input-area {
          padding: 20px 24px;
          background: transparent;
        }

        .chat-input-bar {
          display: flex;
          align-items: center;
          border: 1.5px solid var(--icon-color);
          border-radius: 99px;
          padding: 10px 18px;
          background: var(--chat-input-bar-bg);
        }

        .chat-input-bar input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--icon-color);
          margin-left: 12px;
          font-size: 15px;
        }

        @media (max-width: 768px) {
          .chat-sidebar {
            display: none;
          }
          .chat-bubble {
            max-width: 80%;
          }
        }
      `}} />

      {/* ===================== TELA 1: INTRODUÇÃO ===================== */}
      {telaAtiva === "intro" && (
        <div className="auth-container">
          <div className="main-card" style={{ marginTop: "40px" }}>
            <div className="duck-top-left-group">
              <img src="/pato-amarelo.png" className="duck-small" alt="duck" />
              <img src="/pato-amarelo.png" className="duck-medium" alt="duck" />
              <img src="/pato-amarelo.png" className="duck-large" alt="duck" />
            </div>
            
            <img src="/logo-duckzone.png" alt="Duck Zone Logo" className="card-logo" />
            
            <p className="text-intro">
              Bem vindo a Duck Zone, esse é um projeto independente feito por um grupo de amigos para aqueles que querem um espaço virtual para chamar de seu e para os que quiserem encontrar pessoas com gostos similares.
              <br/><br/>
              Dentro da zona você tem diversas opções você pode
            </p>

            <ul className="bullet-list">
              <li>Criar ninhos privados com um ou mais usuários, podendo fazer compartilhamento de tela, Ligação entre outros</li>
              <li>Entrar na lagoa anonimamente para encontrar outros usuários que queiram socializar</li>
              <li>Fazer publicações no seu perfil</li>
              <li>Entrar em comunidades diversas</li>
            </ul>

            <button className="btn-action" onClick={() => setTelaAtiva("cadastro_nome")}>
              CONTINUAR
            </button>
          </div>
        </div>
      )}

      {/* ===================== TELA 2: CADASTRO NOME & EMAIL ===================== */}
      {telaAtiva === "cadastro_nome" && (
        <div className="auth-container">
          <div className="main-card">
            <img src={duckImgSrc} alt="Pato" className="duck-top-center" />
            
            <h3 className="card-title">Crie sua conta para mergulhar</h3>
            
            <input 
              type="text" 
              placeholder="Seu nome" 
              className="form-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <input 
              type="email" 
              placeholder="Seu e-mail" 
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button className="btn-action" onClick={() => setTelaAtiva("cadastro_genero")}>
              PRÓXIMO
            </button>
          </div>
          <img src={isDark ? "/logo-duckzone-dark.png" : "/logo-duckzone.png"} alt="Logo Bottom" className="bottom-logo" />
        </div>
      )}

      {/* ===================== TELA 3: CADASTRO GÊNERO ===================== */}
      {telaAtiva === "cadastro_genero" && (
        <div className="auth-container">
          <div className="main-card">
            <img src={duckImgSrc} alt="Pato" className="duck-top-center" />
            
            <p className="card-title">Selecione qual gênero você melhor se identifica.</p>
            
            <select 
              className="form-input" 
              value={genero} 
              onChange={(e) => setGenero(e.target.value)}
              style={{ appearance: "none", cursor: "pointer" }}
            >
              <option disabled>Selecione</option>
              <option>Homem</option>
              <option>Mulher</option>
              <option>Não Binário</option>
              <option>Transgênero</option>
              <option>Gênero Fluido</option>
              <option>Prefiro não informar</option>
            </select>

            <button 
              className="btn-action" 
              disabled={genero === "Selecione"}
              onClick={() => setTelaAtiva("lagoa")}
            >
              PRÓXIMO
            </button>

            <button className="theme-toggle-btn" onClick={toggleTheme}>
              Alternar para Tema {isDark ? "Claro ☀️" : "Escuro 🌙"}
            </button>
          </div>
          <img src={isDark ? "/logo-duckzone-dark.png" : "/logo-duckzone.png"} alt="Logo Bottom" className="bottom-logo" />
        </div>
      )}

      {/* ===================== TELA 4: LAGOA ANÔNIMA ===================== */}
      {telaAtiva === "lagoa" && (
        <div className="auth-container">
          <div className="main-card" style={{ marginTop: "40px" }}>
            <img src={lagoImgSrc} alt="Lagoa" className="lagoa-top-img" />
            
            <p className="card-title">Selecione que tipo de pessoa deseja encontrar na lagoa.</p>
            
            <div className="grid-lagoa">
              <button className="btn-lagoa" onClick={() => handleSelecionarFiltroLagoa("Homens")}>Homens</button>
              <button className="btn-lagoa" onClick={() => handleSelecionarFiltroLagoa("Mulheres")}>Mulheres</button>
              <button className="btn-lagoa" onClick={() => handleSelecionarFiltroLagoa("Não Binários")}>Não Binários</button>
              <button className="btn-lagoa" onClick={() => handleSelecionarFiltroLagoa("Transgêneros")}>Transgêneros</button>
              <button className="btn-lagoa" onClick={() => handleSelecionarFiltroLagoa("Gênero Fluido")}>Gênero Fluido</button>
              <button className="btn-lagoa" onClick={() => handleSelecionarFiltroLagoa("Qualquer pessoa")}>Qualquer pessoa</button>
            </div>

            <p className="lagoa-footer">
              Caso tenha selecionado "prefiro não informar" você será encontrado como "qualquer pessoa".
            </p>
          </div>
        </div>
      )}

      {/* ===================== TELA 5: CHAT COMPLETO ===================== */}
      {telaAtiva === "chat" && (
        <div className="chat-layout-fullscreen">
          
          <div className="chat-icon-rail">
            <button 
              className={`rail-btn ${abaChat === "amigos" ? "active" : ""}`}
              onClick={() => setAbaChat("amigos")}
              title="Amigos"
            >
              👥
            </button>
            <button 
              className={`rail-btn ${abaChat === "grupos" ? "active" : ""}`}
              onClick={() => setAbaChat("grupos")}
              title="Ninhos"
            >
              <img src={duckImgSrc} alt="Pato" className="rail-btn-duck" />
            </button>
            <button 
              className={`rail-btn ${abaChat === "config" ? "active" : ""}`}
              onClick={() => setAbaChat("config")}
              title="Configurações"
            >
              ⚙️
            </button>
          </div>

          <div className="chat-sidebar">
            {abaChat === "amigos" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 className="sidebar-title">Amigos</h3>
                  <button onClick={() => setTelaAtiva("lagoa")} style={{ padding: "4px 10px", borderRadius: "99px", border: "1px solid var(--border-color)", background: "var(--btn-gold-grad)", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>
                    + Lagoa
                  </button>
                </div>
                {amigos.map((item) => (
                  <div 
                    key={item.id} 
                    className={`friend-item-btn ${amigoAtivo.id === item.id ? "active" : ""}`}
                    onClick={() => setAmigoAtivo(item)}
                  >
                    <div className={`status-dot ${item.status}`}></div>
                    <span>{item.nome}</span>
                  </div>
                ))}
              </>
            )}

            {abaChat === "grupos" && (
              <>
                <h3 className="sidebar-title">Ninhos & Lagoas</h3>
                <div className="friend-item-btn active"># lagoa-geral 🟢</div>
                <div className="friend-item-btn" style={{ opacity: 0.6 }}>🔒 # duck-devs</div>
              </>
            )}

            {abaChat === "config" && (
              <>
                <h3 className="sidebar-title">Configurações</h3>
                <div style={{ fontSize: "13px", color: "var(--text-main)", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span>Usuário: <strong>{nome || "Seu Nome"}</strong></span>
                  <span>Gênero: <strong>{genero}</strong></span>
                  <button onClick={toggleTheme} style={{ padding: "10px", borderRadius: "12px", border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "#000", cursor: "pointer", fontWeight: "bold", marginTop: "10px" }}>
                    {isDark ? "🌙 Modo Escuro" : "☀️ Modo Claro"}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="chat-main-area">
            <div className="chat-header">
              <div className="chat-header-user">
                <span onClick={() => setTelaAtiva("lagoa")} style={{ cursor: "pointer", fontSize: "22px", color: "var(--icon-color)" }}>←</span>
                <div className="chat-avatar">👤</div>
                <span className="chat-header-name">{amigoAtivo.nome}</span>
              </div>
              <div className="chat-icons">
                <span title="Chamar">📞</span>
                <span title="Compartilhar Tela">🖥️</span>
              </div>
            </div>

            <div className="chat-messages">
              {mensagens.map((msg) => (
                <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
                  {msg.text}
                </div>
              ))}
            </div>

            <div className="chat-input-area">
              <form onSubmit={handleEnviarMensagem} className="chat-input-bar">
                <span style={{ color: "var(--icon-color)", cursor: "pointer" }}>📎</span>
                <input 
                  type="text" 
                  placeholder="Quack algo na lagoa..." 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
              </form>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}