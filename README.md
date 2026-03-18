# moq

> **HTTP mocks at the speed of thought.**  
> Drop a `./mocks` folder, run `moq`, done. Zero config, no GUI, no fuss.

---

## ✨ Why?

Need to mock an API quickly?  
`moq` watches a folder of JSON files and serves them as HTTP endpoints instantly.

- ✅ **Zero config** — just `./mocks` and `moq`
- ✅ **Single binary** — `curl -O https://moq.dev/moq-linux-amd64`
- ✅ **Instant setup** — 5 seconds from download to running
- ✅ **Smart routing** — `GET-/api/users.json` → `GET /api/users`
- ✅ **Dynamic params** — `GET-/api/users/:id.json` → `GET /api/users/123`
- ✅ **Proxy fallback** — `moq proxy https://real.api` (optional)
- ✅ **Record mode** — `moq record` captures real responses
- ✅ **Hot reload** — edit JSON, auto-reload

---

## 🚀 Quick Start

```bash
# 1️⃣ Install globally via npm
npm install -g moq

# 2️⃣ Create mocks folder
mkdir mocks
echo '{"users":["alice","bob"]}' > mocks/GET-/api/users.json

# 3️⃣ Run
moq

# 4️⃣ Test
curl http://localhost:3000/api/users
# → {"users":["alice","bob"]}
```

That's it. You're mocking.

---

## 📁 Mock File Conventions

File naming: `<METHOD>-<path>.json` (or you can use folders)

- `mocks/GET-/api/users.json` → `GET /api/users`
- `mocks/POST-/api/login.json` → `POST /api/login`
- `mocks/GET-/api/users/_id.json` → `GET /api/users/123` (dynamic `_id`)
- `mocks/404.json` → default 404 response (optional)

---

## 🧩 Advanced Usage

```bash
# Proxy mode (fallback to real API)
moq --proxy https://api.example.com

# Custom port
moq -p 8080

# Custom mocks dir
moq -d ./test-mocks

# Hot reload disabled (production)
moq --no-reload
```

---

## 🔧 Development

```bash
git clone https://github.com/shenald-dev/moq.git
cd moq
npm install
npm start

# Run tests
npm test

# Build binary
npm run build:bin

# Backup mocks (Self-Healing)
npm run backup-mocks
```

---

## 📊 Philosophy

**Mocking should be trivial.**  
No YAML complexity. No GUI clicks. Just files + one command.

`moq` is built for developers who want to *ship fast* and *move on*.

---

## 🛠️ Tech Stack

- **Go** — single binary, zero runtime
- **chi router** — lightweight, fast
- **fsnotify** — hot reload
- **cobra** — CLI

---

## 📄 License

MIT — do whatever you want.

---

## 🙋‍♂️ Built by a vibe coder, for vibe coders.

If it's useful, star it ⭐ — if not, open an issue and tell me why.

*Less is more.* 🧘
