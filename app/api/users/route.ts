import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, avatar } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const novaTag = Math.floor(1000 + Math.random() * 9000).toString();

    // 1. Tenta buscar o usuário
    let user = await prisma.user.findUnique({
      where: { email },
    });

    // 2. Se não existir, tenta criar
    if (!user) {
      try {
        user = await prisma.user.create({
          data: {
            name: name || 'Pato Verificado',
            email,
            tag: novaTag,
            avatar: avatar || '🦆',
          },
        });
      } catch (err: any) {
        // Se bater erro de "Unique constraint" (já foi criado pela requisição dupla do React), ele apenas busca o usuário de novo
        if (err.code === 'P2002') {
          user = await prisma.user.findUnique({ where: { email } });
        } else {
          throw err; // Se for outro erro, ele joga pra frente
        }
      }
    } 
    
    // 3. Se o usuário JÁ existir mas estiver sem Tag no banco
    if (user && !user.tag) {
      user = await prisma.user.update({
        where: { email },
        data: { tag: novaTag },
      });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('=== ERRO CRÍTICO NO BANCO ===', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Erro interno no servidor' }, { status: 500 });
  }
}