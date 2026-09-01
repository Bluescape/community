#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Bluescape Chat Handler - Setup Verification"
echo "=============================================="
echo ""

# Check Node.js
echo -n "✓ Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}${NODE_VERSION}${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
    echo "  Please install Node.js 18.0.0 or higher"
    exit 1
fi

# Check npm
echo -n "✓ Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}${NPM_VERSION}${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
    echo "  Please install npm"
    exit 1
fi

# Check if node_modules exists
echo -n "✓ Checking dependencies... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}installed${NC}"
else
    echo -e "${YELLOW}not installed${NC}"
    echo "  Run: npm install"
fi

# Check .env file
echo -n "✓ Checking .env configuration... "
if [ -f ".env" ]; then
    echo -e "${GREEN}found${NC}"
    
    # Check required variables
    echo ""
    echo "  Checking required variables:"

    AUTH_MODE=$(grep "^BLUESCAPE_AUTH_MODE=" .env 2>/dev/null | cut -d'=' -f2)
    CLIENT_ID=$(grep "^CLIENT_ID=" .env 2>/dev/null | cut -d'=' -f2)
    CLIENT_SECRET=$(grep "^CLIENT_SECRET=" .env 2>/dev/null | cut -d'=' -f2)
    JWT_TOKEN=$(grep "^JWT_TOKEN=" .env 2>/dev/null | cut -d'=' -f2)
    if [ -z "$AUTH_MODE" ]; then
        if [ -n "$CLIENT_ID" ] && [ -n "$CLIENT_SECRET" ]; then
            AUTH_MODE="oauth"
        else
            AUTH_MODE="jwt"
        fi
    fi

    REQUIRED_VARS=("WORKSPACE_ID" "OPENAI_API_KEY")
    if [ "$AUTH_MODE" = "oauth" ]; then
        REQUIRED_VARS+=("CLIENT_ID" "CLIENT_SECRET")
    else
        REQUIRED_VARS+=("JWT_TOKEN")
    fi
    MISSING_VARS=()
    
    for VAR in "${REQUIRED_VARS[@]}"; do
        VALUE=$(grep "^${VAR}=" .env 2>/dev/null | cut -d'=' -f2)
        if [ -z "$VALUE" ] || [ "$VALUE" = "your_client_id_here" ] || [ "$VALUE" = "your_client_secret_here" ] || [ "$VALUE" = "your_jwt_token_here" ] || [ "$VALUE" = "your_workspace_id" ] || [ "$VALUE" = "your_openai_api_key_here" ]; then
            echo -e "    ${RED}✗ ${VAR}${NC} - needs configuration"
            MISSING_VARS+=("$VAR")
        else
            echo -e "    ${GREEN}✓ ${VAR}${NC} - configured"
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Please configure missing variables in .env${NC}"
        echo "   Edit .env and set: ${MISSING_VARS[@]}"
    fi
else
    echo -e "${YELLOW}not found${NC}"
    echo "  Run: cp .env.example .env"
    echo "  Then edit .env with your configuration"
fi

# Check PM2 (optional)
echo -n "✓ Checking PM2... "
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 -v)
    echo -e "${GREEN}${PM2_VERSION}${NC}"
else
    echo -e "${YELLOW}not installed${NC}"
    echo "  For production: npm install -g pm2"
fi

echo ""
echo "=============================================="
echo "✅ Setup verification complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Bluescape credentials"
echo "2. Run 'npm install' if dependencies aren't installed"
echo "3. Run 'npm start' for production or 'npm run dev' for development"
