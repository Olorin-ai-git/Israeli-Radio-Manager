/**
 * Icon component for flow action types
 */

import {
  Music,
  Megaphone,
  Clock,
  Volume2,
  FileAudio,
  Radio,
  MessageSquare,
  Workflow,
} from 'lucide-react'

interface ActionIconProps {
  type: string
  size?: number
  className?: string
}

export default function ActionIcon({ type, size = 14, className }: ActionIconProps) {
  const iconProps = { size, className }

  switch (type) {
    case 'play_genre':
      return <Music {...iconProps} className={className || 'text-blue-400'} />
    case 'play_commercials':
      return <Megaphone {...iconProps} className={className || 'text-orange-400'} />
    case 'play_content':
      return <FileAudio {...iconProps} className={className || 'text-cyan-400'} />
    case 'play_show':
      return <Radio {...iconProps} className={className || 'text-purple-400'} />
    case 'wait':
      return <Clock {...iconProps} className={className || 'text-gray-400'} />
    case 'set_volume':
      return <Volume2 {...iconProps} className={className || 'text-green-400'} />
    case 'announcement':
      return <MessageSquare {...iconProps} className={className || 'text-amber-400'} />
    default:
      return <Workflow {...iconProps} className={className || 'text-primary-400'} />
  }
}
