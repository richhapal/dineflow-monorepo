'use client';
import { useState, useEffect } from 'react';
import { useUpdateItem } from '@/hooks/useMenu';
import type { AddonGroup, Addon } from '@dineflow/types';

interface Props {
  itemId: string | undefined;
  addonGroups: AddonGroup[];
}

type LocalAddon = Omit<Addon, 'group_id'> & { group_id?: string };
type LocalGroup = Omit<AddonGroup, 'item_id' | 'addons'> & { item_id?: string; addons: LocalAddon[]; open: boolean };

function newGroup(_len?: number): LocalGroup {
  return {
    id: `g-${Math.random().toString(36).slice(2)}`,
    name: '',
    is_required: false,
    min_select: 0,
    max_select: 1,
    addons: [],
    open: true,
  };
}

function newAddon(groupId: string): LocalAddon {
  return {
    id: `a-${Math.random().toString(36).slice(2)}`,
    group_id: groupId,
    name: '',
    price: 0,
    is_available: true,
  };
}

export function AddonsSection({ itemId, addonGroups }: Props) {
  const [groups, setGroups] = useState<LocalGroup[]>(() =>
    addonGroups.map(g => ({ ...g, open: false }))
  );
  const updateItem = useUpdateItem();

  useEffect(() => {
    setGroups(addonGroups.map(g => ({ ...g, open: false })));
  }, [addonGroups]);

  const save = (updated: LocalGroup[]) => {
    if (!itemId) return;
    updateItem.mutate({ id: itemId, addon_groups: updated as unknown as AddonGroup[] });
  };

  const toggleOpen = (id: string) =>
    setGroups(prev => prev.map(g => g.id === id ? { ...g, open: !g.open } : g));

  const updateGroup = (id: string, field: keyof LocalGroup, value: string | number | boolean) =>
    setGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));

  const removeGroup = (id: string) => {
    const next = groups.filter(g => g.id !== id);
    setGroups(next);
    save(next);
  };

  const addGroup = () => setGroups(prev => [...prev, newGroup(prev.length)]);

  const addAddon = (groupId: string) =>
    setGroups(prev => prev.map(g => g.id === groupId
      ? { ...g, addons: [...g.addons, newAddon(groupId)] }
      : g
    ));

  const updateAddon = (groupId: string, addonId: string, field: keyof LocalAddon, value: string | number) =>
    setGroups(prev => prev.map(g => g.id === groupId
      ? { ...g, addons: g.addons.map(a => a.id === addonId ? { ...a, [field]: value } : a) }
      : g
    ));

  const removeAddon = (groupId: string, addonId: string) => {
    const next = groups.map(g => g.id === groupId
      ? { ...g, addons: g.addons.filter(a => a.id !== addonId) }
      : g
    );
    setGroups(next);
    save(next);
  };

  return (
    <div>
      <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 14 }}>
        Customisation groups
      </p>

      {groups.map(group => (
        <div key={group.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
          {/* Group header */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--paper2)', cursor: 'pointer' }}
          >
            <div onClick={() => toggleOpen(group.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                value={group.name}
                placeholder="e.g. Spice level"
                onClick={e => e.stopPropagation()}
                onChange={e => updateGroup(group.id, 'name', e.target.value)}
                onBlur={() => save(groups)}
                style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 500, outline: 'none', background: '#fff' }}
              />
            </div>

            {/* Required toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink4)' }}>Required</span>
              <div
                onClick={() => { updateGroup(group.id, 'is_required', !group.is_required); setTimeout(() => save(groups), 0); }}
                style={{
                  width: 30, height: 16, borderRadius: 8, cursor: 'pointer',
                  background: group.is_required ? '#2D7A4A' : 'var(--border2)',
                  position: 'relative', transition: 'background .2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2,
                  left: group.is_required ? 14 : 2,
                  width: 12, height: 12, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s',
                }} />
              </div>
            </div>

            {/* Min/max */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink5)' }}>Min</span>
              <input type="number" min={0} max={10} value={group.min_select}
                onChange={e => updateGroup(group.id, 'min_select', parseInt(e.target.value) || 0)}
                onBlur={() => save(groups)}
                style={{ width: 36, border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', fontFamily: "'Geist Mono', monospace", fontSize: 12, textAlign: 'center', outline: 'none' }}
              />
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 11, color: 'var(--ink5)' }}>Max</span>
              <input type="number" min={1} max={10} value={group.max_select}
                onChange={e => updateGroup(group.id, 'max_select', parseInt(e.target.value) || 1)}
                onBlur={() => save(groups)}
                style={{ width: 36, border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', fontFamily: "'Geist Mono', monospace", fontSize: 12, textAlign: 'center', outline: 'none' }}
              />
            </div>

            <button type="button" onClick={() => toggleOpen(group.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink4)', fontSize: 12 }}>
              {group.open ? '▲' : '▼'}
            </button>
            <button type="button" onClick={() => removeGroup(group.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink5)', fontSize: 16 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink5)')}
            >×</button>
          </div>

          {/* Group body */}
          {group.open && (
            <div style={{ padding: '10px 14px' }}>
              {group.addons.map(addon => (
                <div key={addon.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 28px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    value={addon.name}
                    placeholder="Option name"
                    onChange={e => updateAddon(group.id, addon.id, 'name', e.target.value)}
                    onBlur={() => save(groups)}
                    style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontFamily: "'Geist', sans-serif", fontSize: 13, outline: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    <span style={{ padding: '6px 7px', background: 'var(--paper2)', fontFamily: "'Geist Mono', monospace", fontSize: 12, borderRight: '1px solid var(--border)' }}>₹</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={addon.price}
                      onChange={e => updateAddon(group.id, addon.id, 'price', parseFloat(e.target.value) || 0)}
                      onBlur={() => save(groups)}
                      style={{ flex: 1, border: 'none', padding: '6px 7px', fontFamily: "'Geist Mono', monospace", fontSize: 12, outline: 'none', width: 0 }}
                    />
                  </div>
                  <button type="button" onClick={() => removeAddon(group.id, addon.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink5)', fontSize: 15 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink5)')}
                  >×</button>
                </div>
              ))}
              <button type="button" onClick={() => addAddon(group.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: "'Geist', sans-serif", fontSize: 12, padding: 0 }}>
                + Add option
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addGroup}
        style={{
          width: '100%', border: '1px dashed var(--border2)', borderRadius: 8,
          padding: 9, background: 'transparent', cursor: 'pointer',
          fontFamily: "'Geist', sans-serif", fontSize: 13, color: 'var(--ink4)',
          transition: 'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--ink4)'; e.currentTarget.style.background = 'transparent'; }}
      >
        + Add customisation group (e.g. Spice level, Extra toppings)
      </button>
    </div>
  );
}
