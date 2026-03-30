---
title: Mapa do Repositório (RPG System / VTT)
description: Guia de entrada e mapa de arquitetura para agentes e desenvolvedores.
tags: [mapa, arquitetura, entrada]
repo: frontend
related:
  - /knowledge/architecture.md
  - /knowledge/stack.md
last_updated: 2026-03-30
status: estável
---

# Repository Map (RPG System / VTT)

This document serves as a map and entry guide for agents and developers to understand the system architecture.

The repository contains a Virtual Tabletop (VTT) system focused on managing tabletop RPG sessions, inspired by systems with narrative rolls, zones, scene aspects, stress, and consequences (similar to Fate Core/Accel).

The system uses an **Event Sourcing** architecture. This means every mechanical action in the game (movement, dice rolling, taking damage, status changes, music updates) does not mutably overwrite the database; instead, it is appended to a chronological log of events (a "timeline"). The current state of the session is "projected" by traversing and aggregating these events in sequence (see `src/lib/projections.ts`).

## Core Technologies
* **Frontend**: Next.js (App Router, React), Vanilla CSS/Modules, WebRTC for native audio/video.
* **Backend**: NestJS, WebSockets (for real-time action broadcasting).
* **Database**: Supabase (PostgreSQL) for persistence and real-time support.

---

## Directory Structure

### 1. `src/` (Frontend - Next.js)
Responsible for the entire User Interface (View) and State assembly (Projection).

#### 🚪 Entry Points:
* `src/app/page.tsx`: Initial landing page.
* **`src/app/session/[id]/page.tsx`**: MAIN entry point. This is the "living" core of the game session. It orchestrates the Game Master's HUD (VI), player HUDs, and switches between main tabs (Combat, Bestiary, Log). It is a complex component that also handles Game Over/Victory animations.

#### 🧠 Logic Core (`src/lib/`):
* **`eventStore.ts`**: The heart of event sourcing on the client. Connects to the backend/supabase, dispatches (`append()`), and receives event streams (`subscribe()`).
* **`projections.ts`**: How the timeline builds the present state. It iterates through store events and constructs a large state object (containing Characters, Aspects, Missions).
* **`gameLogic.ts`**: Business rules (e.g., calculating damage absorption via stress, determining character elimination, etc.).
* **`VoiceChatManager.ts` / `ScreenShareManager.ts`**: Custom WebRTC integration, creating dynamic voice/video rooms between players.
* **`themePresets.ts`**: Dynamic theme manager (frosted glass, cyberpunk, high fantasy) and design system at runtime.

#### 🧩 UI Components (`src/components/`):
* `SessionHeader.tsx` & `VIControlPanel.tsx`: Exclusive GM tools and utilities (Music volume, scene creation, grid) concentrated at the top.
* `CharacterCard.tsx` / `CombatCard.tsx`: Complete character sheets with attributes and the condensed version (for combat mode).
* `Battlemap.tsx` / `ZoneEditor.tsx`: Scene positioning control. "Grids" function as "Narrative Zones" based on SVG and interactive tokens.
* `DiceRoller.tsx` & `FateDice3D.tsx`: 3D dice roller for immersive roll representations.
* Unified Audio: `MusicPlayer.tsx`, `AtmosphericPlayer.tsx`, `TransmissionPlayer.tsx`.

#### 📝 Data Contracts (`src/types/`):
* **`domain.ts`**: The most important file for game semantics. Contains Typescript definitions and interfaces for Events (e.g., `CharacterAddedEvent`, `DamageDealtEvent`) and Models (e.g., `Character`, `Aspect`, `Zone`, `Mission`).

---

### 2. `backend/` (Authorized Backend - NestJS)
Responsible for maintaining consistency and serving as a gateway between different clients.

#### 🚪 Entry Points:
* **`backend/src/main.ts`**: App bootstrap point running on a custom port.
* **`backend/src/app.module.ts`**: Central hub that imports all server sub-modules.

#### 🛠️ System Modules:
* `backend/src/sessions/`: Management of room lifecycles (connections, websockets, GM/VI authentication).
* `backend/src/events/`: Validated message reception. When a player sends an action, this module propagates it to all other players with a new ID/sequence (Socket Gateway).
* `backend/src/roll/`: Server-authorized dice mechanisms.
* `backend/src/supabase/`: Wrapper for PostgreSQL queries via Supabase API, assisting in backups, scheduled deletions, and bulk bestiary loads.

## 🔄 Summary Data Flow (How it happens)
1. **Activation**: A user in the HUD triggers an action (e.g., clicks "Deal X Damage").
2. **Dispatch**: The React Component triggers a function that creates a new event of the corresponding type and appends it to the store (`eventStore.append({ type: 'DAMAGE_DEALT', ... })`).
3. **Network**: `eventStore` transmits to the WebSocket (NestJS) or broadcast channel.
4. **Relay**: NestJS/Supabase timestamps/sequences the event and relays it to everyone in the Room, including the sender.
5. **Reactivity**: All clients receive the event via `eventStore.subscribe()`. Hooks trigger `projections.ts` which recalculates the game state using the updated log. The UI reacts to this projection instantly, and health bars/consequences are updated accordingly.
