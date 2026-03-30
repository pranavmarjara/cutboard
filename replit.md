# Clapshot - Self-Hosted Video/Media Review Tool

## Project Overview

Clapshot is an open-source, self-hosted tool for collaborative video/media review and annotation. It features:
- A **Svelte-based web UI** (frontend, in `client/`)
- A **Rust-based API server** (backend, in `server/`)
- An **Organizer plugin system** (in `organizer/`) using gRPC
- **Protobuf definitions** (in `protobuf/`) for cross-component communication

## Architecture

- **Frontend** (`client/`): Svelte 5 + Vite + TypeScript + Tailwind CSS. Communicates with the backend via WebSocket and HTTP REST.
- **Backend** (`server/`): Rust with Warp (HTTP/WS), Diesel (SQLite), and Tokio. Handles video ingestion, transcoding (ffmpeg), and client API.
- **Organizer** (`organizer/`): Python-based gRPC plugin for folder organization and access control.
- **Protobuf** (`protobuf/`): Shared type definitions in `.proto` files, compiled to TypeScript and Rust.

## Replit Setup

### Frontend Dev Server
- Runs via the **"Start application"** workflow
- Command: `cd client && npm run dev`
- Port: **5000** (configured in `client/vite.config.ts`)
- Host: `0.0.0.0` with `allowedHosts: true` for Replit proxy compatibility

### Protobuf TypeScript Generation
The TypeScript protobuf files (in `protobuf/libs/typescript/src/`) are **generated** and must be rebuilt if `.proto` files change:
```bash
cd protobuf/libs/typescript && make build
```
This requires `protoc` (installed as system dependency) and `ts-proto` npm package.

### Backend
The Rust backend requires additional system dependencies (ffmpeg, SQLite) and is built with `cargo build --release` in the `server/` directory. It listens on port **8095** by default.

## Key Files

- `client/vite.config.ts` - Frontend Vite config (host, port, aliases)
- `client/package.json` - Frontend npm dependencies
- `protobuf/libs/typescript/index.ts` - Protobuf TypeScript entry point
- `server/src/main.rs` - Rust backend entry point
- `server/Cargo.toml` - Rust dependencies

## Deployment

Configured as a **static** site deployment:
- Build: `cd client && npm run build`
- Public dir: `client/dist`

Note: Full deployment requires the Rust backend to be running separately (not included in static build).
