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

type Tab = 'settings' | 'history';

type HistoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; records: LatestNotificationRecord[] }
  | { status: 'error'; message: string };

interface SettingsAppProps {
  initialTab?: Tab;
}

export const SettingsApp: React.FC<SettingsAppProps> = ({ initialTab = 'settings' }) => {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // 設定タブ
  const [characterFile, setCharacterFile] = useState('dance.json');
  const [displayDuration, setDisplayDuration] = useState(5);
  const [displayPosition, setDisplayPosition] = useState<'top-right' | 'bottom-right'>('top-right');
  const [saved, setSaved] = useState(false);

  // 通知履歴タブ
  const [historyState, setHistoryState] = useState<HistoryState>({ status: 'idle' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    window.electronAPI.getSettings().then((settings) => {
      setCharacterFile(settings.characterFile);
      setDisplayDuration(settings.displayDuration / 1000);
      setDisplayPosition(settings.displayPosition ?? 'top-right');
    });
  }, []);

  // メインプロセスからのタブ切り替えイベント
  useEffect(() => {
    return window.electronAPI.onNavigateTab((tab) => {
      if (tab === 'settings' || tab === 'history') {
        setActiveTab(tab as Tab);
        if (tab === 'history') setRefreshKey((k) => k + 1);
      }
    });
  }, []);

  // 通知履歴の取得（refreshKey は更新ボタン押下時の再フェッチトリガー）
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey intentionally triggers re-fetch
  useEffect(() => {
    if (activeTab !== 'history') return;
    setHistoryState({ status: 'loading' });
    window.electronAPI
      .getNotificationHistory()
      .then((records) => setHistoryState({ status: 'success', records }))
      .catch((err) => setHistoryState({ status: 'error', message: String(err) }));
  }, [activeTab, refreshKey]);

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
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* タブバー */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #eee',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        {(['settings', 'history'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '14px 20px 12px',
              fontSize: 14,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #6B4EE6' : '2px solid transparent',
              color: activeTab === tab ? '#6B4EE6' : '#666',
              fontWeight: activeTab === tab ? 700 : 400,
              marginBottom: -2,
            }}
          >
            {tab === 'settings' ? '設定' : '通知履歴'}
          </button>
        ))}
      </div>

      {/* 設定タブ */}
      {activeTab === 'settings' && (
        <div style={{ padding: '24px 24px 40px', overflowY: 'auto' }}>
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

          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
            <legend style={{ marginBottom: 6, fontSize: 14, fontWeight: 600, padding: 0 }}>
              表示位置
            </legend>
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
          </fieldset>

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
      )}

      {/* 通知履歴タブ */}
      {activeTab === 'history' && (
        <div
          style={{
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13, color: '#666' }}>最新30件（新しい順）</span>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                borderRadius: 4,
                border: '1px solid #6B4EE6',
                background: 'none',
                color: '#6B4EE6',
                cursor: 'pointer',
              }}
            >
              更新
            </button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {historyState.status === 'loading' && (
              <div style={{ textAlign: 'center', color: '#999', padding: 32, fontSize: 14 }}>
                読み込み中...
              </div>
            )}

            {historyState.status === 'error' && (
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 13, color: '#e53935', marginBottom: 8 }}>
                  取得エラー: {historyState.message}
                </div>
                <button
                  type="button"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                >
                  再試行
                </button>
              </div>
            )}

            {historyState.status === 'success' && historyState.records.length === 0 && (
              <div style={{ textAlign: 'center', color: '#999', padding: 32, fontSize: 14 }}>
                通知履歴がありません
              </div>
            )}

            {historyState.status === 'success' &&
              historyState.records.map((record) => (
                <div
                  key={record.unixMs}
                  style={{
                    padding: '12px 14px',
                    marginBottom: 8,
                    borderRadius: 8,
                    border: '1px solid #e8e4f8',
                    background: '#fafafa',
                  }}
                >
                  {/* アプリ名 + 通知ステータス + 日時 */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: record.sender !== record.appName || record.body ? 4 : 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: '#888',
                          fontWeight: 600,
                        }}
                      >
                        {record.appName}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 5px',
                          borderRadius: 8,
                          background: record.displayedByApp ? '#E8F5E9' : '#FFF3E0',
                          color: record.displayedByApp ? '#388E3C' : '#E65100',
                          fontWeight: 600,
                        }}
                      >
                        {record.displayedByApp ? '通知済み' : '未通知'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#bbb' }}>{record.timestamp}</span>
                  </div>

                  {/* タイトル（sender が appName と異なる場合のみ表示） */}
                  {record.sender !== record.appName && (
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#6B4EE6',
                        marginBottom: record.body ? 4 : 0,
                      }}
                    >
                      {record.sender}
                    </div>
                  )}

                  {/* 本文 */}
                  {record.body && (
                    <div style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>
                      {record.body}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
