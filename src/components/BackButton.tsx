// src/components/BackButton.tsx
import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'

interface BackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Custom label for the button; defaults to "Back" */
  label?: string
}

export default function BackButton({ label = 'Back', ...props }: BackButtonProps) {
  const router = useRouter()
  return (
    <Button
      variant="default" size="default"
      onClick={() => router.back()}
      {...props}
    >
      {label}
    </Button>
  )
}