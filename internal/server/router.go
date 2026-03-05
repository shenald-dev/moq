package server

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

// Mock represents a loaded mock file
type Mock struct {
	Method string
	Path   string
	File   string // original file path
}

// loadMocks scans mocks dir and registers routes
func (s *Server) loadMocks() {
	mocksDir := s.mocksDir
	err := filepath.Walk(mocksDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".json") {
			return nil
		}

		// Parse filename: METHOD-route.json (e.g. GET-/api/users.json)
		fname := info.Name()
		parts := strings.SplitN(fname, "-", 2)
		if len(parts) < 2 {
			return nil
		}
		method := parts[0]
		route := strings.TrimSuffix(parts[1], ".json")

		// Normalize route: convert :param placeholders to chi format
		route = s.normalizeRoute(route)

		// Register handler for this route
		s.router.Method(method, route, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			s.serveMock(w, r, path)
		}))

		log.Printf("📝 Mock loaded: %s %s → %s", method, route, info.Name())
		return nil
	})

	if err != nil {
		log.Printf("⚠️ Error loading mocks: %v", err)
	}
}

// normalizeRoute converts /api/users/:id → /api/users/{id}
func (s *Server) normalizeRoute(route string) string {
	// Chi uses {param} syntax. Convert :param to {param}
	// Also handle * wildcard if needed
	route = strings.ReplaceAll(route, ":", "{")
	route = strings.ReplaceAll(route, "*", "{}") // simplistic
	return route
}

// serveMock reads the JSON file and writes it to response
func (s *Server) serveMock(w http.ResponseWriter, r *http.Request, filePath string) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		http.Error(w, "Mock file error", http.StatusInternalServerError)
		return
	}

	// Set content type
	w.Header().Set("Content-Type", "application/json")
	// Optionally read meta file for status code, headers (future)
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// setupWatcher watches mocks dir and reloads on change
func (s *Server) setupWatcher() {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Println("⚠️ Watcher not available:", err)
		return
	}
	s.watcher = watcher

	err = watcher.Add(s.mocksDir)
	if err != nil {
		log.Println("⚠️ Cannot watch mocks dir:", err)
		return
	}

	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create {
					log.Println("🔄 Mock changed, reloading...")
					s.router = chi.NewRouter() // reset routes
					s.loadMocks()
					s.setupOtherRoutes() // re-add health, 404, etc.
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Println("Watcher error:", err)
			}
		}
	}()
}

// setupOtherRoutes adds non-dynamic routes (like health, proxy fallback, etc.)
func (s *Server) setupOtherRoutes() {
	// Health check
	s.router.Get("/_health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// 404 fallback
	s.router.NotFound(func(w http.ResponseWriter, r *http.Request) {
		// Try to serve 404.json if exists
		fallback := filepath.Join(s.mocksDir, "404.json")
		if _, err := os.Stat(fallback); err == nil {
			data, _ := os.ReadFile(fallback)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			w.Write(data)
			return
		}
		http.NotFound(w, r)
	})
}
