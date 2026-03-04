import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, generateToken } from '@/lib/auth'

/**
 * POST /api/auth/link-phone
 * Vincula telefone ao usuário logado.
 * Se o telefone já existe em outro usuário, faz MERGE das contas:
 * - Transfere googleId/instagramId para o usuário existente
 * - Deleta o usuário novo (que acabou de entrar com Google)
 * - Retorna novo token do usuário original
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const decoded = verifyToken(auth.substring(7))
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { phone } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 })
    }

    // Normalizar telefone (remover espaços, hífens, etc)
    const normalizedPhone = phone.replace(/\D/g, '')

    // Buscar usuário atual
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Verificar se telefone já existe em OUTRO usuário
    const existingUserWithPhone = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        id: { not: currentUser.id }
      }
    })

    if (existingUserWithPhone) {
      // MERGE: Telefone já existe em outro usuário
      // Transferir dados sociais para o usuário que já tinha o telefone

      const updateData: Record<string, unknown> = {}
      
      // Transferir Google ID se o usuário atual tem e o existente não tem
      if (currentUser.googleId && !existingUserWithPhone.googleId) {
        updateData.googleId = currentUser.googleId
      }
      
      // Transferir Instagram ID se o usuário atual tem e o existente não tem
      if (currentUser.instagramId && !existingUserWithPhone.instagramId) {
        updateData.instagramId = currentUser.instagramId
      }

      // Atualizar avatar se não tinha
      if (currentUser.avatar && !existingUserWithPhone.avatar) {
        updateData.avatar = currentUser.avatar
      }

      // Atualizar email para o do Google (mais confiável)
      if (currentUser.googleId && currentUser.email !== existingUserWithPhone.email) {
        // Verificar se o email do Google não está em uso por terceiro
        const emailInUse = await prisma.user.findFirst({
          where: {
            email: currentUser.email,
            id: { not: currentUser.id }
          }
        })
        
        if (!emailInUse) {
          updateData.email = currentUser.email
        }
      }

      // Deletar o usuário novo (criado pelo Google)
      await prisma.$transaction([
        // Deletar registros relacionados do usuário novo
        prisma.loyaltyPoints.deleteMany({ where: { userId: currentUser.id } }),
        prisma.loyaltyTransaction.deleteMany({ where: { userId: currentUser.id } }),
        prisma.referralCode.deleteMany({ where: { userId: currentUser.id } }),
        prisma.referral.deleteMany({ where: { referrerId: currentUser.id } }),
        prisma.referral.deleteMany({ where: { referredUserId: currentUser.id } }),
        // Deletar o usuário novo
        prisma.user.delete({ where: { id: currentUser.id } }),
      ])

      // Atualizar o usuário existente com os dados transferidos
      const mergedUser = await prisma.user.update({
        where: { id: existingUserWithPhone.id },
        data: updateData
      })

      // Gerar novo token para o usuário existente (agora vinculado ao Google)
      const newToken = generateToken(mergedUser.id, mergedUser.email, mergedUser.role)

      return NextResponse.json({
        success: true,
        merged: true,
        message: 'Conta vinculada com sucesso! Seus dados foram unificados.',
        token: newToken,
        user: {
          id: mergedUser.id,
          email: mergedUser.email,
          name: mergedUser.name,
          phone: mergedUser.phone,
          role: mergedUser.role,
          avatar: mergedUser.avatar,
        }
      })
    }

    // Telefone NÃO existe em outro usuário - apenas atualiza
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: { phone: normalizedPhone }
    })

    return NextResponse.json({
      success: true,
      merged: false,
      message: 'Telefone cadastrado com sucesso!',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
      }
    })

  } catch (error) {
    console.error('[Link Phone] Error:', error)
    return NextResponse.json({ error: 'Erro ao vincular telefone' }, { status: 500 })
  }
}
