"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      alert("Para o login com e-mail funcionar, configure o CredentialsProvider no NextAuth!");
    } else {
      alert("Para cadastrar contas, você precisará conectar um Banco de Dados (ex: Prisma/MongoDB).");
    }
  };

  return (
    <div className="auth-container">
      <style dangerouslySetInnerHTML={{__html: `
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 50% -20%, #0f3847 0%, #020d12 80%);
          font-family: 'Inter', system-ui, sans-serif;
          padding: 20px;
        }

        .auth-card {
          background: rgba(11, 20, 26, 0.6);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(45, 212, 191, 0.15);
          border-radius: 24px;
          padding: 40px 32px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          animation: fade-in-up 0.5s ease-out;
        }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .duck-logo {
          font-size: 56px;
          text-align: center;
          margin-bottom: 16px;
          display: inline-block;
          width: 100%;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }

        .auth-title {
          text-align: center;
          font-size: 28px;
          font-weight: 900;
          background: linear-gradient(135deg, #2dd4bf, #10b981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
        }

        .auth-subtitle {
          text-align: center;
          color: #94a3b8;
          font-size: 14px;
          margin-bottom: 32px;
          line-height: 1.5;
        }

        .input-group {
          margin-bottom: 16px;
        }

        .auth-input {
          width: 100%;
          background: #121e24;
          border: 1px solid #1f2d35;
          color: #f8fafc;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
        }

        .auth-input:focus {
          border-color: #2dd4bf;
          box-shadow: 0 0 0 4px rgba(45, 212, 191, 0.1);
          background: #16252d;
        }

        .auth-input::placeholder {
          color: #64748b;
        }

        .btn-primary {
          width: 100%;
          background: linear-gradient(135deg, #2dd4bf, #10b981);
          color: #020d12;
          font-weight: 800;
          font-size: 15px;
          padding: 14px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          margin-top: 8px;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(45, 212, 191, 0.3);
        }

        .divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 24px 0;
          color: #475569;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .divider::before, .divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid #1f2d35;
        }
        .divider::before { margin-right: 12px; }
        .divider::after { margin-left: 12px; }

        .social-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .btn-social {
          width: 100%;
          background: #18191b;
          border: 1px solid #2b2d31;
          color: #dbdee1;
          font-weight: 600;
          font-size: 14px;
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.2s ease;
        }

        .btn-social:hover {
          background: #2b2d31;
          border-color: #404249;
          transform: translateY(-1px);
        }

        .btn-social svg {
          width: 20px;
          height: 20px;
        }

        .auth-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 14px;
          color: #94a3b8;
        }

        .auth-footer span {
          color: #2dd4bf;
          font-weight: 700;
          cursor: pointer;
          transition: color 0.2s;
        }
        
        .auth-footer span:hover {
          color: #10b981;
          text-decoration: underline;
        }
      `}} />

      <div className="auth-card">
        <div className="duck-logo">🦆</div>
        <h1 className="auth-title">DuckZone</h1>
        <p className="auth-subtitle">
          {isLogin 
            ? "Mergulhe anonimamente ou entre em ninhos privados." 
            : "Crie sua conta para salvar seus ninhos e configurações."}
        </p>

        {/* FORMULÁRIO DE EMAIL / SENHA */}
        <form onSubmit={handleEmailSubmit}>
          {!isLogin && (
            <div className="input-group">
              <input 
                type="text" 
                placeholder="Como os patos devem te chamar?" 
                className="auth-input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
          )}
          
          <div className="input-group">
            <input 
              type="email" 
              placeholder="Seu melhor e-mail" 
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input 
              type="password" 
              placeholder="Senha secreta" 
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            {isLogin ? "Entrar na Lagoa" : "Criar minha Conta"}
          </button>
        </form>

        <div className="divider">ou conecte com</div>

        {/* BOTÕES SOCIAIS - APENAS GOOGLE E COM TYPE="BUTTON" */}
        <div className="social-buttons">
          <button 
            type="button" 
            onClick={() => signIn("google", { callbackUrl: '/chat' })} 
            className="btn-social"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </button>
        </div>

        {/* RODAPÉ: TROCAR ENTRE LOGIN E CADASTRO */}
        <div className="auth-footer">
          {isLogin ? (
            <>Não tem uma conta? <span onClick={() => setIsLogin(false)}>Cadastre-se</span></>
          ) : (
            <>Já é um pato registrado? <span onClick={() => setIsLogin(true)}>Fazer Login</span></>
          )}
        </div>
      </div>
    </div>
  );
}