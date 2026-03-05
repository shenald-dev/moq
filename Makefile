.PHONY: build test install docker-build clean

BINARY_NAME=moq
VERSION?=0.1.0
GOOS?=$(shell go env GOOS)
GOARCH?=$(shell go env GOARCH)

build:
	go build -ldflags="-X main.version=$(VERSION)" -o bin/$(BINARY_NAME)-$(GOOS)-$(GOARCH) cmd/moq/main.go

test:
	go test -v ./...

install: build
	cp bin/$(BINARY_NAME)-$(GOOS)-$(GOARCH) $$(go env GOPATH)/bin/$(BINARY_NAME)

docker-build:
	docker build -t shenald/moq:$(VERSION) .

clean:
	rm -rf bin
