#!/bin/bash
set -e
echo "Deploying school-learning-website..."
docker compose -f docker-compose.prod.yml up -d --build
echo "Waiting for services to start..."
sleep 10
docker compose -f docker-compose.prod.yml ps
echo "Deployment complete!"
