import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    // Agora recebemos o "gender" também
    const { email, name, bio, avatar, gender } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    // Atualiza os dados no banco
    const user = await prisma.user.update({
      where: { email },
      data: { 
        name, 
        bio, 
        avatar,
        gender 
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('ERRO AO SALVAR PERFIL:', error);
    return NextResponse.json({ error: 'Erro ao salvar perfil' }, { status: 500 });
  }
}