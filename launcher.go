package main

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"time"
)

type Config struct {
	BackendCmd   string `json:"backendCmd"`
	FrontendCmd  string `json:"frontendCmd"`
	BackendPort  int    `json:"backendPort"`
	FrontendPort int    `json:"frontendPort"`
	OpenURL      string `json:"openUrl"`
}

func openBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}

func startCmd(shellCmd string) (*exec.Cmd, error) {
	if shellCmd == "" {
		return nil, fmt.Errorf("empty command")
	}
	
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/C", shellCmd)
	} else {
		cmd = exec.Command("sh", "-c", shellCmd)
	}
	
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Dir, _ = os.Getwd() // Ustawia katalog roboczy
	
	return cmd, cmd.Start()
}

func waitForPort(host string, port int, timeout time.Duration) error {
	if port == 0 {
		return nil
	}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", host, port), 1*time.Second)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	return fmt.Errorf("timeout waiting for %s:%d", host, port)
}

func readConfig() Config {
	// Domyślna konfiguracja dopasowana do tego repo
	cfg := Config{
		// --skip-init, aby nie ruszać schematu/seed przy każdym starcie
		BackendCmd:   "npm start -- --skip-init",
		FrontendCmd:  "npm run dev --prefix ./frontend",
		// Backend domyślnie słucha na 3001, ale w praktyce używasz 3002 z .env – steruj przez launcher.json
		BackendPort:  3002,
		// Vite dev domyślnie 5173
		FrontendPort: 5173,
		OpenURL:      "http://localhost:5173",
	}
	f, err := os.Open("launcher.json")
	if err != nil {
		return cfg
	}
	defer f.Close()
	dec := json.NewDecoder(f)
	_ = dec.Decode(&cfg)
	return cfg
}

func main() {
	cfg := readConfig()

	fmt.Println("Starting backend:", cfg.BackendCmd)
	beCmd, beErr := startCmd(cfg.BackendCmd)
	if beErr != nil {
		fmt.Println("Failed to start backend:", beErr)
		beCmd = nil
	}

	fmt.Println("Starting frontend:", cfg.FrontendCmd)
	feCmd, feErr := startCmd(cfg.FrontendCmd)
	if feErr != nil {
		fmt.Println("Failed to start frontend:", feErr)
		feCmd = nil
	}

	// Poczekaj aż usługi wstaną (nie blokuj wiecznie)
	if cfg.FrontendPort != 0 {
		fmt.Printf("Waiting for frontend on port %d...\n", cfg.FrontendPort)
		if err := waitForPort("localhost", cfg.FrontendPort, 60*time.Second); err != nil {
			fmt.Println("Warning:", err)
		}
	}
	if cfg.BackendPort != 0 {
		fmt.Printf("Waiting for backend on port %d...\n", cfg.BackendPort)
		if err := waitForPort("localhost", cfg.BackendPort, 60*time.Second); err != nil {
			fmt.Println("Warning:", err)
		}
	}

	// Otwórz przeglądarkę
	url := cfg.OpenURL
	if url == "" && cfg.FrontendPort != 0 {
		url = fmt.Sprintf("http://localhost:%d", cfg.FrontendPort)
	}
	if url != "" {
		fmt.Println("Opening browser at", url)
		if err := openBrowser(url); err != nil {
			fmt.Println("Could not open browser:", err)
		}
	}

	fmt.Println("Launcher running. Press Ctrl+C to stop child processes…")

	// Obsługa Ctrl+C – spróbuj posprzątać child procesy
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt)
	<-sigCh
	fmt.Println("\nStopping…")
	if feCmd != nil && feCmd.Process != nil {
		_ = feCmd.Process.Kill()
	}
	if beCmd != nil && beCmd.Process != nil {
		_ = beCmd.Process.Kill()
	}
	fmt.Println("Done.")
}
