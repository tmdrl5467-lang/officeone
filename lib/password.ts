import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

export async function hashPassword(plainPassword: string): Promise<string> {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS)
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword)
}

// Check if a password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
export function isPasswordHashed(password: string): boolean {
  return /^\$2[ayb]\$/.test(password)
}
