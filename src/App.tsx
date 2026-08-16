import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import { HUD } from './game/HUD';
import {
  BombState,
  GameState,
  KillfeedEntry,
  PlayerStats,
  ScoreboardPlayer,
  Team,
  WeaponSlotState,
} from './game/types';
import { soundManager } from './game/SoundManager';
import { Volume2, VolumeX, RotateCcw, Shield, Users, Crosshair, HelpCircle } from 'lucide-react';

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Game UI state
  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    maxHealth: 100,
    armor: 100,
    hasHelmet: true,
    money: 16000,
    kills: 0,
    deaths: 0,
    assists: 0,
    score: 0,
    hasDefuseKit: true,
  });

  const [weapon, setWeapon] = useState<WeaponSlotState | null>(null);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [gameState, setGameState] = useState<GameState>('in_round');
  const [roundTimer, setRoundTimer] = useState<number>(115);
  const [scoreCT, setScoreCT] = useState<number>(0);
  const [scoreT, setScoreT] = useState<number>(0);
  const [playerTeam, setPlayerTeam] = useState<Team>('CT');
  const [killfeed, setKillfeed] = useState<KillfeedEntry[]>([]);
  const [bombState, setBombState] = useState<BombState>({
    isPlanted: false,
    isDefused: false,
    isExploded: false,
    defuseProgress: 0,
    plantProgress: 0,
  });
  const [isScoped, setIsScoped] = useState<boolean>(false);
  const [flashOpacity, setFlashOpacity] = useState<number>(0);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [showScoreboard, setShowScoreboard] = useState<boolean>(false);
  const [scoreboard, setScoreboard] = useState<ScoreboardPlayer[]>([]);
  const [showBuyMenu, setShowBuyMenu] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [isStarted, setIsStarted] = useState<boolean>(false);

  // Radar coordinates
  const [playerPos, setPlayerPos] = useState({ x: 0, z: -45, yaw: 0 });
  const [botList, setBotList] = useState<{ id: string; x: number; z: number; team: Team; isAlive: boolean }[]>([]);

  useEffect(() => {
    if (!containerRef.current || !isStarted) return;

    const engine = new GameEngine(containerRef.current, {
      onStatsChange: (s) => setStats(s),
      onWeaponChange: (w, slot) => {
        setWeapon(w);
        setActiveSlot(slot);
      },
      onGameStateChange: (state, timer, ct, t) => {
        setGameState(state);
        setRoundTimer(timer);
        setScoreCT(ct);
        setScoreT(t);
      },
      onKillfeed: (entry) => {
        setKillfeed((prev) => [...prev, entry].slice(-8));
      },
      onScoreboardChange: (players) => setScoreboard(players),
      onBombStateChange: (b) => setBombState(b),
      onScopeChange: (scoped) => setIsScoped(scoped),
      onFlashbang: (intensity) => {
        setFlashOpacity(intensity);
        const interval = setInterval(() => {
          setFlashOpacity((prev) => {
            if (prev <= 0.05) {
              clearInterval(interval);
              return 0;
            }
            return prev - 0.04;
          });
        }, 50);
      },
      onMessage: (msg) => {
        setBannerMessage(msg);
        setTimeout(() => {
          setBannerMessage(null);
        }, 3500);
      },
    });

    engine.setTeam(playerTeam);
    engineRef.current = engine;

    // Radar position updater loop
    const radarInterval = setInterval(() => {
      if (engineRef.current) {
        setPlayerPos({
          x: engineRef.current.playerPos.x,
          z: engineRef.current.playerPos.z,
          yaw: engineRef.current.yaw,
        });
        setBotList(
          engineRef.current.bots.map((b) => ({
            id: b.id,
            x: b.position.x,
            z: b.position.z,
            team: b.team,
            isAlive: b.isAlive,
          }))
        );
      }
    }, 100);

    // Global Key Events for Buy Menu (B) & Scoreboard (Tab)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyB') {
        setShowBuyMenu((prev) => !prev);
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
      }
      if (e.code === 'Escape') {
        setShowBuyMenu(false);
        setShowHelpModal(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        setShowScoreboard(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      clearInterval(radarInterval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      engine.destroy();
    };
  }, [isStarted, playerTeam]);

  const handleBuyItem = (id: string) => {
    if (engineRef.current) {
      engineRef.current.buyItem(id);
    }
  };

  const handleToggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
  };

  const handleSwitchTeam = (team: Team) => {
    setPlayerTeam(team);
    if (engineRef.current) {
      engineRef.current.setTeam(team);
    }
  };

  const handleRestartRound = () => {
    if (engineRef.current) {
      engineRef.current.startRound();
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#000' }}>
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Intro / Lobby Screen */}
      {!isStarted && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, #0b0f19 0%, #1e293b 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 750,
              width: '100%',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 16,
              padding: '36px 40px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Crosshair size={36} color="#eab308" />
              <h1 style={{ fontSize: 36, fontWeight: 900, color: '#f8fafc', letterSpacing: 2 }}>
                COUNTER-STRIKE 3D
              </h1>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 28 }}>
              经典沙城 II (de_dust2) 3D FPS 第一人称射击对战网页游戏
            </p>

            {/* Team Selection Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
              {/* CT Card */}
              <div
                onClick={() => setPlayerTeam('CT')}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  background: playerTeam === 'CT' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                  border: playerTeam === 'CT' ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontWeight: 900, fontSize: 18 }}>
                  <Shield size={20} />
                  反恐精英 (CT)
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
                  初始标配 M4A4、沙漠之鹰与拆弹器。防守 A/B 点并拆除 C4 炸弹。
                </p>
              </div>

              {/* T Card */}
              <div
                onClick={() => setPlayerTeam('T')}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  background: playerTeam === 'T' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)',
                  border: playerTeam === 'T' ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontWeight: 900, fontSize: 18 }}>
                  <Flame size={20} />
                  恐怖分子 (T)
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
                  初始标配 AK-47、格洛克与 C4 炸药包。进攻 A/B 点安装炸弹并引爆。
                </p>
              </div>
            </div>

            {/* Game Controls Guide */}
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '14px 20px',
                borderRadius: 8,
                marginBottom: 28,
                textAlign: 'left',
                fontSize: 13,
                color: '#cbd5e1',
                lineHeight: 1.8,
              }}
            >
              <div>🎮 <strong>操作键位指南：</strong></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: 6 }}>
                <div>• <strong>W/A/S/D</strong>: 移动与跑动</div>
                <div>• <strong>鼠标移动</strong>: 视角旋转瞄准</div>
                <div>• <strong>鼠标左键</strong>: 射击 / 挥刀 / 投掷</div>
                <div>• <strong>鼠标右键</strong>: 狙击枪开镜 (AWP)</div>
                <div>• <strong>R 键</strong>: 换弹夹</div>
                <div>• <strong>Space 空格</strong>: 跳跃</div>
                <div>• <strong>Ctrl / C</strong>: 下蹲 (压枪更稳)</div>
                <div>• <strong>1 / 2 / 3 / 4</strong>: 切换武器</div>
                <div>• <strong>B 键</strong>: 开启装备购买菜单</div>
                <div>• <strong>E 键</strong>: 拆除 / 安装 C4 炸药</div>
                <div>• <strong>Tab 键</strong>: 查看双方计分板</div>
                <div>• <strong>ESC 键</strong>: 释放鼠标指针</div>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={() => setIsStarted(true)}
              style={{
                width: '100%',
                padding: '16px',
                background: 'linear-gradient(90deg, #eab308 0%, #f59e0b 100%)',
                border: 'none',
                borderRadius: 10,
                color: '#000000',
                fontSize: 18,
                fontWeight: 900,
                cursor: 'pointer',
                letterSpacing: 1,
                boxShadow: '0 8px 24px rgba(234, 179, 8, 0.4)',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
            >
              进入战场 (ENTER BATTLEFIELD)
            </button>
          </div>
        </div>
      )}

      {/* Main HUD overlay when started */}
      {isStarted && (
        <>
          <HUD
            stats={stats}
            weapon={weapon}
            activeSlot={activeSlot}
            gameState={gameState}
            roundTimer={roundTimer}
            scoreCT={scoreCT}
            scoreT={scoreT}
            playerTeam={playerTeam}
            killfeed={killfeed}
            bombState={bombState}
            isScoped={isScoped}
            flashOpacity={flashOpacity}
            bannerMessage={bannerMessage}
            showScoreboard={showScoreboard}
            scoreboard={scoreboard}
            showBuyMenu={showBuyMenu}
            onCloseBuyMenu={() => setShowBuyMenu(false)}
            onBuyItem={handleBuyItem}
            onRestartRound={handleRestartRound}
            onToggleSound={handleToggleSound}
            isMuted={isMuted}
            playerPos={playerPos}
            bots={botList}
          />

          {/* Top-Right Quick Action Utility Toolbar */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(140px)',
              display: 'flex',
              gap: 8,
              zIndex: 70,
            }}
          >
            {/* Audio Mute/Unmute */}
            <button
              onClick={handleToggleSound}
              title={isMuted ? '开启音效' : '静音'}
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#f8fafc',
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {isMuted ? <VolumeX size={16} color="#ef4444" /> : <Volume2 size={16} color="#22c55e" />}
              {isMuted ? '静音中' : '音效已开'}
            </button>

            {/* Buy Menu Button */}
            <button
              onClick={() => setShowBuyMenu((prev) => !prev)}
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#eab308',
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              购买菜单 [B]
            </button>

            {/* Restart Round */}
            <button
              onClick={handleRestartRound}
              title="重新开始本回合"
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#94a3b8',
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <RotateCcw size={15} />
              重开回合
            </button>

            {/* Help / Controls Guide Modal Toggle */}
            <button
              onClick={() => setShowHelpModal(true)}
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#38bdf8',
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <HelpCircle size={15} />
              操作说明
            </button>
          </div>

          {/* Help Modal */}
          {showHelpModal && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(11, 15, 25, 0.85)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 200,
              }}
            >
              <div
                style={{
                  width: '90%',
                  maxWidth: 600,
                  background: '#0f172a',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: 24,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>CS 经典操作与规则</h3>
                  <button
                    onClick={() => setShowHelpModal(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: 18,
                      cursor: 'pointer',
                      fontWeight: 800,
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 2 }}>
                  <div>🎯 <strong>瞄准与射击</strong>: 点击屏幕锁定准星鼠标，左键开火，右键开镜 (AWP)。</div>
                  <div>🏃 <strong>走打与后坐力</strong>: 移动时弹道散布变大，下蹲 (Ctrl) 或静止射击可大幅提升精准度。</div>
                  <div>💣 <strong>C4 爆破机制</strong>: T 阵营在 A 点或 B 点按住 [E] 键 3 秒安装 C4；CT 阵营按住 [E] 键拆除。</div>
                  <div>🛒 <strong>经济系统</strong>: 击杀敌人与赢得回合将奖励美金，按 [B] 键可随时购买顶级枪械与防弹衣。</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
