---
description: Kill all local servers and restart on localhost:3000
---

// turbo-all

1. Kill any processes running on port 3000:
   ```
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
   ```

2. Wait a moment for the port to be released:
   ```
   Start-Sleep -Seconds 2
   ```

3. Start the Next.js development server:
   ```
   npm run dev
   ```

**Note:** The dev server will start in the background. You can access it at http://localhost:3000
