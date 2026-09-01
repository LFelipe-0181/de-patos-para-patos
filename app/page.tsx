"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import "./theme.css";

export default function Home() {
  // AQUI FORÇA A TELA COMEÇAR NO TEMA CLARO ☀️
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [telaAtiva, setTelaAtiva] = useState<"intro" | "auth">("intro");
  const [isLogin, setIsLogin] = useState(true);
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isDark = theme === "dark";
  const duckImgSrc = isDark ? "/pato-roxo.png" : "/pato-amarelo.png";

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      alert("Para o login com e-mail funcionar, configure o CredentialsProvider no NextAuth!");
    } else {
      alert("Para cadastrar contas, você precisará conectar um Banco de Dados (ex: Prisma/MongoDB).");
    }
  };

  return (
    <div data-theme={theme} className={`app-wrapper ${telaAtiva === "intro" ? "intro-bg" : ""}`}>
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
        /* FUNDO DA INTRO AZUL CONFORME PEDIDO */
        .app-wrapper.intro-bg { background: var(--btn-blue-grad) !important; }
        
        .auth-container { width: 100%; max-width: 440px; padding: 24px; box-sizing: border-box; position: relative; }
        .main-card {
          position: relative; width: 100%; background-color: var(--bg-card);
          border: 1px solid var(--border-color); border-radius: 28px;
          padding: 40px 24px 30px 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); box-sizing: border-box;
        }
        .duck-top-center { position: absolute; top: -35px; left: 50%; transform: translateX(-50%); width: 70px; height: 70px; object-fit: contain; z-index: 10; }
        .duck-top-left-group { position: absolute; top: -45px; left: 10px; display: flex; align-items: flex-end; gap: 2px; z-index: 10; }
        .duck-small { width: 30px; height: 30px; object-fit: contain; }
        .duck-medium { width: 40px; height: 40px; object-fit: contain; }
        .duck-large { width: 60px; height: 60px; object-fit: contain; }
        .card-logo { width: 180px; margin: 0 auto 20px auto; display: block; }
        .bottom-logo { position: relative; width: 120px; margin: 20px auto 0 auto; display: block; }
        .text-intro { font-size: 14px; color: var(--text-muted); text-align: center; line-height: 1.5; margin-bottom: 16px; }
        .bullet-list { font-size: 13.5px; color: var(--text-main); padding-left: 20px; margin-bottom: 24px; font-weight: 600; line-height: 1.6; }
        .card-title { font-size: 15px; color: var(--text-main); text-align: center; margin-bottom: 20px; font-weight: 500; }
        .form-input {
          width: 100%; padding: 14px 16px; border-radius: 99px; border: 1px solid var(--border-color);
          background-color: var(--bg-input); color: var(--text-main); font-size: 15px; outline: none; margin-bottom: 16px; box-sizing: border-box;
        }
        .btn-action {
          width: 100%; padding: 14px; border-radius: 99px; border: none; background: var(--btn-blue-grad);
          color: #ffffff; font-size: 16px; font-weight: 700; cursor: pointer; transition: transform 0.2s;
        }
        .btn-action:hover { transform: scale(1.02); }
        .divider { display: flex; align-items: center; text-align: center; margin: 16px 0; color: var(--text-muted); font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid var(--border-color); opacity: 0.3; }
        .divider::before { margin-right: 12px; } .divider::after { margin-left: 12px; }
        .btn-social {
          width: 100%; background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-main);
          font-weight: 600; font-size: 14px; padding: 12px; border-radius: 99px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; transition: transform 0.2s;
        }
        .btn-social:hover { transform: scale(1.02); }
        .auth-footer { text-align: center; margin-top: 20px; font-size: 13px; color: var(--text-muted); }
        .auth-footer span { color: var(--icon-color); font-weight: 700; cursor: pointer; text-decoration: underline; }
        .theme-toggle-btn { background: none; border: none; color: var(--text-main); text-decoration: underline; font-size: 12px; cursor: pointer; margin-top: 16px; display: block; width: 100%; text-align: center; }
      `}} />

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

            <button className="btn-action" onClick={() => setTelaAtiva("auth")}>
              CONTINUAR
            </button>
          </div>
        </div>
      )}

      {telaAtiva === "auth" && (
        <div className="auth-container">
          <div className="main-card">
            <img src={duckImgSrc} alt="Pato" className="duck-top-center" />
            
            <h3 className="card-title">
              {isLogin ? "Mergulhe anonimamente ou entre em ninhos." : "Crie sua conta para mergulhar"}
            </h3>
            
            <form onSubmit={handleEmailSubmit}>
              {!isLogin && (
                <input type="text" placeholder="Seu nome" className="form-input" value={nome} onChange={(e) => setNome(e.target.value)} required />
              )}
              <input type="email" placeholder="Seu e-mail" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Senha secreta" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required />

              <button type="submit" className="btn-action">
                {isLogin ? "ENTRAR" : "CRIAR CONTA"}
              </button>
            </form>

            <div className="divider">ou</div>

            <button type="button" onClick={() => signIn("google", { callbackUrl: '/chat' })} className="btn-social">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar com Google
            </button>

            <div className="auth-footer">
              {isLogin ? (
                <>Não tem uma conta? <span onClick={() => setIsLogin(false)}>Cadastre-se</span></>
              ) : (
                <>Já é um pato registrado? <span onClick={() => setIsLogin(true)}>Fazer Login</span></>
              )}
            </div>

            <button className="theme-toggle-btn" onClick={toggleTheme}>
              Alternar para Tema {isDark ? "Claro ☀️" : "Escuro 🌙"}
            </button>
          </div>
          <img src={isDark ? "/logo-duckzone-dark.png" : "/logo-duckzone.png"} alt="Logo Bottom" className="bottom-logo" />
        </div>
      )}
    </div>
  );
}