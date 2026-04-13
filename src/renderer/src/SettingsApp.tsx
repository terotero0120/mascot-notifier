import type React from 'react';
import { useEffect, useState } from 'react';

const CHARACTER_OPTIONS = [
  { label: 'ダンス', value: 'dance.json' },
  { label: 'カニ', value: 'crab.json' },
];

const POSITION_OPTIONS: { label: string; value: 'top-right' | 'bottom-right' }[] = [
  { label: '右上', value: 'top-right' },
  { label: '右下', value: 'bottom-right' },
];

const MIN_DURATION = 1;
const MAX_DURATION = 10;

export const SettingsApp: React.FC = () => {
  const [characterFile, setCharacterFile] = useState('dance.json');
  const [displayDuration, setDisplayDuration] = useState(5);
  const [displayPosition, setDisplayPosition] = useState<'top-right' | 'bottom-right'>('top-right');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.electronAPI.getSettings().then((settings) => {
      setCharacterFile(settings.characterFile);
      setDisplayDuration(settings.displayDuration / 1000);
      setDisplayPosition(settings.displayPosition ?? 'top-right');
    });
  }, []);

  const isInvalid = displayDuration < MIN_DURATION || displayDuration > MAX_DURATION;

  const handleSave = async () => {
    await window.electronAPI.saveSettings({
      characterFile,
      displayDuration: displayDuration * 1000,
      displayPosition,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      style={{
        padding: '24px 24px 40px',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <h2 style={{ margin: '0 0 24px', fontSize: 18 }}>設定</h2>

      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="character-select"
          style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}
        >
          キャラクター
        </label>
        <select
          id="character-select"
          value={characterFile}
          onChange={(e) => setCharacterFile(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 14,
            borderRadius: 6,
            border: '1px solid #ccc',
          }}
        >
          {CHARACTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 6, fontSize: 14, fontWeight: 600 }}>表示位置</div>
        <div style={{ display: 'flex', gap: 24 }}>
          {POSITION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="displayPosition"
                value={opt.value}
                checked={displayPosition === opt.value}
                onChange={() => setDisplayPosition(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label
          htmlFor="duration-input"
          style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}
        >
          表示時間（{MIN_DURATION}〜{MAX_DURATION}秒）
        </label>
        <input
          id="duration-input"
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
            boxSizing: 'border-box',
          }}
        />
        {isInvalid && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#e53935' }}>
            {MIN_DURATION}〜{MAX_DURATION}秒の範囲で入力してください
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isInvalid}
        style={{
          padding: '8px 24px',
          fontSize: 14,
          borderRadius: 6,
          border: 'none',
          background: isInvalid ? '#ccc' : '#6B4EE6',
          color: '#fff',
          cursor: isInvalid ? 'default' : 'pointer',
        }}
      >
        保存
      </button>

      {saved && (
        <span style={{ marginLeft: 12, fontSize: 14, color: '#4CAF50' }}>保存しました</span>
      )}
    </div>
  );
};
