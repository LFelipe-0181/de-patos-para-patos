import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

// 1. BUSCAR CONVITES E AMIGOS (NOVO)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) return NextResponse.json({ error: 'Email não fornecido' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    // Busca convites recebidos e pendentes
    const pendentes = await prisma.friendship.findMany({
      where: { receiverId: user.id, status: 'PENDING' },
      include: { sender: true }
    });

    // Busca amizades já aceitas
    const amigos = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ senderId: user.id }, { receiverId: user.id }] },
      include: { sender: true, receiver: true }
    });

    return NextResponse.json({ pendentes, amigos, myId: user.id });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar amigos' }, { status: 500 });
  }
}

// 2. ENVIAR CONVITE (O QUE VOCÊ JÁ TINHA)
export async function POST(req: Request) {
  try {
    const { senderEmail, targetTagString } = await req.json();
    if (!senderEmail || !targetTagString) return NextResponse.json({ error: 'Dados insuficientes.' }, { status: 400 });

    const [targetName, targetTag] = targetTagString.split('#');
    if (!targetName || !targetTag) return NextResponse.json({ error: 'Use Nome#Tag (ex: Pato#1234)' }, { status: 400 });

    const sender = await prisma.user.findUnique({ where: { email: senderEmail } });
    const receiver = await prisma.user.findFirst({ where: { name: targetName.trim(), tag: targetTag.trim() } });

    if (!sender || !receiver) return NextResponse.json({ error: 'Pato não encontrado!' }, { status: 404 });
    if (sender.id === receiver.id) return NextResponse.json({ error: 'Não pode se adicionar!' }, { status: 400 });

    const existing = await prisma.friendship.findFirst({
      where: { OR: [{ senderId: sender.id, receiverId: receiver.id }, { senderId: receiver.id, receiverId: sender.id }] }
    });

    if (existing) return NextResponse.json({ error: 'Já são amigos ou há convite pendente.' }, { status: 400 });

    await prisma.friendship.create({ data: { senderId: sender.id, receiverId: receiver.id, status: 'PENDING' } });
    return NextResponse.json({ success: true, message: 'Convite enviado com sucesso! 🦆' });
  } catch (error) {
    return NextResponse.json({ error: 'Erro no servidor.' }, { status: 500 });
  }
}

// 3. ACEITAR OU RECUSAR CONVITE (NOVO)
export async function PUT(req: Request) {
  try {
    const { friendshipId, action } = await req.json();

    if (action === 'ACCEPT') {
      await prisma.friendship.update({ where: { id: friendshipId }, data: { status: 'ACCEPTED' } });
    } else if (action === 'REJECT') {
      await prisma.friendship.delete({ where: { id: friendshipId } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao processar convite' }, { status: 500 });
  }
}