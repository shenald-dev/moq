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
```bash
npm install -g moq-server
```

Or run dynamically without installing:
```bash
npx moq-server
```

### 2. Setup your Mocks

Create a `mocks` folder in your project root and drop some JSON files inside.
```bash
mkdir -p mocks/api/users
echo '{"id": 1, "name": "Shenald"}' > mocks/api/users/profile.json
```

### 3. Run the Server

```bash
moq
```
*The server will spin up on `http://localhost:4000`.*

Now simply fetch your mock!
```bash
curl http://localhost:4000/api/users/profile
# Returns: {"id": 1, "name": "Shenald"}
```

---

## 💻 Comprehensive Usage

### CLI Flags

You can customize the server behavior on startup:

- `--port, -p`: Specify the port (default: `4000`).
- `--dir, -d`: Specify the directory containing your JSON files (default: `./mocks`).
- `--delay, -t`: Add simulated network latency in milliseconds (e.g., `-t 500`).

**Example:**
```bash
moq --port 8080 --dir ./api-responses --delay 1000
```

---

## 🤝 Contributing

We welcome contributions to make mocking even faster!

- 🐛 **Found a bug?** Open an issue.
- ✨ **Have a feature idea?** Submit a PR (e.g., adding dynamic JS resolution).

---
> *Built by a Vibe Coder. Keep your flow state unbroken.*
