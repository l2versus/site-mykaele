import { NextRequest, NextResponse } from 'next/server'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'

/**
 * WebAuthn / Passkey API
 * Enables biometric login (Face ID, Touch ID, Windows Hello, fingerprint)
 * 
 * Endpoints:
 * POST /api/auth/webauthn?action=register-options
 * POST /api/auth/webauthn?action=register-verify
 * POST /api/auth/webauthn?action=login-options
 * POST /api/auth/webauthn?action=login-verify
 */

const RP_NAME = 'Mykaele Procópio Home Spa'
const RP_ID = process.env.WEBAUTHN_RP_ID || 'mykaprocopio.com.br'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || `https://${RP_ID}`

// In production, use database. This is the interface:
interface StoredCredential {
  credentialID: string
  credentialPublicKey: string // base64
  counter: number
  transports?: string[]
}

// Temporary in-memory store for challenges (use Redis/DB in production)
const challengeStore = new Map<string, string>()

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'register-options': {
        const { userId, userName, userDisplayName } = await req.json()
        
        const options = await generateRegistrationOptions({
          rpName: RP_NAME,
          rpID: RP_ID,
          userID: new TextEncoder().encode(userId),
          userName: userName || 'user',
          userDisplayName: userDisplayName || userName || 'Usuário',
          attestationType: 'none',
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
            authenticatorAttachment: 'platform', // Built-in biometrics only
          },
          timeout: 60000,
        })

        // Store challenge for verification
        challengeStore.set(userId, options.challenge)

        return NextResponse.json(options)
      }

      case 'register-verify': {
        const { userId, response } = await req.json()
        const expectedChallenge = challengeStore.get(userId)
        if (!expectedChallenge) {
          return NextResponse.json({ error: 'Challenge expirado' }, { status: 400 })
        }

        const verification = await verifyRegistrationResponse({
          response,
          expectedChallenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
        })

        challengeStore.delete(userId)

        if (verification.verified && verification.registrationInfo) {
          const { credential } = verification.registrationInfo
          // TODO: Save credential to database
          // await prisma.webAuthnCredential.create({
          //   data: {
          //     userId,
          //     credentialID: Buffer.from(credential.id).toString('base64url'),
          //     credentialPublicKey: Buffer.from(credential.publicKey).toString('base64'),
          //     counter: credential.counter,
          //     transports: response.response.transports,
          //   }
          // })

          return NextResponse.json({
            verified: true,
            message: 'Biometria cadastrada com sucesso! 🎉',
          })
        }

        return NextResponse.json({ verified: false }, { status: 400 })
      }

      case 'login-options': {
        const { userId } = await req.json()
        
        // TODO: Fetch user credentials from database
        // const credentials = await prisma.webAuthnCredential.findMany({ where: { userId } })
        const credentials: StoredCredential[] = []

        const options = await generateAuthenticationOptions({
          rpID: RP_ID,
          allowCredentials: credentials.map((c) => ({
            id: c.credentialID,
            transports: (c.transports || ['internal']) as any[],
          })),
          userVerification: 'preferred',
          timeout: 60000,
        })

        challengeStore.set(userId, options.challenge)

        return NextResponse.json(options)
      }

      case 'login-verify': {
        const { userId, response } = await req.json()
        const expectedChallenge = challengeStore.get(userId)
        if (!expectedChallenge) {
          return NextResponse.json({ error: 'Challenge expirado' }, { status: 400 })
        }

        // TODO: Fetch credential from database
        // const credential = await prisma.webAuthnCredential.findUnique({
        //   where: { credentialID: response.id }
        // })

        // For now, return placeholder
        return NextResponse.json({
          verified: false,
          message: 'Configure as credenciais no banco de dados',
        })
      }

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('WebAuthn error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
