# The Ancient Grove — MOBA Design Document

## Overview

**The Ancient Grove** is a 5v5 MOBA set in a vast, ancient forest realm. Two teams of five players battle across a hexagonal arena of towering trees, sacred stone circles, and corrupted wilderness. The goal is not to destroy a passive structure — it is to **slay the enemy team's Corrupted Ancient**: a living, enraged forest god defending its domain.

**Genre:** MOBA
**Format:** 5v5
**Theme:** Dark fantasy / Nature — think MTG Green meets corrupted forest deity
**Win Condition:** First team to destroy the enemy's Corrupted Ancient

---

## The Map — The Hexagonal Grove

The map is a **hexagon** oriented point-to-point (like a diamond), with each team's base at opposite points. Three lanes connect the bases through the hex's interior; jungle fills the spaces between lanes.

```
              [RED BASE]
             /     |     \
          [Top]  [Mid]  [Bot]
           |   \  |  /   |
           |  [JUNGLE] [JUNGLE]
           |  [N.Shrine][S.Shrine]
           |   /  |  \   |
          [Bot]  [Mid] [Top]
             \     |     /
              [BLUE BASE]
```

### Lanes
- **Top Lane** — left flank of the hex; favors durable fighters
- **Mid Lane** — center diagonal; high traffic, high impact
- **Bot Lane** — right flank of the hex; favors ranged carries + support pairs

### Jungle
Two jungle zones fill the triangular spaces between lanes:
- **North Jungle** — between Top and Mid lanes (upper half of hex)
- **South Jungle** — between Mid and Bot lanes (lower half of hex)

The **center** of the hex is the Grove Heart — a sacred clearing where the Grove Warden spawns.

---

## Win Condition — The Corrupted Ancient

Each team's base is guarded by a **Corrupted Ancient**: a massive fallen treant twisted by dark magic. It is not passive — it actively attacks anyone who enters its domain.

### Stats
- Large HP pool (not burst-killable by one player)
- **Primordial Armor** passive: reduces all incoming damage by 30%
  - Reduced by 10% for each Heart Root destroyed (see below)
  - At 0 Heart Roots: Primordial Armor fully removed

### Abilities
| Ability | Description |
|---|---|
| **Root Slam** | AoE stomp around itself — damages and briefly roots nearby attackers |
| **Poison Breath** | Cone of corrupted spores — applies damage-over-time |
| **Vine Lash** | Targets the farthest attacker — pulls them into melee range |
| **Enrage** (50% HP) | Gains +40% attack speed, summons 2 Forest Wraith adds |

### Strategic Implication
You cannot backdoor the Ancient — it will kill isolated attackers. You need:
- A **tank** to absorb Root Slam
- A **healer/support** to counter Poison Breath DoT
- Enough DPS to burn it before Vine Lash picks off squishies
- Heart Roots cleared to remove Primordial Armor (otherwise it takes forever)

---

## Objectives

### 1. Ancient Roots (Towers)

Living root structures that defend each base. Destroying them opens paths, grants gold, and weakens the Corrupted Ancient.

**Structure per side (per lane):**
```
[Outer Root] → [Inner Root] → [Heart Root] → [Corrupted Ancient]
```

| Structure | Effect When Destroyed |
|---|---|
| **Outer Root** | Opens jungle access to enemy territory; grants gold |
| **Inner Root** | Grants access to Heart Root; grants gold |
| **Heart Root** (3 total, 1 per lane) | Reduces Corrupted Ancient's Primordial Armor by 10% |

**Notes:**
- Outer and Inner Roots have moderate HP and a passive attack (like LoL towers)
- Heart Roots have higher HP; Ancient's Primordial Armor incentivizes clearing all 3
- Roots do **not** respawn once destroyed

---

### 2. Ley Shrines (3 on map)

Ancient magical nodes scattered across the hex. Each shrine is guarded by a **Shrine Guardian** — a minor neutral boss. Killing the Guardian activates the shrine for your team.

**Positions:**
- **North Shrine** — North Jungle, between Top and Mid lanes
- **South Shrine** — South Jungle, between Mid and Bot lanes
- **Crossing Shrine** — Center of the map, near the Grove Heart (contested by both teams)

**Mechanics:**
- Killing a Shrine Guardian captures the shrine (takes ~5 seconds, interrupted by damage)
- Each shrine captured gives your team a **permanent stacking buff**
- Shrines respawn every **5 minutes** after capture (enemy can recapture)
- Capturing a shrine your opponent controls resets their stack and adds to yours

