#!/bin/bash
export PATH="/Users/nathankostynick/local/node/bin:$PATH"
cd /Users/nathankostynick/FrisbeeApp/purple-reign-stats
npx next dev --port "${PORT:-3000}"
