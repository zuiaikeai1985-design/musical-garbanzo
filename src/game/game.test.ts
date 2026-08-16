import { describe, it, expect } from 'vitest';
import { WEAPONS, BUY_MENU_ITEMS } from './weapons';
import { buildDust2Map } from './MapBuilder';
import { Bot } from './Bot';
import * as THREE from 'three';

describe('CS Game Core Logic Tests', () => {
  it('should have all classic weapons configured properly', () => {
    expect(WEAPONS.ak47).toBeDefined();
    expect(WEAPONS.m4a1).toBeDefined();
    expect(WEAPONS.awp).toBeDefined();
    expect(WEAPONS.deagle).toBeDefined();
    expect(WEAPONS.knife).toBeDefined();
    expect(WEAPONS.c4).toBeDefined();

    expect(WEAPONS.ak47.damage).toBeGreaterThan(30);
    expect(WEAPONS.awp.damage).toBeGreaterThan(100);
    expect(WEAPONS.awp.hasScope).toBe(true);
    expect(WEAPONS.knife.category).toBe('melee');
  });

  it('should have buy menu catalog items', () => {
    expect(BUY_MENU_ITEMS.length).toBeGreaterThan(5);
    const hasKevlar = BUY_MENU_ITEMS.some((i) => i.id === 'kevlar');
    const hasHelmet = BUY_MENU_ITEMS.some((i) => i.id === 'helmet');
    const hasDefuser = BUY_MENU_ITEMS.some((i) => i.id === 'defuser');

    expect(hasKevlar).toBe(true);
    expect(hasHelmet).toBe(true);
    expect(hasDefuser).toBe(true);
  });

  it('should construct Dust2 map with valid bomb sites, obstacles and navpoints', () => {
    const map = buildDust2Map();
    expect(map.obstacles.length).toBeGreaterThan(10);
    expect(map.siteA.name).toBe('A');
    expect(map.siteB.name).toBe('B');
    expect(map.tSpawn).toBeDefined();
    expect(map.ctSpawn).toBeDefined();
    expect(map.navPoints.length).toBeGreaterThan(5);
  });

  it('should handle bot damage, armor calculations, and death', () => {
    const bot = new Bot('test_bot', 'Test Bot', 'T', new THREE.Vector3(0, 0, 0), 'ak47');
    expect(bot.isAlive).toBe(true);
    expect(bot.health).toBe(100);

    // Body shot with armor
    const hit1 = bot.takeDamage(30, false);
    expect(hit1.died).toBe(false);
    expect(bot.health).toBeLessThan(100);
    expect(bot.armor).toBeLessThan(100);

    // Massive headshot to kill
    const hit2 = bot.takeDamage(120, true);
    expect(hit2.died).toBe(true);
    expect(bot.isAlive).toBe(false);
    expect(bot.health).toBe(0);
    expect(bot.state).toBe('dead');
  });
});
