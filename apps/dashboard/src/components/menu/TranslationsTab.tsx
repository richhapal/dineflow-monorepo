'use client';
import { useState } from 'react';
import { useTranslations, useUpdateTranslation } from '@/hooks/useMenu';
import type { MenuTranslation } from '@dineflow/types';

const ALL_LANGUAGES = [
  { code: 'en', name: 'English',   flag: '🇬🇧', rtl: false },
  { code: 'hi', name: 'हिन्दी',   flag: '🇮🇳', rtl: false },
  { code: 'kn', name: 'ಕನ್ನಡ',    flag: '🇮🇳', rtl: false },
  { code: 'ta', name: 'தமிழ்',    flag: '🇮🇳', rtl: false },
  { code: 'te', name: 'తెలుగు',   flag: '🇮🇳', rtl: false },
  { code: 'mr', name: 'मराठी',    flag: '🇮🇳', rtl: false },
  { code: 'de', name: 'Deutsch',   flag: '🇩🇪', rtl: false },
  { code: 'ru', name: 'Русский',   flag: '🇷🇺', rtl: false },
  { code: 'he', name: 'עברית',     flag: '🇮🇱', rtl: true  },
  { code: 'ar', name: 'العربية',   flag: '🇸🇦', rtl: true  },
  { code: 'ja', name: '日本語',    flag: '🇯🇵', rtl: false },
];

interface Props {
  itemId: string | undefined;
}

function statusBadge(trans: MenuTranslation | undefined, isBase: boolean) {
  if (isBase) return null;
  if (!trans) return (
    <span style={{ background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 100, fontFamily: "'Geist', sans-serif" }}>
      ⚠ Missing
    </span>
  );
  if (trans.is_ai) return (
    <span style={{ background: 'var(--green-bg)', color: 'var(--green)', fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 100, fontFamily: "'Geist', sans-serif" }}>
      ✓ AI
    </span>
  );
  return (
    <span style={{ background: 'var(--blue-bg)', color: 'var(--blue)', fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 100, fontFamily: "'Geist', sans-serif" }}>
      ✓ Edited
    </span>
  );
}

export function TranslationsTab({ itemId }: Props) {
  const { data: translations, isLoading } = useTranslations(itemId ?? null);
  const updateTranslation = useUpdateTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ name: '', description: '' });

  const getTranslation = (code: string): MenuTranslation | undefined =>
    translations?.find(t => t.lang_code === code);

  const startEdit = (code: string) => {
    const t = getTranslation(code);
    setEditValue({ name: t?.name || '', description: t?.description || '' });
    setEditing(code);
  };

  const saveEdit = (code: string, _rtl?: boolean) => {
    if (!itemId) return;
    updateTranslation.mutate({
      itemId,
      lang: code,
      name: editValue.name,
      description: editValue.description,
    }, { onSuccess: () => setEditing(null) });
  };

  if (!itemId) {
    return (
      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)', textAlign: 'center', padding: '24px 0' }}>
        Save the item first to manage translations.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: 44, borderRadius: 6, background: 'linear-gradient(90deg,var(--paper3) 25%,var(--paper2) 50%,var(--paper3) 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
        ))}
        <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
      </div>
    );
  }

  return (
    <div>
      {ALL_LANGUAGES.map(lang => {
        const trans = getTranslation(lang.code);
        const isBase = lang.code === 'en';
        const isEditing = editing === lang.code;

        return (
          <div key={lang.code} style={{ display: 'flex', alignItems: isEditing ? 'flex-start' : 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{lang.flag}</span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink)', width: 80, flexShrink: 0 }}>{lang.name}</span>

            {isEditing ? (
              <div style={{ flex: 1 }}>
                <input
                  dir={lang.rtl ? 'rtl' : 'ltr'}
                  value={editValue.name}
                  placeholder="Name"
                  autoFocus
                  onChange={e => setEditValue(p => ({ ...p, name: e.target.value }))}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontFamily: "'Geist', sans-serif", fontSize: 13, outline: 'none', marginBottom: 6 }}
                />
                <input
                  dir={lang.rtl ? 'rtl' : 'ltr'}
                  value={editValue.description}
                  placeholder="Description (optional)"
                  onChange={e => setEditValue(p => ({ ...p, description: e.target.value }))}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontFamily: "'Geist', sans-serif", fontSize: 13, outline: 'none', marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => saveEdit(lang.code, lang.rtl)}
                    disabled={updateTranslation.isPending}
                    style={{ padding: '5px 12px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 6, fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer' }}
                  >
                    {updateTranslation.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setEditing(null)}
                    style={{ padding: '5px 12px', border: '1px solid var(--border2)', borderRadius: 6, background: 'transparent', fontFamily: "'Geist', sans-serif", fontSize: 12, cursor: 'pointer', color: 'var(--ink3)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span style={{
                  flex: 1, fontFamily: "'Geist', sans-serif", fontSize: 13, color: trans ? 'var(--ink3)' : 'var(--ink5)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  direction: lang.rtl ? 'rtl' : 'ltr',
                  fontStyle: !trans && !isBase ? 'italic' : 'normal',
                }}>
                  {trans?.name || (isBase ? '—' : 'Not translated')}
                </span>
                {statusBadge(trans, isBase)}
                {!isBase && (
                  <button type="button" onClick={() => startEdit(lang.code)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: "'Geist', sans-serif", fontSize: 12, flexShrink: 0 }}>
                    Edit
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink5)', marginTop: 16 }}>
        AI translations are generated automatically when you save the item.
      </p>
    </div>
  );
}
