import React, { useState, useEffect, useCallback } from 'react'

interface NotificationData {
  sender: string
  body: string
}

declare global {
  interface Window {
    electronAPI: {
      onNotification: (callback: (data: NotificationData) => void) => void
    }
  }
}

export const CharacterOverlay: React.FC = () => {
  const [notification, setNotification] = useState<NotificationData | null>(null)
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)

  const showNotification = useCallback((data: NotificationData) => {
    setNotification(data)
    setVisible(true)
    setFading(false)

    setTimeout(() => {
      setFading(true)
      setTimeout(() => {
        setVisible(false)
        setFading(false)
        setNotification(null)
      }, 500)
    }, 5000)
  }, [])

  useEffect(() => {
    window.electronAPI.onNotification(showNotification)
  }, [showNotification])

  if (!visible || !notification) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      padding: 16,
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.5s ease-out',
      pointerEvents: 'none'
    }}>
      {/* 吹き出し */}
      <div style={{
        flex: 1,
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        padding: '12px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        position: 'relative'
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#6B4EE6',
          marginBottom: 4
        }}>
          {notification.sender}
        </div>
        <div style={{
          fontSize: 13,
          color: '#333',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical'
        }}>
          {notification.body}
        </div>
        {/* 吹き出しのしっぽ */}
        <div style={{
          position: 'absolute',
          right: -8,
          bottom: 16,
          width: 0,
          height: 0,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderLeft: '10px solid rgba(255, 255, 255, 0.95)'
        }} />
      </div>

      {/* ダミーキャラクター（CSSアニメーション） */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6B4EE6, #9B6DFF)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 32,
        flexShrink: 0,
        animation: 'bounce 0.6s ease-in-out infinite alternate',
        boxShadow: '0 4px 12px rgba(107, 78, 230, 0.4)'
      }}>
        🐱
      </div>

      <style>{`
        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
