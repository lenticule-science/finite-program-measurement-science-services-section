SHELL := /usr/bin/bash
.DEFAULT_GOAL := help

.PHONY: help check

help: ## Show every procedure
	@echo "Finite program measurement procedures — run 'make <target>':"
	@grep -hE '^[a-z][a-z-]*:.*##' $(MAKEFILE_LIST) | sort | awk -F':.*##[ ]*' '{printf "  %-10s %s\n", $$1, $$2}'

check: ## Verify enterprise records, syntax-check the carrier, and run its tests
	node src/verify-enterprise.mjs
	node --check src/contract-finite-hoare-measurement.mjs
	node --test test/contract-finite-hoare-measurement.test.mjs
