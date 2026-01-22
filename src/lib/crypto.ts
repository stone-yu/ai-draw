/**
 * 简单的加密/解密工具
 * 使用 XOR 加密和 Base64 编码来混淆敏感信息
 */

/**
 * 生成一个基于时间戳的密钥
 */
function generateKey(): string {
  const timestamp = Date.now().toString()
  // 使用固定的盐值和时间戳的一部分来生成密钥
  const salt = 'AI_DRAW_SECRET_2024'
  // 取时间戳的前10位（秒级），这样在同一秒内生成的密钥相同
  const key = timestamp.slice(0, 10) + salt
  return key
}

/**
 * XOR 加密/解密
 */
function xorCipher(text: string, key: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return result
}

/**
 * 加密敏感信息
 * @param value - 要加密的值
 * @returns 加密后的字符串，格式：timestamp|encrypted_base64
 */
export function encryptSensitive(value: string): string {
  if (!value) return ''

  const timestamp = Date.now().toString().slice(0, 10) // 秒级时间戳
  const key = timestamp + 'AI_DRAW_SECRET_2024'
  const encrypted = xorCipher(value, key)
  const base64 = btoa(encrypted)

  // 返回格式：timestamp|base64，方便解密时使用同样的密钥
  return `${timestamp}|${base64}`
}

/**
 * 解密敏感信息
 * @param encrypted - 加密的字符串，格式：timestamp|encrypted_base64
 * @returns 解密后的原始值
 */
export function decryptSensitive(encrypted: string): string {
  if (!encrypted) return ''

  try {
    const [timestamp, base64] = encrypted.split('|')
    if (!timestamp || !base64) return ''

    const key = timestamp + 'AI_DRAW_SECRET_2024'
    const encryptedText = atob(base64)
    const decrypted = xorCipher(encryptedText, key)

    return decrypted
  } catch (error) {
    console.error('Decrypt error:', error)
    return ''
  }
}

