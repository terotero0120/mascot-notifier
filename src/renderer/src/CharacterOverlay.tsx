import React, { useState, useEffect, useCallback } from 'react'
import Lottie from 'lottie-react'

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
  const [lottieData, setLottieData] = useState<object | null>(null)

  useEffect(() => {
    fetch('/character.json')
      .then(res => res.json())
      .then(data => setLottieData(data))
      .catch(() => {})
  }, [])

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
      flexDirection: 'column',
      alignItems: 'center',
      padding: 16,
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.5s ease-out',
      pointerEvents: 'none'
    }}>
      {/* 吹き出し */}
      <div style={{
        width: '100%',
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
        {/* 吹き出しのしっぽ（下向き） */}
        <div style={{
          position: 'absolute',
          left: '50%',
          bottom: -10,
          marginLeft: -8,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '10px solid rgba(255, 255, 255, 0.95)'
        }} />
      </div>

      {/* キャラクター */}
      <div style={{
        marginTop: 8,
        width: 100,
        height: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {lottieData && (
          <Lottie
            animationData={lottieData}
            loop
            style={{ width: 100, height: 100 }}
          />
        )}
      </div>

    </div>
  )
}
