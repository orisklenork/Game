import React, { useState } from 'react';
import { ArrowUpCircle, Check, Coins, X } from 'lucide-react';
import {
  CUSTOMIZATION_ITEMS,
  CustomizationCategory,
  getWeaponStatsAtLevel,
  getWeaponUpgradeCost,
  WEAPON_ORDER,
  WEAPONS,
  WeaponId,
} from '../shared/gameData';
import { apiFetch, PlayerProfile } from '../lib/api';
import { audioEngine } from '../game/audio';
import { CharacterPreview3D } from './CharacterPreview3D';

interface Props {
  initialTab: 'shop' | 'customize' | 'inventory';
  profile: PlayerProfile;
  onProfileUpdated: (p: PlayerProfile) => void;
  onClose: () => void;
}

const CUSTOM_CATEGORIES: Array<{ id: CustomizationCategory; label: string }> = [
  { id: 'shirt', label: 'Shirts' },
  { id: 'outfit', label: 'Outfits' },
  { id: 'skin', label: 'Skins' },
  { id: 'mask', label: 'Masks' },
  { id: 'gloves', label: 'Gloves' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'costume', label: 'Costumes' },
  { id: 'weapon_skin', label: 'Weapon Skins' },
];

export function ShopAndCustomize({ initialTab, profile, onProfileUpdated, onClose }: Props) {
  const [tab, setTab] = useState<'shop' | 'customize' | 'inventory'>(initialTab);
  const [customCat, setCustomCat] = useState<CustomizationCategory>('mask');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; error?: boolean } | null>(null);

  const notify = (msg: string, error = false) => {
    setFeedback({ msg, error });
    setTimeout(() => setFeedback(null), 2600);
  };

  const handleWeaponAction = async (weaponId: WeaponId, action: 'buy' | 'upgrade' | 'equip') => {
    if (busy) return;
    audioEngine.playUiClick();
    setBusy(true);
    try {
      const data = await apiFetch<{ profile: PlayerProfile }>(`/api/shop/weapon/${action}`, {
        method: 'POST',
        body: JSON.stringify({ weaponId }),
      });
      onProfileUpdated(data.profile);
      notify(
        action === 'buy'
          ? `Unlocked ${WEAPONS[weaponId].name}`
          : action === 'upgrade'
          ? `Upgraded ${WEAPONS[weaponId].name}`
          : `Equipped ${WEAPONS[weaponId].name}`
      );
    } catch (err: any) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  };

  const handleCustomAction = async (itemId: string, owned: boolean) => {
    if (busy) return;
    audioEngine.playUiClick();
    setBusy(true);
    try {
      const endpoint = owned ? '/api/shop/customization/equip' : '/api/shop/customization/buy';
      const data = await apiFetch<{ profile: PlayerProfile }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ itemId }),
      });
      onProfileUpdated(data.profile);
      notify(owned ? 'Appearance updated' : 'Item purchased & equipped');
    } catch (err: any) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  };

  const categoryItems = CUSTOMIZATION_ITEMS.filter((i) => i.category === customCat);
  const ownedCustomItems = CUSTOMIZATION_ITEMS.filter((i) => profile.customizations.includes(i.id));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-6xl bg-[#0d1118] border border-slate-700/40 rounded-xl p-6 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {(
              [
                ['shop', 'Weapon Shop'],
                ['customize', 'Character Customization'],
                ['inventory', 'Inventory'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  audioEngine.playUiClick();
                  setTab(id);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === id ? 'bg-red-600 text-white' : 'bg-[#131924] text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-amber-400 font-mono-num font-semibold text-base">
              <Coins className="w-4 h-4" />
              <span>{profile.coins.toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-3 px-4 py-2 rounded-lg text-xs font-medium ${
              feedback.error
                ? 'bg-red-950/70 border border-red-700/60 text-red-200'
                : 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-200'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto mt-5 pr-1">
          {tab === 'shop' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {WEAPON_ORDER.map((wid) => {
                const ownedInfo = profile.weapons[wid];
                const level = ownedInfo?.upgradeLevel || 1;
                const stats = getWeaponStatsAtLevel(wid, level);
                const isEquipped = profile.equippedWeapon === wid;
                const upgradeCost = getWeaponUpgradeCost(level);

                return (
                  <div
                    key={wid}
                    className={`bg-[#131924] border rounded-xl p-4 flex flex-col justify-between ${
                      isEquipped ? 'border-red-500/80' : 'border-slate-700/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-slate-400">{stats.category}</div>
                          <h3 className="font-display text-lg font-bold text-slate-100">{stats.name}</h3>
                        </div>
                        {ownedInfo && (
                          <span className="font-mono-num text-xs text-amber-400 font-semibold">
                            Mk.{level}/5
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{stats.description}</p>

                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs">
                        <div>
                          <div className="text-slate-500">Damage</div>
                          <div className="font-mono-num font-semibold text-slate-200">
                            {stats.damage}
                            {stats.pellets > 1 ? `×${stats.pellets}` : ''}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Fire Rate</div>
                          <div className="font-mono-num font-semibold text-slate-200">{stats.fireRate}/s</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Magazine</div>
                          <div className="font-mono-num font-semibold text-slate-200">{stats.magSize}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
                      {!ownedInfo ? (
                        <button
                          onClick={() => handleWeaponAction(wid, 'buy')}
                          disabled={busy || profile.coins < stats.cost}
                          className="w-full py-2 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-semibold text-white cursor-pointer"
                        >
                          Unlock · {stats.cost} Coins
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleWeaponAction(wid, 'equip')}
                            disabled={isEquipped || busy}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                              isEquipped
                                ? 'bg-emerald-800/60 text-emerald-200 cursor-default'
                                : 'bg-red-600 hover:bg-red-500 text-white'
                            }`}
                          >
                            {isEquipped ? 'Equipped' : 'Equip'}
                          </button>
                          {level < 5 && (
                            <button
                              onClick={() => handleWeaponAction(wid, 'upgrade')}
                              disabled={busy || profile.coins < upgradeCost}
                              className="flex items-center gap-1 py-2 px-3 rounded-lg bg-[#0d1118] border border-slate-600 hover:border-amber-500 disabled:opacity-40 text-xs text-amber-300 cursor-pointer"
                            >
                              <ArrowUpCircle className="w-3.5 h-3.5" />
                              <span className="font-mono-num">{upgradeCost}c</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'customize' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Live 3D Character Preview */}
              <div className="lg:col-span-5 bg-[#090d14] border border-slate-800 rounded-xl h-[380px] lg:h-[460px] overflow-hidden">
                <CharacterPreview3D
                  loadout={profile.equippedLoadout}
                  weaponId={profile.equippedWeapon}
                  className="w-full h-full"
                />
              </div>

              {/* Category Tabs & Items */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {CUSTOM_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        audioEngine.playUiClick();
                        setCustomCat(cat.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                        customCat === cat.id
                          ? 'bg-red-600 text-white'
                          : 'bg-[#131924] border border-slate-700/40 text-slate-300 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categoryItems.map((item) => {
                    const owned = profile.customizations.includes(item.id);
                    const equipped = profile.equippedLoadout[item.category] === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`bg-[#131924] border rounded-lg p-3.5 flex flex-col justify-between ${
                          equipped ? 'border-red-500' : 'border-slate-700/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-4 h-4 rounded border border-white/20 shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="font-semibold text-sm text-slate-100">{item.name}</span>
                            </div>
                            {equipped && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5">{item.description}</p>
                        </div>

                        <button
                          onClick={() => handleCustomAction(item.id, owned)}
                          disabled={equipped || busy || (!owned && profile.coins < item.cost)}
                          className={`mt-3 w-full py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                            equipped
                              ? 'bg-emerald-800/40 text-emerald-200 cursor-default'
                              : owned
                              ? 'bg-slate-700 hover:bg-slate-600 text-white'
                              : 'bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white'
                          }`}
                        >
                          {equipped ? 'Equipped' : owned ? 'Equip' : `Buy · ${item.cost} Coins`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'inventory' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-200 mb-3">
                  Unlocked Weapons ({Object.keys(profile.weapons).length}/{WEAPON_ORDER.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.keys(profile.weapons).map((wid) => {
                    const w = WEAPONS[wid as WeaponId];
                    const lvl = profile.weapons[wid].upgradeLevel;
                    const eq = profile.equippedWeapon === wid;
                    return (
                      <div key={wid} className="bg-[#131924] border border-slate-700/40 rounded-lg p-3.5 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm text-slate-100">{w.name}</div>
                          <div className="text-xs text-slate-400">
                            {w.category} · Upgrade Mk.{lvl}
                          </div>
                        </div>
                        <button
                          onClick={() => handleWeaponAction(wid as WeaponId, 'equip')}
                          disabled={eq}
                          className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                            eq ? 'bg-emerald-800/50 text-emerald-200' : 'bg-red-600 hover:bg-red-500 text-white'
                          }`}
                        >
                          {eq ? 'Equipped' : 'Equip'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="font-display text-base font-semibold text-slate-200 mb-3">
                  Owned Gear & Skins ({ownedCustomItems.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {ownedCustomItems.map((item) => {
                    const eq = profile.equippedLoadout[item.category] === item.id;
                    return (
                      <div key={item.id} className="bg-[#131924] border border-slate-700/40 rounded-lg p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-4 h-4 rounded border border-white/20 shrink-0" style={{ backgroundColor: item.color }} />
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-100 truncate">{item.name}</div>
                            <div className="text-xs text-slate-400 capitalize">{item.category.replace('_', ' ')}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCustomAction(item.id, true)}
                          disabled={eq}
                          className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer shrink-0 ${
                            eq ? 'bg-emerald-800/50 text-emerald-200' : 'bg-slate-700 hover:bg-slate-600 text-white'
                          }`}
                        >
                          {eq ? 'Equipped' : 'Equip'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
