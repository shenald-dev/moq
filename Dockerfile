# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /moq cmd/moq/main.go

# Runtime stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
COPY --from=builder /moq /usr/local/bin/moq

# Default mocks dir
VOLUME ["/mocks"]
ENV MOCKS_DIR=/mocks
EXPOSE 3000

ENTRYPOINT ["moq"]
CMD ["--mocks-dir", "/mocks"]
