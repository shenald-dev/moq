# README.md
<div align="center">
  <img src="assets/logo.png" alt="moq Logo" width="250" />
  
  <br/>

  <h1>🎭 moq</h1>
  <p><b>Zero-Config Mock Server</b></p>
  <i>A lightning-fast Express-based server to instantly mock API endpoints during frontend development without config hassle.</i>

  <br/>
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
  [![Express](https://img.shields.io/badge/Express.js-000000.svg?style=flat&logo=express&logoColor=white)](https://expressjs.com)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

---

## 📑 Table of Contents
- [🌟 Overview](#-overview)
- [🚀 Enterprise Features](#-enterprise-features)
- [⚡ Quick Start Guide](#-quick-start-guide)
- [💻 Comprehensive Usage](#-comprehensive-usage)
- [🤝 Contributing](#-contributing)

---

## 🌟 Overview

**moq** is an ultra-lightweight, zero-config mock server designed specifically for frontend developers and UI/UX designers. When the backend isn't ready, `moq` intercepts your API calls and serves structured JSON responses dynamically based purely on your folder structure.

No YAML configuration, no complex routing files. Just drop JSON files in a folder and start fetching.

---

## 🚀 Enterprise Features

- **⚡ Zero Configuration**: Route resolution is entirely file-system based (e.g., `mocks/api/users.json` automatically maps to `GET /api/users`).
- **🔄 Hot Reloading**: Edit your JSON mock files and instantly see the changes in your frontend without restarting the server.
- **🛡️ CORS Enabled**: Works flawlessly with Next.js, React, Vue, or any frontend framework locally.
- **⏱️ Simulated Latency**: Test your loading states by easily configuring artificial network delays.
- **🧬 TypeScript Native**: Built entirely in strict TypeScript for unmatched performance and safety.

---

## ⚡ Quick Start Guide

### 1. Installation

Install globally to use anywhere on your system:
Or run dynamically without installing:
### 2. Setup your Mocks

Create a `mocks` folder in your project root and drop some JSON files inside.
### 3. Run the Server
*The server will spin up on `http://localhost:4000`.*

Now simply fetch your mock!
---

## 💻 Comprehensive Usage

### CLI Flags

You can customize the server behavior on startup:

- `--port, -p`: Specify the port (default: `4000`).
- `--dir, -d`: Specify the directory containing your JSON files (default: `./mocks`).
- `--delay, -t`: Add simulated network latency in milliseconds (e.g., `-t 500`).

**Example:**
### 🛣️ Routing & URL Handling

**Root Path & Index Files**
The server automatically maps `index.json` files to their respective directory paths. 
- The root path (`/`) is mapped to `mocks/index.json`.
- Nested directories follow the same rule (e.g., `mocks/api/index.json` maps to `/api`).

If you need to serve a specific payload or health check at the root of your API, simply create an `index.json` file in your mock directory:
*Note: If no `index.json` is present at the root, the server will return a default welcome JSON payload.*

**Trailing Slash Normalization**
To ensure consistent API behavior and prevent unexpected 404 errors, `moq` automatically normalizes trailing slashes. Whether your frontend requests `/api/users` or `/api/users/`, the server will seamlessly resolve the route to the correct mock file (e.g., `mocks/api/users.json` or `mocks/api/users/index.json`). Strict trailing slash matching is disabled by default to provide a forgiving development experience.

---

## 🤝 Contributing

We welcome contributions to make mocking even faster!

-
