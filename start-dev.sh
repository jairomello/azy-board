#!/bin/bash
# Script para subir o ambiente de desenvolvimento do Azy Board

echo "🚀 Iniciando Azy Board..."

# Matar processos existentes nas portas
fuser -k 3001/tcp 2>/dev/null
fuser -k 5173/tcp 2>/dev/null
sleep 1

# Subir API em background
echo "📡 Iniciando API na porta 3001..."
cd /home/jairo/Projetos/azyboard
PORT=3001 bun run --cwd apps/api dev &
API_PID=$!
sleep 3

# Verificar API
if curl -s http://localhost:3001/health/live | grep -q '"status":"ok"'; then
    echo "✅ API rodando em http://localhost:3001"
else
    echo "❌ Falha ao iniciar API"
    exit 1
fi

# Subir Web em background
echo "🌐 Iniciando Web na porta 5173..."
bun run --cwd apps/web dev &
WEB_PID=$!
sleep 5

# Verificar Web
if curl -s http://localhost:5173 | grep -q "Azy Board"; then
    echo "✅ Web rodando em http://localhost:5173"
else
    echo "❌ Falha ao iniciar Web"
    exit 1
fi

echo ""
echo "🎉 Ambiente pronto!"
echo "   API:  http://localhost:3001"
echo "   Web:  http://localhost:5173"
echo ""
echo "PIDs: API=$API_PID WEB=$WEB_PID"
echo "Para parar: kill $API_PID $WEB_PID"

# Manter rodando
wait
