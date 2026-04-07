import React, { useState, useEffect } from 'react'

const CHARACTER_OPTIONS = [
  { label: 'ダンス', value: 'dance.json' },
  { label: 'カニ', value: 'crab.json' }
]

const MIN_DURATION = 1
const MAX_DURATION = 10

export const SettingsApp: React.FC = () => {
  const [characterFile, setCharacterFile] = useState('dance.json')
  const [displayDuration, setDisplayDuration] = useState(5)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.electronAPI.getSettings().then((settings) => {
      setCharacterFile(settings.characterFile)
      setDisplayDuration(settings.displayDuration / 1000)
    })
  }, [])

  const isInvalid = displayDuration < MIN_DURATION || displayDuration > MAX_DURATION

  const handleSave = async () => {
    await window.electronAPI.saveSettings({
      characterFile,
      displayDuration: displayDuration * 1000
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: '24px 24px 40px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 18 }}>設定</h2>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
          キャラクター
        </label>
        <select
          value={characterFile}
          onChange={(e) => setCharacterFile(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 14,
            borderRadius: 6,
            border: '1px solid #ccc'
          }}
        >
          {CHARACTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
          表示時間（{MIN_DURATION}〜{MAX_DURATION}秒）
        </label>
        <input
          type="number"
          min={MIN_DURATION}
          max={MAX_DURATION}
          step={0.5}
          value={displayDuration}
          onChange={(e) => setDisplayDuration(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 14,
            borderRadius: 6,
            border: '1px solid #ccc',
            boxSizing: 'border-box'
          }}
        />
        {isInvalid && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#e53935' }}>
            {MIN_DURATION}〜{MAX_DURATION}秒の範囲で入力してください
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={isInvalid}
        style={{
          padding: '8px 24px',
          fontSize: 14,
          borderRadius: 6,
          border: 'none',
          background: isInvalid ? '#ccc' : '#6B4EE6',
          color: '#fff',
          cursor: isInvalid ? 'default' : 'pointer'
        }}
      >
        保存
      </button>

      {saved && (
        <span style={{ marginLeft: 12, fontSize: 14, color: '#4CAF50' }}>
          保存しました
        </span>
      )}
    </div>
  )
}
