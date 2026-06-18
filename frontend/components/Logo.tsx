import Image from 'next/image'

interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 48, className = '' }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="89 บ่อตกกุ้ง"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
      priority
    />
  )
}

// For use as background watermark — very faint
export function LogoBg({ opacity = 0.06 }: { opacity?: number }) {
  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 0 }}>
      <Image
        src="/logo.png"
        alt=""
        width={600}
        height={600}
        style={{ objectFit: 'contain', opacity, filter: 'blur(2px) grayscale(30%)' }}
        priority
      />
    </div>
  )
}
