package server

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/shenald-dev/moq/internal/config"
	"github.com/fsnotify/fsnotify"
)

type Server struct {
	cfg       *config.Config
	router    *chi.Mux
	mocksDir string
	watcher    *fsnotify.Watcher
}

func New(cfg *config.Config) (*Server, error) {
	s := &Server{
		cfg:       cfg,
		router:    chi.NewRouter(),
		mocksDir: cfg.MocksDir,
	}

	// Ensure mocks dir exists
	if _, err := os.Stat(cfg.MocksDir); os.IsNotExist(err) {
		os.MkdirAll(cfg.MocksDir, 0755)
	}

	// Load mocks
	s.loadMocks()

	// Setup routes
	s.loadMocks()
	s.setupOtherRoutes()

	// Hot reload watcher (if not disabled)
	if !cfg.NoReload {
		s.setupWatcher()
	}

	return s, nil
}

func (s *Server) Start() {
	log.Printf("🚀 moq listening on http://localhost:%s", s.cfg.Port)
	log.Printf("📁 Mocks dir: %s", s.mocksDir)
	if s.cfg.ProxyMode {
		log.Printf("🔗 Proxy mode → %s", s.cfg.ProxyTarget)
	}
	if err := http.ListenAndServe(":"+s.cfg.Port, s.router); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func (s *Server) Shutdown() {
	log.Println("🛑 Shutting down moq...")
	if s.watcher != nil {
		s.watcher.Close()
	}
}
