# Kill Localhost Ports Command

This command kills processes running on common localhost ports.

## Usage
```
/kill-ports
```

## What it does
- Kills processes on ports 3000-3010 (common dev server ports)
- Useful when dev servers are stuck or ports are occupied

## Command
```bash
npx kill-port 3000 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010 || echo "Some ports were not in use"
```