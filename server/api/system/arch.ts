import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  const arch = process.arch
  
  let archLabel = 'Unknown'
  if (arch === 'arm' || arch === 'arm64') {
    archLabel = 'Arm'
  } else if (arch === 'x64' || arch === 'ia32') {
    archLabel = 'X86'
  } else {
    archLabel = arch.charAt(0).toUpperCase() + arch.slice(1)
  }
  
  return {
    arch: archLabel,
    platform: process.platform,
    nodeVersion: process.version
  }
})