**Stacking Buffs (Verdant Blessings):**
| Stacks | Buff |
|---|---|
| 1 | +8% damage dealt |
| 2 | +8% damage dealt, +10% healing received |
| 3 | **Ley Convergence** — +15% damage, +15% healing, +10% movement speed across the map |

**Ley Convergence** is the "Dragon Soul" equivalent — a major mid-game power spike that makes the shrine race feel urgent.

---

### 3. Grove Warden

The most powerful neutral creature on the map. A colossal stone-and-vine golem — the last uncorrupted guardian of the Grove Heart — that resists both teams equally.

**Spawn:** 12:00, then every **7 minutes** after kill
**Location:** Center of the hex (Grove Heart clearing)
**Difficulty:** Requires coordinated team effort (~20–30 seconds with full team)

**Reward — Warden's Grasp:**
- All living team members gain a 4-minute buff
- Empowers your minions (they gain bonus HP and damage — like LoL's Baron buff)
- Grants bonus gold to each team member
- Warden's Grasp minions can crack open Inner Roots faster and threaten Heart Roots

**Contest dynamics:**
- The Crossing Shrine is nearby — fighting for both simultaneously forces priority decisions
- The Warden can be "stolen" with a well-timed burst ability (creates high-drama moments for the sim's play-by-play)

---

## Roles

Five positions, each with a thematic name and mechanical identity:

| Position | Role Name | Function |
|---|---|---|
| Top | **Vanguard** | Durable frontliner, duelist; pressures top side |
| Jungle | **Ranger** | Mobile camp-clearer, shrine controller, ganker |
| Mid | **Arcanist** | High-impact mage or assassin; roams, controls mid |
| Bot | **Hunter** | Ranged carry; scales into late game DPS |
| Support | **Warden** | Healer, protector, crowd control; enables the team |

> In-world lore flavor: all five roles exist in the professional league that players in the management game follow.

---

## Champion Classes

Six classes map to the five roles (some classes appear in multiple positions):

| Class | Primary Role(s) | Playstyle |
|---|---|---|
| **Fighter** | Vanguard, Ranger | Melee, durable, sustained damage |
| **Tank** | Vanguard, Warden | High HP, CC, initiation |
| **Assassin** | Arcanist, Ranger | Burst damage, mobile, squishy |
| **Mage** | Arcanist, Warden | Ability-based, AoE, utility |
| **Marksman** | Hunter | Ranged, scaling, positioning-dependent |
| **Sentinel** | Warden, Vanguard | Shielding, healing, peel |

---

## Match Pacing

| Phase | Time | Key Events |
|---|---|---|
| **Seedling** | 0:00–10:00 | Farm, early skirmishes, contest Outer Roots, first Shrine Guardians |
| **Growth** | 10:00–20:00 | Team fights over Shrines, Inner Roots, Grove Warden first spawn (12:00) |
| **Bloom** | 20:00+ | Grove Warden contests, push for Heart Roots, Ley Convergence, assault Corrupted Ancient |

---

## Key Differentiators vs. LoL / TFM2

| Element | League of Legends | The Ancient Grove |
|---|---|---|
| Win condition | Destroy passive Nexus | Slay the attacking Corrupted Ancient |
| Map shape | Asymmetric square | Hexagon |
| Objectives | Dragon, Baron, Towers | Ley Shrines, Grove Warden, Ancient Roots |
| End-game boss | Passive structure | Active boss with abilities |
| Buff stacking | Dragon stacks | Verdant Blessings (shrine stacks) |
| Baron equivalent | Baron Nashor | Grove Warden |
| Tower equivalent | Nexus turrets → Nexus | Outer Root → Inner Root → Heart Root |

---

## Implications for the Sim Engine

The Corrupted Ancient as an active boss creates **composition-dependent win conditions** that make draft decisions legible:
- Teams with no tank get punished by Root Slam (sim can track this)
- Teams with no healing struggle against Poison Breath DoT
- A team with Warden's Grasp buff has a concrete mid-game advantage the sim can model

Ley Shrines create **territorial control** as a sim variable — not just kills and gold, but shrine stack count feeding into team power calculations.

Ancient Roots destruction **reduces boss armor** — this gives the sim a clean mechanic for "did you win the mid-game or not" that translates directly into late-game difficulty.

---

*Document version: 1.0 — March 2026*
