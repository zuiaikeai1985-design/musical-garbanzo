import React from 'react';
import { Shield, ShieldAlert, Crosshair, DollarSign, Bomb, Flame, Award } from 'lucide-react';
import { BombState, GameState, KillfeedEntry, PlayerStats, ScoreboardPlayer, Team, WeaponSlotState } from './game/types';
import { soundManager } from './game/SoundManager';

interface HUDProps {
  stats: PlayerStats;
  weapon: WeaponSlotState | null;
  activeSlot: number;
  gameState: GameState;
  roundTimer: number;
  scoreCT: number;
  scoreT: number;
  playerTeam: Team;
  killfeed: KillfeedEntry[];
  bombState: BombState;
  isScoped: boolean;
  flashOpacity: number;
  bannerMessage: string | null;
  showScoreboard: boolean;
  scoreboard: ScoreboardPlayer[];
  showBuyMenu: boolean;
  onCloseBuyMenu: () => void;
  onBuyItem: (id: string) => void;
  onRestartRound: () => void;
  onToggleSound: () => void;
  isMuted: boolean;
  playerPos: { x: number; z: number; yaw: number };
  bots: { id: string; x: number; z: number; team: Team; isAlive: boolean }[];
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  weapon,
  activeSlot,
  gameState,
  roundTimer,
  scoreCT,
  scoreT,
  playerTeam,
  killfeed,
  bombState,
  isScoped,
  flashOpacity,
  bannerMessage,
  showScoreboard,
  scoreboard,
  showBuyMenu,
  onCloseBuyMenu,
  onBuyItem,
  onRestartRound,
  onToggleSound,
  isMuted,
  playerPos,
  bots,
}) => {
  // Format MM:SS timer
  const minutes = Math.floor(roundTimer / 60);
  const seconds = roundTimer % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* 1. Flashbang Whiteout Overlay */}
      {flashOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#ffffff',
            opacity: flashOpacity,
            pointerEvents: 'none',
            zIndex: 100,
            transition: 'opacity 0.1s ease-out',
          }}
        />
      )}

      {/* 2. Sniper Scope Overlay */}
      {isScoped && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          {/* Black circle vignette border */}
          <div
            style={{
              width: '100vw',
              height: '100vh',
              background: 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.95) 48%, #000000 70%)',
              position: 'relative',
            }}
          >
            {/* Scope Crosshair Lines */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, background: 'rgba(0,0,0,0.85)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'rgba(0,0,0,0.85)' }} />
            {/* Range markers */}
            <div style={{ position: 'absolute', left: '48%', right: '48%', top: '55%', height: 1, background: 'rgba(0,0,0,0.7)' }} />
            <div style={{ position: 'absolute', left: '48.5%', right: '48.5%', top: '60%', height: 1, background: 'rgba(0,0,0,0.7)' }} />
          </div>
        </div>
      )}

      {/* 3. Normal Crosshair (if not scoped) */}
      {!isScoped && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          {/* CS Classic Green Dynamic Crosshair */}
          <div style={{ position: 'absolute', width: 2, height: 10, top: -14, left: -1, backgroundColor: '#22c55e', boxShadow: '0 0 2px #000' }} />
          <div style={{ position: 'absolute', width: 2, height: 10, top: 4, left: -1, backgroundColor: '#22c55e', boxShadow: '0 0 2px #000' }} />
          <div style={{ position: 'absolute', width: 10, height: 2, left: -14, top: -1, backgroundColor: '#22c55e', boxShadow: '0 0 2px #000' }} />
          <div style={{ position: 'absolute', width: 10, height: 2, left: 4, top: -1, backgroundColor: '#22c55e', boxShadow: '0 0 2px #000' }} />
          <div style={{ position: 'absolute', width: 2, height: 2, left: -1, top: -1, backgroundColor: '#22c55e' }} />
        </div>
      )}

      {/* 4. Top Header / Match Bar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: '8px 24px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* CT Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8' }}>CT</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: '#38bdf8' }}>{scoreCT}</span>
        </div>

        {/* Round Timer & C4 Indicator */}
        <div
          style={{
            padding: '4px 16px',
            background: bombState.isPlanted ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0,0,0,0.4)',
            border: bombState.isPlanted ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.05)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 80,
            justifyContent: 'center',
          }}
        >
          {bombState.isPlanted && <Bomb size={16} color="#ef4444" className="animate-pulse" />}
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: bombState.isPlanted ? '#ef4444' : '#f8fafc',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {timeFormatted}
          </span>
        </div>

        {/* T Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>{scoreT}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>T</span>
        </div>
      </div>

      {/* 5. Mini-map (Top-Left Radar) */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '2px solid rgba(255,255,255,0.2)',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        {/* Radar concentric rings */}
        <div style={{ position: 'absolute', inset: 15, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', inset: 35, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.1)' }} />

        {/* Bomb site labels on radar */}
        <span style={{ position: 'absolute', top: 32, right: 30, fontSize: 11, fontWeight: 800, color: '#ef4444' }}>A</span>
        <span style={{ position: 'absolute', top: 32, left: 30, fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>B</span>

        {/* Player Center Blip */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#22c55e',
            transform: `translate(-50%, -50%) rotate(${playerPos.yaw}rad)`,
            boxShadow: '0 0 6px #22c55e',
          }}
        >
          {/* Heading arrow */}
          <div
            style={{
              position: 'absolute',
              top: -6,
              left: 2,
              width: 0,
              height: 0,
              borderLeft: '2px solid transparent',
              borderRight: '2px solid transparent',
              borderBottom: '6px solid #22c55e',
            }}
          />
        </div>

        {/* Bot Blips */}
        {bots.filter(b => b.isAlive).map(b => {
          const dx = (b.x - playerPos.x) * 1.5;
          const dz = (b.z - playerPos.z) * 1.5;
          const mapX = 70 + dx;
          const mapY = 70 + dz;

          if (mapX < 5 || mapX > 135 || mapY < 5 || mapY > 135) return null;

          const isTeammate = b.team === playerTeam;
          return (
            <div
              key={b.id}
              style={{
                position: 'absolute',
                top: mapY,
                left: mapX,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isTeammate ? '#38bdf8' : '#ef4444',
                transform: 'translate(-50%, -50%)',
                boxShadow: isTeammate ? '0 0 4px #38bdf8' : '0 0 4px #ef4444',
              }}
            />
          );
        })}
      </div>

      {/* 6. Killfeed (Top-Right) */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-end',
        }}
      >
        {killfeed.slice(-5).map(entry => {
          const isKillerPlayer = entry.killer.includes('Player');
          const isVictimPlayer = entry.victim.includes('Player');

          return (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(15, 23, 42, 0.85)',
                padding: '4px 12px',
                borderRadius: 4,
                border: isKillerPlayer ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.05)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span style={{ color: entry.killerTeam === 'CT' ? '#38bdf8' : '#f59e0b' }}>
                {entry.killer}
              </span>

              {/* Weapon badge */}
              <span
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: 11,
                  color: '#e2e8f0',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                {entry.weapon}
              </span>

              {entry.isHeadshot && (
                <span title="爆头击杀" style={{ color: '#ef4444', fontSize: 13, fontWeight: 900 }}>
                  [HS]
                </span>
              )}

              <span style={{ color: entry.victimTeam === 'CT' ? '#38bdf8' : '#f59e0b' }}>
                {entry.victim}
              </span>
            </div>
          );
        })}
      </div>

      {/* 7. Center Banner Notice (Planting, Defusing, Round Win/Loss) */}
      {bannerMessage && (
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '2px solid #eab308',
            padding: '12px 32px',
            borderRadius: 8,
            boxShadow: '0 0 24px rgba(234, 179, 8, 0.4)',
            fontSize: 22,
            fontWeight: 800,
            color: '#f8fafc',
            textAlign: 'center',
            letterSpacing: 1,
          }}
        >
          {bannerMessage}
        </div>
      )}

      {/* 8. Action Progress Bar (Planting / Defusing) */}
      {(stats.isPlanting || stats.isDefusing) && (
        <div
          style={{
            position: 'absolute',
            bottom: '22%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', textShadow: '0 2px 4px #000' }}>
            {stats.isPlanting ? '正在安装 C4 炸药包...' : '正在拆除 C4 炸药包...'}
          </span>
          <div
            style={{
              width: 240,
              height: 12,
              background: 'rgba(0,0,0,0.6)',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div
              style={{
                width: `${(stats.isPlanting ? bombState.plantProgress : bombState.defuseProgress) * 100}%`,
                height: '100%',
                background: stats.isPlanting ? '#ef4444' : '#38bdf8',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        </div>
      )}

      {/* 9. Bottom HUD Bar (Health, Armor, Money, Weapon Ammo) */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        {/* Left Side: Health & Armor & Money */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {/* Health */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ color: stats.health > 25 ? '#22c55e' : '#ef4444', fontWeight: 900, fontSize: 20 }}>+</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>HEALTH</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: stats.health > 25 ? '#f8fafc' : '#ef4444', lineHeight: 1 }}>
                {Math.max(0, stats.health)}
              </span>
            </div>
          </div>

          {/* Armor */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Shield size={20} color="#38bdf8" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>ARMOR</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', lineHeight: 1 }}>
                {stats.armor}
              </span>
            </div>
          </div>

          {/* Money */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(15, 23, 42, 0.85)',
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <DollarSign size={20} color="#22c55e" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>MONEY</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>
                ${stats.money}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Weapon Ammo & Slots */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          {/* Quick slot indicators */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            {['1', '2', '3', '4'].map((key, i) => (
              <div
                key={key}
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 800,
                  background: activeSlot === i ? '#eab308' : 'rgba(15, 23, 42, 0.7)',
                  color: activeSlot === i ? '#000' : '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {key}
              </div>
            ))}
          </div>

          {/* Active Weapon Ammo Display */}
          {weapon && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                background: 'rgba(15, 23, 42, 0.85)',
                padding: '10px 22px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                minWidth: 140,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#eab308' }}>
                {weapon.config.name}
              </span>

              {weapon.config.category !== 'melee' && weapon.config.category !== 'utility' ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: '#f8fafc', lineHeight: 1 }}>
                    {weapon.currentAmmo}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#94a3b8' }}>
                    / {weapon.reserveAmmo}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 20, fontWeight: 800, color: '#94a3b8' }}>READY</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 10. Buy Menu Overlay (Press B) */}
      {showBuyMenu && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(11, 15, 25, 0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            zIndex: 80,
          }}
        >
          <div
            style={{
              width: '80%',
              maxWidth: 900,
              background: '#0f172a',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              padding: 24,
              boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc' }}>
                  武器装备购买菜单 (BUY MENU)
                </h2>
                <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  按 [B] 或点击关闭。当前余额: <span style={{ color: '#22c55e', fontWeight: 800 }}>${stats.money}</span>
                </p>
              </div>
              <button
                onClick={onCloseBuyMenu}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#f8fafc',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                关闭 (ESC / B)
              </button>
            </div>

            {/* Weapon Categories Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {/* Rifles */}
              <div style={{ background: '#1e293b', padding: 14, borderRadius: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8', marginBottom: 12 }}>
                  主武器 / 步枪 & 狙击
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <BuyButton
                    name="AK-47 突击步枪"
                    price={2700}
                    disabled={stats.money < 2700}
                    onClick={() => onBuyItem('ak47')}
                  />
                  <BuyButton
                    name="M4A4 突击步枪"
                    price={3100}
                    disabled={stats.money < 3100}
                    onClick={() => onBuyItem('m4a1')}
                  />
                  <BuyButton
                    name="AWP 重型狙击步枪"
                    price={4750}
                    disabled={stats.money < 4750}
                    onClick={() => onBuyItem('awp')}
                  />
                  <BuyButton
                    name="MP5-SD 冲锋枪"
                    price={1500}
                    disabled={stats.money < 1500}
                    onClick={() => onBuyItem('mp5')}
                  />
                </div>
              </div>

              {/* Pistols */}
              <div style={{ background: '#1e293b', padding: 14, borderRadius: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b', marginBottom: 12 }}>
                  手枪 / 次要武器
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <BuyButton
                    name="Desert Eagle 沙漠之鹰"
                    price={700}
                    disabled={stats.money < 700}
                    onClick={() => onBuyItem('deagle')}
                  />
                  <BuyButton
                    name="Glock-18 格洛克"
                    price={200}
                    disabled={stats.money < 200}
                    onClick={() => onBuyItem('glock')}
                  />
                </div>
              </div>

              {/* Gear & Grenades */}
              <div style={{ background: '#1e293b', padding: 14, borderRadius: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#22c55e', marginBottom: 12 }}>
                  战术装备 & 投掷物
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <BuyButton
                    name="防弹背心 (Kevlar)"
                    price={650}
                    disabled={stats.money < 650}
                    onClick={() => onBuyItem('kevlar')}
                  />
                  <BuyButton
                    name="防弹头盔 + 护甲 (Helmet)"
                    price={1000}
                    disabled={stats.money < 1000}
                    onClick={() => onBuyItem('helmet')}
                  />
                  <BuyButton
                    name="拆弹工具组 (Defuse Kit)"
                    price={400}
                    disabled={stats.money < 400 || playerTeam !== 'CT'}
                    onClick={() => onBuyItem('defuser')}
                  />
                  <BuyButton
                    name="高爆手雷 (HE Grenade)"
                    price={300}
                    disabled={stats.money < 300}
                    onClick={() => onBuyItem('hegrenade')}
                  />
                  <BuyButton
                    name="闪光震撼弹 (Flashbang)"
                    price={200}
                    disabled={stats.money < 200}
                    onClick={() => onBuyItem('flashbang')}
                  />
                  <BuyButton
                    name="战术烟雾弹 (Smoke Grenade)"
                    price={300}
                    disabled={stats.money < 300}
                    onClick={() => onBuyItem('smokegrenade')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. Scoreboard (Press TAB) */}
      {showScoreboard && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(11, 15, 25, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
          }}
        >
          <div
            style={{
              width: '75%',
              maxWidth: 850,
              background: '#0f172a',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              padding: 20,
              boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc' }}>
                Dust II 竞技匹配计分板
              </span>
              <span style={{ fontSize: 14, color: '#94a3b8' }}>按住 [TAB] 查看</span>
            </div>

            {/* CT Team Table */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  padding: '6px 12px',
                  borderRadius: '6px 6px 0 0',
                  color: '#38bdf8',
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                反恐精英 (CT) - 得分: {scoreCT}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: 8 }}>玩家 / BOT</th>
                    <th style={{ padding: 8 }}>击杀 (K)</th>
                    <th style={{ padding: 8 }}>阵亡 (D)</th>
                    <th style={{ padding: 8 }}>积分</th>
                    <th style={{ padding: 8 }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreboard.filter(p => p.team === 'CT').map(p => (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: p.id === 'player' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        color: p.isAlive ? '#f8fafc' : '#64748b',
                      }}
                    >
                      <td style={{ padding: 8, fontWeight: 700 }}>{p.name}</td>
                      <td style={{ padding: 8 }}>{p.kills}</td>
                      <td style={{ padding: 8 }}>{p.deaths}</td>
                      <td style={{ padding: 8 }}>{p.score}</td>
                      <td style={{ padding: 8 }}>{p.isAlive ? '存活' : '阵亡'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* T Team Table */}
            <div>
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  padding: '6px 12px',
                  borderRadius: '6px 6px 0 0',
                  color: '#f59e0b',
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                恐怖分子 (T) - 得分: {scoreT}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: 8 }}>玩家 / BOT</th>
                    <th style={{ padding: 8 }}>击杀 (K)</th>
                    <th style={{ padding: 8 }}>阵亡 (D)</th>
                    <th style={{ padding: 8 }}>积分</th>
                    <th style={{ padding: 8 }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreboard.filter(p => p.team === 'T').map(p => (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: p.id === 'player' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        color: p.isAlive ? '#f8fafc' : '#64748b',
                      }}
                    >
                      <td style={{ padding: 8, fontWeight: 700 }}>{p.name}</td>
                      <td style={{ padding: 8 }}>{p.kills}</td>
                      <td style={{ padding: 8 }}>{p.deaths}</td>
                      <td style={{ padding: 8 }}>{p.score}</td>
                      <td style={{ padding: 8 }}>{p.isAlive ? '存活' : '阵亡'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface BuyButtonProps {
  name: string;
  price: number;
  disabled: boolean;
  onClick: () => void;
}

const BuyButton: React.FC<BuyButtonProps> = ({ name, price, disabled, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        color: disabled ? '#64748b' : '#f8fafc',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
        transition: 'all 0.15s ease',
      }}
    >
      <span>{name}</span>
      <span style={{ color: disabled ? '#64748b' : '#22c55e', fontWeight: 800 }}>${price}</span>
    </button>
  );
};
