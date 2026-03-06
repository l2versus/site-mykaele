// src/lib/auth.ts
import jwt from 'jsonwebtoken'
import bcryptjs from 'bcryptjs'

// JWT_SECRET carregado em runtime para evitar erros de build
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('❌ JWT_SECRET environment variable is required')
    throw new Error('JWT_SECRET not configured')
  }
  return secret
}

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcryptjs.genSalt(10)
  return bcryptjs.hash(password, salt)
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcryptjs.compare(password, hash)
}

export const generateToken = (userId: string, email: string, role: string) => {
  return jwt.sign(
    { userId, email, role },
    getJwtSecret(),
    { expiresIn: '1d' }
  )
}

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, getJwtSecret()) as { userId: string; email: string; role: string }
  } catch (error) {
    return null
  }
}
