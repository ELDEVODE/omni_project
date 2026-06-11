.PHONY: all start-all

all: start-all

start-all:
	@echo "Booting OmniMesh Orchestrator, Worker Node, and Web Dashboard..."
	bun run dev
