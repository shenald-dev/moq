package config

type Config struct {
	Port        string // "3000"
	MocksDir    string // "./mocks"
	ProxyMode   bool   // false
	ProxyTarget string // ""
	RecordMode  bool   // false
	NoReload    bool   // false
}

func Default() *Config {
	return &Config{
		Port:     "3000",
		MocksDir: "./mocks",
	}
}
